import { prisma, upsertOffer } from '@bwp/db';
import { matchProduct, normalizeForSearch, normalizeGtin, slugify, type MatchCandidate } from '@bwp/shared';
import type { RawOffer, StoreAdapter } from './types';

export interface IngestStats {
  fetched: number;
  matched: Record<'gtin' | 'model_number' | 'name', number>;
  created: number;
  unmatched: number;
  deactivated: number;
}

async function loadCandidates(): Promise<MatchCandidate[]> {
  const rows = await prisma.product.findMany({ include: { identifiers: true } });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    gtins: p.identifiers.filter((i) => i.type === 'GTIN').map((i) => i.value),
    modelNumbers: [
      ...(p.modelNumber ? [p.modelNumber] : []),
      ...p.identifiers.filter((i) => i.type === 'MPN').map((i) => i.value),
    ],
  }));
}

/** Nytt produkt fra et tilbud. Krever gyldig GTIN og merke, så vi ikke fyller basen med søppel. */
async function createProduct(raw: RawOffer): Promise<MatchCandidate | null> {
  const gtin = normalizeGtin(raw.gtin);
  if (!gtin || !raw.brand) return null;
  const category = await prisma.category.upsert({
    where: { slug: 'annet' },
    update: {},
    create: { slug: 'annet', name: 'Annet' },
  });
  const name = raw.title.toLowerCase().startsWith(raw.brand.toLowerCase())
    ? raw.title.slice(raw.brand.length).trim()
    : raw.title;
  const p = await prisma.product.create({
    data: {
      slug: `${slugify(`${raw.brand} ${name}`)}-${gtin.slice(-6)}`,
      name,
      brand: raw.brand,
      modelNumber: raw.modelNumber,
      imageUrl: raw.imageUrl,
      categoryId: category.id,
      searchText: normalizeForSearch(`${raw.brand} ${name} ${raw.modelNumber ?? ''}`),
      identifiers: {
        create: [
          { type: 'GTIN', value: gtin },
          ...(raw.modelNumber ? [{ type: 'MPN' as const, value: raw.modelNumber }] : []),
        ],
      },
    },
  });
  return { id: p.id, name, brand: raw.brand, gtins: [gtin], modelNumbers: raw.modelNumber ? [raw.modelNumber] : [] };
}

/**
 * Kjører en adapter og lagrer tilbudene: matcher mot eksisterende produkter
 * (EAN/GTIN → modellnummer → navn), lager nye produkter når GTIN er kjent,
 * og logger resten som umatchet.
 */
export async function ingest(
  adapter: StoreAdapter,
  options: { limit?: number; dryRun?: boolean; log?: (msg: string) => void } = {},
): Promise<IngestStats> {
  const log = options.log ?? console.log;
  const store = await prisma.store.findUnique({ where: { slug: adapter.storeSlug } });
  if (!store) throw new Error(`Butikken «${adapter.storeSlug}» finnes ikke i databasen`);

  const candidates = await loadCandidates();
  const stats: IngestStats = { fetched: 0, matched: { gtin: 0, model_number: 0, name: 0 }, created: 0, unmatched: 0, deactivated: 0 };
  const seenOfferIds: string[] = [];
  const startedAt = new Date();

  for await (const raw of adapter.fetchOffers({ limit: options.limit })) {
    stats.fetched++;
    const match = matchProduct(
      { name: raw.title, brand: raw.brand, gtin: raw.gtin, modelNumber: raw.modelNumber },
      candidates,
    );
    let productId = match?.productId ?? null;
    if (match) stats.matched[match.method]++;

    if (!productId && !options.dryRun) {
      const created = await createProduct(raw);
      if (created) {
        candidates.push(created);
        productId = created.id;
        stats.created++;
      }
    }
    if (!productId) {
      stats.unmatched++;
      log(`umatchet: ${raw.title} (GTIN ${raw.gtin ?? '–'}, ${raw.url})`);
      continue;
    }

    log(`${match ? `${match.method} ${match.confidence}` : 'nytt produkt'}: ${raw.title} → ${raw.priceOre / 100} kr`);
    if (options.dryRun) continue;
    const offer = await upsertOffer({
      productId,
      storeId: store.id,
      url: raw.url,
      externalId: raw.externalId,
      storeTitle: raw.title,
      priceOre: raw.priceOre,
      beforePriceOre: raw.beforePriceOre,
      shippingOre: raw.shippingOre,
      stockStatus: raw.stockStatus,
      deliveryDaysMin: raw.deliveryDaysMin,
      deliveryDaysMax: raw.deliveryDaysMax,
    });
    seenOfferIds.push(offer.id);
  }

  // Ved en full kjøring er tilbud vi ikke så lenger borte fra butikken.
  if (!options.dryRun && options.limit == null && stats.fetched > 0) {
    const res = await prisma.offer.updateMany({
      where: { storeId: store.id, active: true, id: { notIn: seenOfferIds }, lastCheckedAt: { lt: startedAt } },
      data: { active: false },
    });
    stats.deactivated = res.count;
  }
  if (!options.dryRun) await prisma.store.update({ where: { id: store.id }, data: { dataSource: adapter.source } });
  return stats;
}
