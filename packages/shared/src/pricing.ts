import type { DealCheck, Ore } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Totalpris = varepris + frakt. Ukjent frakt (null) regnes som 0, men vises som ukjent i UI. */
export function totalPrice(priceOre: Ore, shippingOre: Ore | null): Ore {
  return priceOre + (shippingOre ?? 0);
}

export interface Discount {
  ore: Ore;
  /** Hele prosent, avrundet. */
  pct: number;
}

/** Rabatt i kr og prosent ut fra førpris. Ingen rabatt hvis førpris mangler eller ikke er høyere. */
export function discount(priceOre: Ore, beforePriceOre: Ore | null): Discount {
  if (beforePriceOre == null || beforePriceOre <= 0 || beforePriceOre <= priceOre) {
    return { ore: 0, pct: 0 };
  }
  const ore = beforePriceOre - priceOre;
  return { ore, pct: Math.round((ore / beforePriceOre) * 100) };
}

export function isFreeShipping(shippingOre: Ore | null): boolean {
  return shippingOre === 0;
}

export interface PricePoint {
  priceOre: Ore;
  recordedAt: Date;
}

export interface DealCheckInput {
  priceOre: Ore;
  beforePriceOre: Ore | null;
  /** Når nåprisen trådte i kraft. Vinduet er de 30 dagene før dette. */
  currentSince: Date;
  /**
   * Prishistorikk for tilbudet. Hver rad er prisen fra og med `recordedAt`
   * til neste rad. Rekkefølgen spiller ingen rolle.
   */
  history: PricePoint[];
  windowDays?: number;
  /** Hvor mye høyere førprisen kan være enn 30-dagerslaveste før vi flagger den. */
  inflatedTolerance?: number;
}

/**
 * Laveste pris som var gjeldende i perioden [from, to).
 * Tar med prisen som allerede gjaldt ved `from` (siste rad før vinduet).
 */
export function lowestPriceInWindow(history: PricePoint[], from: Date, to: Date): Ore | null {
  const sorted = [...history].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  let lowest: Ore | null = null;
  let inEffectAtStart: PricePoint | null = null;

  for (const point of sorted) {
    const t = point.recordedAt.getTime();
    if (t < from.getTime()) {
      inEffectAtStart = point;
    } else if (t < to.getTime()) {
      lowest = lowest == null ? point.priceOre : Math.min(lowest, point.priceOre);
    }
  }
  if (inEffectAtStart) {
    lowest = lowest == null ? inEffectAtStart.priceOre : Math.min(lowest, inEffectAtStart.priceOre);
  }
  return lowest;
}

/**
 * «Ekte tilbud?»: sammenligner nåprisen med laveste pris de siste 30 dagene
 * før nåprisen startet, og sjekker om førprisen butikken oppgir er rimelig.
 */
export function checkDeal(input: DealCheckInput): DealCheck {
  const windowDays = input.windowDays ?? 30;
  const tolerance = input.inflatedTolerance ?? 0.01;
  const to = input.currentSince;
  const from = new Date(to.getTime() - windowDays * DAY_MS);
  const lowest30Ore = lowestPriceInWindow(input.history, from, to);

  return dealFromLowest(input.priceOre, input.beforePriceOre, lowest30Ore, tolerance);
}

/**
 * Samme vurdering som checkDeal, men når laveste 30-dagerspris allerede er regnet ut
 * (den lagres på tilbudet ved hver prisendring, så API-et slipper å lese historikken).
 */
export function dealFromLowest(
  priceOre: Ore,
  beforePriceOre: Ore | null,
  lowest30Ore: Ore | null,
  tolerance = 0.01,
): DealCheck {
  if (lowest30Ore == null) {
    return { verdict: 'unknown', lowest30Ore: null, inflatedBeforePrice: false };
  }
  const verdict = priceOre < lowest30Ore ? 'real' : priceOre === lowest30Ore ? 'same' : 'not_real';
  const inflatedBeforePrice = beforePriceOre != null && beforePriceOre > lowest30Ore * (1 + tolerance);
  return { verdict, lowest30Ore, inflatedBeforePrice };
}
