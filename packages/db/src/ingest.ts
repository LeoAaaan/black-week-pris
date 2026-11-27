import type { StockStatus } from '@prisma/client';
import { checkDeal } from '@bwp/shared';
import { prisma } from './client';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OfferUpdate {
  productId: string;
  storeId: string;
  url: string;
  externalId?: string | null;
  storeTitle?: string | null;
  priceOre: number;
  beforePriceOre: number | null;
  shippingOre: number | null;
  stockStatus: StockStatus;
  deliveryDaysMin?: number | null;
  deliveryDaysMax?: number | null;
}

/**
 * Lagrer et tilbud fra en butikk. Skriver en rad i PriceHistory bare når prisen
 * eller frakten endres, og regner ut laveste pris de siste 30 dagene på nytt.
 * Brukes av butikk-adapterne.
 */
export async function upsertOffer(u: OfferUpdate, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findUnique({
      where: { productId_storeId: { productId: u.productId, storeId: u.storeId } },
    });
    const priceChanged =
      !existing || existing.priceOre !== u.priceOre || existing.shippingOre !== u.shippingOre;
    const priceChangedAt = priceChanged ? now : existing!.priceChangedAt;

    const data = {
      url: u.url,
      externalId: u.externalId ?? null,
      storeTitle: u.storeTitle ?? null,
      priceOre: u.priceOre,
      beforePriceOre: u.beforePriceOre,
      shippingOre: u.shippingOre,
      stockStatus: u.stockStatus,
      deliveryDaysMin: u.deliveryDaysMin ?? null,
      deliveryDaysMax: u.deliveryDaysMax ?? null,
      lastCheckedAt: now,
      priceChangedAt,
      active: true,
    };

    const offer = existing
      ? await tx.offer.update({ where: { id: existing.id }, data })
      : await tx.offer.create({ data: { ...data, productId: u.productId, storeId: u.storeId, firstSeenAt: now } });

    if (priceChanged) {
      await tx.priceHistory.create({
        data: { offerId: offer.id, priceOre: u.priceOre, shippingOre: u.shippingOre, recordedAt: now },
      });
    }

    // Radene i 30-dagersvinduet, pluss prisen som allerede gjaldt da vinduet startet.
    const windowStart = new Date(priceChangedAt.getTime() - 30 * DAY_MS);
    const select = { priceOre: true, recordedAt: true } as const;
    const [inWindow, before] = await Promise.all([
      tx.priceHistory.findMany({ where: { offerId: offer.id, recordedAt: { gte: windowStart } }, select }),
      tx.priceHistory.findFirst({
        where: { offerId: offer.id, recordedAt: { lt: windowStart } },
        orderBy: { recordedAt: 'desc' },
        select,
      }),
    ]);
    const history = before ? [before, ...inWindow] : inWindow;
    const { lowest30Ore } = checkDeal({
      priceOre: u.priceOre,
      beforePriceOre: u.beforePriceOre,
      currentSince: priceChangedAt,
      history,
    });
    return tx.offer.update({ where: { id: offer.id }, data: { lowest30Ore } });
  });
}
