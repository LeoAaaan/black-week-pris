/** Alle beløp er heltall i øre for å unngå avrundingsfeil. 1 kr = 100 øre. */
export type Ore = number;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder' | 'unknown';

export type DealVerdict =
  /** Nåprisen er lavere enn laveste pris de siste 30 dagene før tilbudet. */
  | 'real'
  /** Nåprisen er lik laveste pris de siste 30 dagene. */
  | 'same'
  /** Produktet har vært billigere de siste 30 dagene. */
  | 'not_real'
  /** For lite prishistorikk til å si noe. */
  | 'unknown';

export interface DealCheck {
  verdict: DealVerdict;
  /** Laveste pris i 30-dagersvinduet før nåprisen startet. */
  lowest30Ore: Ore | null;
  /** Førprisen butikken oppgir er høyere enn laveste pris siste 30 dager. */
  inflatedBeforePrice: boolean;
}

export interface StoreRef {
  slug: string;
  name: string;
}

export interface OfferDTO {
  id: string;
  store: StoreRef;
  url: string;
  priceOre: Ore;
  beforePriceOre: Ore | null;
  /** null = ukjent frakt, 0 = gratis frakt. */
  shippingOre: Ore | null;
  totalOre: Ore;
  discountOre: Ore;
  discountPct: number;
  stockStatus: StockStatus;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  /** Når butikken begynte med nåprisen (ISO). */
  priceChangedAt: string;
  /** Når vi sist sjekket prisen hos butikken (ISO). */
  lastCheckedAt: string;
  dealCheck: DealCheck;
}

export interface CategoryRef {
  slug: string;
  name: string;
}

export interface ProductSummaryDTO {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategoryRef;
  imageUrl: string | null;
  offerCount: number;
  bestOffer: OfferDTO;
}

export interface PricePointDTO {
  priceOre: Ore;
  recordedAt: string;
}

export interface ProductDetailDTO {
  id: string;
  slug: string;
  name: string;
  brand: string;
  modelNumber: string | null;
  gtins: string[];
  category: CategoryRef;
  imageUrl: string | null;
  offers: OfferDTO[];
  /** Laveste pris på tvers av butikker per dag, siste 60 dager. */
  lowestPriceHistory: PricePointDTO[];
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface SearchResponseDTO {
  query: string;
  total: number;
  results: ProductSummaryDTO[];
  facets: {
    stores: FacetValue[];
    brands: FacetValue[];
    categories: FacetValue[];
  };
}

export interface SuggestionDTO {
  slug: string;
  name: string;
  brand: string;
  lowestPriceOre: Ore | null;
}
