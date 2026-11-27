import type { Prisma } from '@prisma/client';
import {
  buildFacets,
  dealFromLowest,
  discount,
  filterAndSort,
  normalizeQuery,
  totalPrice,
  type OfferDTO,
  type PricePointDTO,
  type ProductDetailDTO,
  type SearchableProduct,
  type SearchFilters,
  type SearchResponseDTO,
  type SuggestionDTO,
} from '@bwp/shared';
import { prisma } from './client';

const DAY_MS = 24 * 60 * 60 * 1000;

type OfferWithStore = Prisma.OfferGetPayload<{ include: { store: true } }>;

export function toOfferDTO(o: OfferWithStore): OfferDTO {
  const d = discount(o.priceOre, o.beforePriceOre);
  return {
    id: o.id,
    store: { slug: o.store.slug, name: o.store.name },
    url: o.url,
    priceOre: o.priceOre,
    beforePriceOre: o.beforePriceOre,
    shippingOre: o.shippingOre,
    totalOre: totalPrice(o.priceOre, o.shippingOre),
    discountOre: d.ore,
    discountPct: d.pct,
    stockStatus: o.stockStatus,
    deliveryDaysMin: o.deliveryDaysMin,
    deliveryDaysMax: o.deliveryDaysMax,
    priceChangedAt: o.priceChangedAt.toISOString(),
    lastCheckedAt: o.lastCheckedAt.toISOString(),
    dealCheck: dealFromLowest(o.priceOre, o.beforePriceOre, o.lowest30Ore),
  };
}

interface TextHit {
  id: string;
  score: number;
}

/**
 * Tekstsøk som tåler skrivefeil, med trigram-likhet (pg_trgm).
 * Søket normaliseres likt med lagret tekst, så «elkjop», «airpod pro2» o.l. treffer.
 */
async function textSearch(q: string, limit: number): Promise<TextHit[]> {
  const nq = normalizeQuery(q);
  if (!nq) return [];
  const hits = await prisma.$queryRaw<TextHit[]>`
    SELECT id, score FROM (
      SELECT id,
        CASE WHEN "searchText" LIKE '%' || ${nq} || '%' THEN 1.0
             ELSE GREATEST(word_similarity(${nq}, "searchText"), similarity(${nq}, "searchText"))
        END::float AS score
      FROM "Product"
    ) s
    WHERE score >= 0.3
    ORDER BY score DESC
    LIMIT ${limit}
  `;
  // Når vi har gode treff, dropper vi de svake («airpods» skal ikke gi «iPad Air»).
  const top = hits[0]?.score ?? 0;
  return hits.filter((h) => h.score >= top * 0.6);
}

const searchInclude = {
  category: true,
  offers: { where: { active: true }, include: { store: true } },
} satisfies Prisma.ProductInclude;

export async function searchProducts(filters: SearchFilters, limit = 50): Promise<SearchResponseDTO> {
  let relevance = new Map<string, number>();
  let where: Prisma.ProductWhereInput = {};

  if (filters.q) {
    const hits = await textSearch(filters.q, 200);
    relevance = new Map(hits.map((h) => [h.id, h.score]));
    where = { id: { in: hits.map((h) => h.id) } };
  }

  const rows = await prisma.product.findMany({ where, include: searchInclude });

  const searchable: (SearchableProduct & { row: (typeof rows)[number] })[] = rows.map((row) => ({
    id: row.id,
    brand: row.brand,
    categorySlug: row.category.slug,
    categoryName: row.category.name,
    relevance: filters.q ? (relevance.get(row.id) ?? 0) : 1,
    offers: row.offers.map(toOfferDTO),
    row,
  }));

  const filtered = filterAndSort(searchable, filters);

  return {
    query: filters.q,
    total: filtered.length,
    results: filtered.slice(0, limit).map(({ product, matchingOffers, bestOffer }) => {
      const row = (product as (typeof searchable)[number]).row;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        brand: row.brand,
        category: { slug: row.category.slug, name: row.category.name },
        imageUrl: row.imageUrl,
        offerCount: matchingOffers.length,
        bestOffer,
      };
    }),
    facets: buildFacets(searchable),
  };
}

/** Autoforslag mens brukeren skriver. */
export async function suggest(q: string, limit = 8): Promise<SuggestionDTO[]> {
  const hits = await textSearch(q, limit);
  if (hits.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: hits.map((h) => h.id) } },
    include: { offers: { where: { active: true }, select: { priceOre: true, shippingOre: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return hits
    .map((h) => byId.get(h.id))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      brand: r.brand,
      lowestPriceOre: r.offers.length
        ? Math.min(...r.offers.map((o) => totalPrice(o.priceOre, o.shippingOre)))
        : null,
    }));
}

/**
 * Laveste pris på tvers av butikker for hver dag. Historikken er prisendringer,
 * så for hver dag brukes prisen som gjaldt ved slutten av dagen.
 */
export function dailyLowest(
  histories: { priceOre: number; recordedAt: Date }[][],
  from: Date,
  to: Date,
): PricePointDTO[] {
  const sorted = histories.map((h) => [...h].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()));
  const points: PricePointDTO[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let t = start; t <= to.getTime(); t += DAY_MS) {
    const endOfDay = Math.min(t + DAY_MS - 1, to.getTime());
    let lowest: number | null = null;
    for (const h of sorted) {
      let current: number | null = null;
      for (const p of h) {
        if (p.recordedAt.getTime() <= endOfDay) current = p.priceOre;
        else break;
      }
      if (current != null) lowest = lowest == null ? current : Math.min(lowest, current);
    }
    if (lowest != null) points.push({ priceOre: lowest, recordedAt: new Date(t).toISOString() });
  }
  return points;
}

export async function getProduct(slug: string, now = new Date()): Promise<ProductDetailDTO | null> {
  const row = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      identifiers: true,
      offers: {
        where: { active: true },
        include: { store: true, history: { orderBy: { recordedAt: 'asc' } } },
      },
    },
  });
  if (!row) return null;

  const offers = row.offers.map(toOfferDTO).sort((a, b) => a.totalOre - b.totalOre);
  const from = new Date(now.getTime() - 60 * DAY_MS);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    modelNumber: row.modelNumber,
    gtins: row.identifiers.filter((i) => i.type === 'GTIN').map((i) => i.value),
    category: { slug: row.category.slug, name: row.category.name },
    imageUrl: row.imageUrl,
    offers,
    lowestPriceHistory: dailyLowest(
      row.offers.map((o) => o.history),
      from,
      now,
    ),
  };
}
