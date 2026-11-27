import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, filterAndSort, parseSearchParams, toSearchParams, type SearchableProduct, type SearchFilters } from './search';
import type { OfferDTO } from './types';

function offer(partial: Omit<Partial<OfferDTO>, 'store'> & { store: string; price: number }): OfferDTO {
  const { store, price, ...rest } = partial;
  return {
    id: `${store}-${price}`,
    store: { slug: store, name: store },
    url: 'https://example.com',
    priceOre: price,
    beforePriceOre: null,
    shippingOre: 0,
    totalOre: price + (rest.shippingOre ?? 0),
    discountOre: 0,
    discountPct: 0,
    stockStatus: 'in_stock',
    deliveryDaysMin: 1,
    deliveryDaysMax: 3,
    priceChangedAt: '2026-11-20T00:00:00Z',
    lastCheckedAt: '2026-11-27T00:00:00Z',
    dealCheck: { verdict: 'unknown', lowest30Ore: null, inflatedBeforePrice: false },
    ...rest,
  };
}

const products: SearchableProduct[] = [
  {
    id: 'ps5',
    brand: 'Sony',
    categorySlug: 'gaming',
    categoryName: 'Gaming',
    relevance: 1,
    offers: [
      offer({ store: 'elkjop', price: 549000, discountPct: 10 }),
      offer({ store: 'power', price: 539000, shippingOre: 9900, totalOre: 548900, discountPct: 12 }),
      offer({ store: 'komplett', price: 529000, stockStatus: 'out_of_stock', discountPct: 15 }),
    ],
  },
  {
    id: 'airpods',
    brand: 'Apple',
    categorySlug: 'lyd',
    categoryName: 'Lyd',
    relevance: 1,
    offers: [
      offer({ store: 'elkjop', price: 229000, discountPct: 30, priceChangedAt: '2026-11-26T00:00:00Z' }),
      offer({ store: 'power', price: 239000, discountPct: 25 }),
    ],
  },
];

const f = (over: Partial<SearchFilters>): SearchFilters => ({ ...DEFAULT_FILTERS, ...over });

describe('filterAndSort', () => {
  it('sorterer på totalpris som standard og velger billigste tilbud', () => {
    const r = filterAndSort(products, f({}));
    expect(r.map((p) => p.product.id)).toEqual(['airpods', 'ps5']);
    expect(r[1]!.bestOffer.store.slug).toBe('komplett');
  });

  it('på lager fjerner utsolgte tilbud fra beste pris', () => {
    const r = filterAndSort(products, f({ inStock: true }));
    // Power 539000 + 9900 frakt = 548900, billigere enn Elkjøp 549000
    expect(r.find((p) => p.product.id === 'ps5')!.bestOffer.store.slug).toBe('power');
  });

  it('gratis frakt', () => {
    const r = filterAndSort(products, f({ inStock: true, freeShipping: true }));
    expect(r.find((p) => p.product.id === 'ps5')!.bestOffer.store.slug).toBe('elkjop');
  });

  it('butikkfilter', () => {
    const r = filterAndSort(products, f({ stores: ['power'] }));
    expect(r.every((p) => p.bestOffer.store.slug === 'power')).toBe(true);
  });

  it('merke og kategori', () => {
    expect(filterAndSort(products, f({ brands: ['Apple'] })).map((p) => p.product.id)).toEqual(['airpods']);
    expect(filterAndSort(products, f({ category: 'gaming' })).map((p) => p.product.id)).toEqual(['ps5']);
  });

  it('prisintervall på totalpris i hele kroner', () => {
    expect(filterAndSort(products, f({ maxPrice: 3000 })).map((p) => p.product.id)).toEqual(['airpods']);
    expect(filterAndSort(products, f({ minPrice: 5000 })).map((p) => p.product.id)).toEqual(['ps5']);
  });

  it('minste rabatt fjerner produkter uten nok rabatt', () => {
    expect(filterAndSort(products, f({ minDiscount: 20 })).map((p) => p.product.id)).toEqual(['airpods']);
  });

  it('sortering på rabatt og nyeste', () => {
    expect(filterAndSort(products, f({ sort: 'discount' }))[0]!.product.id).toBe('airpods');
    expect(filterAndSort(products, f({ sort: 'newest' }))[0]!.product.id).toBe('airpods');
  });

  it('relevans går foran pris ved søk', () => {
    const withRelevance = products.map((p) => ({ ...p, relevance: p.id === 'ps5' ? 1 : 0.3 }));
    expect(filterAndSort(withRelevance, f({ q: 'ps5' }))[0]!.product.id).toBe('ps5');
  });
});

describe('URL-parametre', () => {
  it('går fram og tilbake uten tap', () => {
    const filters = f({
      q: 'airpods',
      minPrice: 1000,
      maxPrice: 3000,
      stores: ['elkjop', 'power'],
      category: 'lyd',
      brands: ['Apple'],
      inStock: true,
      minDiscount: 20,
      freeShipping: true,
      sort: 'discount',
    });
    expect(parseSearchParams(toSearchParams(filters))).toEqual(filters);
  });

  it('ignorerer ugyldige verdier', () => {
    const r = parseSearchParams(new URLSearchParams('minPrice=abc&sort=tull&maxPrice=-5'));
    expect(r.minPrice).toBeUndefined();
    expect(r.maxPrice).toBeUndefined();
    expect(r.sort).toBe('price');
  });
});
