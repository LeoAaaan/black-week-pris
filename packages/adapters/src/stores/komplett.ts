import { createJsonLdAdapter } from '../jsonld-adapter';

/**
 * Komplett via JSON-LD på produktsidene.
 * UVERIFISERT: URL-mønster og frakt må sjekkes mot ekte sider før bruk
 * (kjør `pnpm --filter @bwp/adapters run-store komplett --limit 5 --dry-run`).
 */
export const komplett = () =>
  createJsonLdAdapter({
    storeSlug: 'komplett',
    origin: 'https://www.komplett.no',
    productUrlPattern: /\/product\/\d+/,
    sitemapFilter: /product/i,
    defaultShippingOre: 9900,
  });
