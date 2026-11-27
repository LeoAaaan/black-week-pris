import type { StockStatus } from '@bwp/shared';

/** Hvor dataene kommer fra, i prioritert rekkefølge. */
export type DataSource = 'api' | 'feed' | 'jsonld' | 'scrape';

/** Et tilbud slik en adapter leverer det, før det er koblet til et produkt. */
export interface RawOffer {
  storeSlug: string;
  url: string;
  /** Butikkens egen produkt-ID/SKU. */
  externalId: string | null;
  title: string;
  brand: string | null;
  gtin: string | null;
  modelNumber: string | null;
  imageUrl: string | null;
  category: string | null;
  priceOre: number;
  beforePriceOre: number | null;
  /** null = ukjent, 0 = gratis. */
  shippingOre: number | null;
  stockStatus: StockStatus;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
}

/** Felles grensesnitt for alle butikker. En ny butikk = én ny fil som implementerer dette. */
export interface StoreAdapter {
  storeSlug: string;
  source: DataSource;
  /** Henter tilbud. `limit` begrenser antall produkter (nyttig ved testing). */
  fetchOffers(options?: { limit?: number }): AsyncIterable<RawOffer>;
}
