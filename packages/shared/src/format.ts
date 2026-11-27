import type { DealVerdict, Ore, StockStatus } from './types';

/** Hardt mellomrom, så «1 299 kr» ikke brytes over to linjer. */
const NBSP = ' ';

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/**
 * Norsk kroneformat: 129900 → «1 299 kr», 129950 → «1 299,50 kr».
 * Skrevet for hånd fordi Intl ikke er fullt støttet i alle React Native-motorer.
 */
export function formatNok(ore: Ore): string {
  const negative = ore < 0;
  const abs = Math.abs(Math.round(ore));
  const kroner = Math.floor(abs / 100);
  const rest = abs % 100;
  const amount = rest === 0 ? groupThousands(kroner) : `${groupThousands(kroner)},${String(rest).padStart(2, '0')}`;
  return `${negative ? '−' : ''}${amount}${NBSP}kr`;
}

export function formatPercent(pct: number): string {
  return `${pct}${NBSP}%`;
}

export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'akkurat nå';
  if (min < 60) return `for ${min} min siden`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `for ${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'i går';
  return `for ${days} dager siden`;
}

export function formatDelivery(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  if (lo === 0 && hi === 0) return 'Hent i dag';
  if (lo === hi) return lo === 1 ? '1 dag' : `${lo} dager`;
  return `${lo}–${hi} dager`;
}

export function formatShipping(shippingOre: Ore | null): string {
  if (shippingOre == null) return 'Frakt ukjent';
  if (shippingOre === 0) return 'Gratis frakt';
  return `Frakt ${formatNok(shippingOre)}`;
}

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: 'På lager',
  low_stock: 'Få igjen',
  out_of_stock: 'Ikke på lager',
  preorder: 'Forhåndsbestilling',
  unknown: 'Lagerstatus ukjent',
};

export const DEAL_LABELS: Record<DealVerdict, string> = {
  real: 'Ekte tilbud',
  same: 'Samme som laveste pris siste 30 dager',
  not_real: 'Har vært billigere siste 30 dager',
  unknown: 'For lite prishistorikk',
};
