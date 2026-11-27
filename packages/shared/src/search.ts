import type { FacetValue, OfferDTO } from './types';
import { isFreeShipping } from './pricing';

export type SortKey = 'price' | 'discount' | 'newest';

export const SORT_LABELS: Record<SortKey, string> = {
  price: 'Lavest totalpris',
  discount: 'Størst rabatt',
  newest: 'Nyeste tilbud',
};

export interface SearchFilters {
  q: string;
  /** Prisintervall på totalpris, i hele kroner (slik brukeren skriver det). */
  minPrice?: number;
  maxPrice?: number;
  stores: string[];
  category?: string;
  brands: string[];
  inStock: boolean;
  /** Minste rabatt i prosent. */
  minDiscount?: number;
  freeShipping: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  stores: [],
  brands: [],
  inStock: false,
  freeShipping: false,
  sort: 'price',
};

function positiveInt(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

function list(value: string | null): string[] {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/** Leser filtre fra en URL (?q=ps5&stores=elkjop,power&inStock=1&sort=discount). */
export function parseSearchParams(params: URLSearchParams): SearchFilters {
  const sort = params.get('sort');
  return {
    q: (params.get('q') ?? '').trim(),
    minPrice: positiveInt(params.get('minPrice')),
    maxPrice: positiveInt(params.get('maxPrice')),
    stores: list(params.get('stores')),
    category: params.get('category') || undefined,
    brands: list(params.get('brands')),
    inStock: params.get('inStock') === '1',
    minDiscount: positiveInt(params.get('minDiscount')),
    freeShipping: params.get('freeShipping') === '1',
    sort: sort === 'discount' || sort === 'newest' ? sort : 'price',
  };
}

export function toSearchParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.minPrice != null) p.set('minPrice', String(f.minPrice));
  if (f.maxPrice != null) p.set('maxPrice', String(f.maxPrice));
  if (f.stores.length) p.set('stores', f.stores.join(','));
  if (f.category) p.set('category', f.category);
  if (f.brands.length) p.set('brands', f.brands.join(','));
  if (f.inStock) p.set('inStock', '1');
  if (f.minDiscount) p.set('minDiscount', String(f.minDiscount));
  if (f.freeShipping) p.set('freeShipping', '1');
  if (f.sort !== 'price') p.set('sort', f.sort);
  return p;
}

/** Antall aktive filtre (uten søk og sortering), til «Filter (3)»-knappen. */
export function countActiveFilters(f: SearchFilters): number {
  return (
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.stores.length ? 1 : 0) +
    (f.category ? 1 : 0) +
    (f.brands.length ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.minDiscount ? 1 : 0) +
    (f.freeShipping ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Filtrering og sortering
// ---------------------------------------------------------------------------

export interface SearchableProduct<O extends OfferDTO = OfferDTO> {
  id: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  /** Tekstrelevans fra søket, 0–1. 1 når det ikke er søkt. */
  relevance: number;
  offers: O[];
}

export interface FilteredProduct<O extends OfferDTO = OfferDTO> {
  product: SearchableProduct<O>;
  matchingOffers: O[];
  bestOffer: O;
}

export function offerMatches(offer: OfferDTO, f: SearchFilters): boolean {
  if (f.stores.length && !f.stores.includes(offer.store.slug)) return false;
  if (f.inStock && offer.stockStatus !== 'in_stock' && offer.stockStatus !== 'low_stock') return false;
  if (f.freeShipping && !isFreeShipping(offer.shippingOre)) return false;
  if (f.minDiscount && offer.discountPct < f.minDiscount) return false;
  if (f.minPrice != null && offer.totalOre < f.minPrice * 100) return false;
  if (f.maxPrice != null && offer.totalOre > f.maxPrice * 100) return false;
  return true;
}

/** Billigste tilbud målt i totalpris; ved likhet vinner det som er på lager. */
export function cheapestOffer<O extends OfferDTO>(offers: O[]): O | undefined {
  const stockRank = (o: OfferDTO) => (o.stockStatus === 'in_stock' || o.stockStatus === 'low_stock' ? 0 : 1);
  return [...offers].sort((a, b) => a.totalOre - b.totalOre || stockRank(a) - stockRank(b))[0];
}

/**
 * Bruker filtrene på produkter og tilbud, og sorterer resultatet.
 * Et produkt vises bare hvis minst ett tilbud passer filtrene, og «beste tilbud»
 * er det billigste av tilbudene som passer.
 */
export function filterAndSort<O extends OfferDTO>(
  products: SearchableProduct<O>[],
  f: SearchFilters,
): FilteredProduct<O>[] {
  const out: FilteredProduct<O>[] = [];
  for (const product of products) {
    if (f.category && product.categorySlug !== f.category) continue;
    if (f.brands.length && !f.brands.includes(product.brand)) continue;
    const matchingOffers = product.offers.filter((o) => offerMatches(o, f));
    const bestOffer = cheapestOffer(matchingOffers);
    if (!bestOffer) continue;
    out.push({ product, matchingOffers, bestOffer });
  }

  const newest = (p: FilteredProduct<O>) =>
    Math.max(...p.matchingOffers.map((o) => new Date(o.priceChangedAt).getTime()));

  // Ved søk vektes relevans først i grove trinn, så sorteringen ikke sender
  // et tilfeldig tilbehør foran produktet brukeren faktisk søkte etter.
  const relevanceBucket = (p: FilteredProduct<O>) => (f.q ? Math.round(p.product.relevance * 4) : 0);

  return out.sort((a, b) => {
    const rel = relevanceBucket(b) - relevanceBucket(a);
    if (rel !== 0) return rel;
    switch (f.sort) {
      case 'discount':
        return b.bestOffer.discountPct - a.bestOffer.discountPct || a.bestOffer.totalOre - b.bestOffer.totalOre;
      case 'newest':
        return newest(b) - newest(a) || a.bestOffer.totalOre - b.bestOffer.totalOre;
      default:
        return a.bestOffer.totalOre - b.bestOffer.totalOre;
    }
  });
}

/** Teller verdier til filterpanelet. */
export function buildFacets<O extends OfferDTO>(products: SearchableProduct<O>[]) {
  const stores = new Map<string, FacetValue>();
  const brands = new Map<string, FacetValue>();
  const categories = new Map<string, FacetValue>();
  const bump = (m: Map<string, FacetValue>, value: string, label: string) => {
    const cur = m.get(value);
    if (cur) cur.count++;
    else m.set(value, { value, label, count: 1 });
  };
  for (const p of products) {
    bump(brands, p.brand, p.brand);
    bump(categories, p.categorySlug, p.categoryName);
    for (const slug of new Set(p.offers.map((o) => o.store.slug))) {
      const name = p.offers.find((o) => o.store.slug === slug)!.store.name;
      bump(stores, slug, name);
    }
  }
  const sorted = (m: Map<string, FacetValue>) =>
    [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'nb'));
  return { stores: sorted(stores), brands: sorted(brands), categories: sorted(categories) };
}

