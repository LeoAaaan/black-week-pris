import { createJsonLdAdapter } from '../jsonld-adapter';

/** Elkjøp via JSON-LD. UVERIFISERT mot ekte sider, se komplett.ts. */
export const elkjop = () =>
  createJsonLdAdapter({
    storeSlug: 'elkjop',
    origin: 'https://www.elkjop.no',
    productUrlPattern: /\/product\//,
    sitemapFilter: /product/i,
    defaultShippingOre: 9900,
    freeShippingFromOre: 100000,
  });
