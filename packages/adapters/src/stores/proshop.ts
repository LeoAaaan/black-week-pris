import { createJsonLdAdapter } from '../jsonld-adapter';

/** Proshop via JSON-LD. UVERIFISERT mot ekte sider, se komplett.ts. */
export const proshop = () =>
  createJsonLdAdapter({
    storeSlug: 'proshop',
    origin: 'https://www.proshop.no',
    productUrlPattern: /\/\d{5,}$/,
    sitemapFilter: /product/i,
    defaultShippingOre: 6900,
    freeShippingFromOre: 200000,
  });
