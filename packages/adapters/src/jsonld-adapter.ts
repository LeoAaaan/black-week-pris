import { PoliteHttpClient, RobotsDisallowedError } from './http';
import { parseProductFromHtml } from './jsonld';
import { parseSitemap } from './sitemap';
import type { RawOffer, StoreAdapter } from './types';

export interface JsonLdStoreConfig {
  storeSlug: string;
  /** F.eks. https://www.komplett.no */
  origin: string;
  /** Hvilke adresser i sitemapene som er produktsider. */
  productUrlPattern: RegExp;
  /** Hvilke sitemaper som er verdt å åpne (f.eks. bare produktsitemaper). Standard: alle. */
  sitemapFilter?: RegExp;
  /** Sitemaper i tillegg til dem robots.txt oppgir. */
  extraSitemaps?: string[];
  /** Brukes når siden ikke oppgir frakt. */
  defaultShippingOre?: number | null;
  freeShippingFromOre?: number | null;
}

/**
 * Generisk adapter for butikker med schema.org-data på produktsidene.
 * Finner produktsider via sitemapene i robots.txt, og leser hver side høflig.
 */
export function createJsonLdAdapter(cfg: JsonLdStoreConfig, http = new PoliteHttpClient()): StoreAdapter {
  async function* productUrls(): AsyncGenerator<string> {
    const robots = await http.robotsFor(cfg.origin);
    const queue = [...robots.sitemaps, ...(cfg.extraSitemaps ?? [])];
    const seen = new Set<string>();
    while (queue.length) {
      const sm = queue.shift()!;
      if (seen.has(sm)) continue;
      seen.add(sm);
      let xml: string;
      try {
        xml = await http.getText(sm);
      } catch (e) {
        console.warn(`[${cfg.storeSlug}] hopper over sitemap ${sm}: ${(e as Error).message}`);
        continue;
      }
      const { urls, sitemaps } = parseSitemap(xml);
      queue.push(...sitemaps.filter((s) => !cfg.sitemapFilter || cfg.sitemapFilter.test(s)));
      for (const u of urls) if (cfg.productUrlPattern.test(u)) yield u;
    }
  }

  return {
    storeSlug: cfg.storeSlug,
    source: 'jsonld',
    async *fetchOffers({ limit } = {}) {
      let count = 0;
      for await (const url of productUrls()) {
        if (limit != null && count >= limit) return;
        let html: string;
        try {
          html = await http.getText(url);
        } catch (e) {
          if (!(e instanceof RobotsDisallowedError)) console.warn(`[${cfg.storeSlug}] ${url}: ${(e as Error).message}`);
          continue;
        }
        const offer = toRawOffer(cfg, url, html);
        if (offer) {
          count++;
          yield offer;
        }
      }
    },
  };
}

export function toRawOffer(cfg: JsonLdStoreConfig, url: string, html: string): RawOffer | null {
  const p = parseProductFromHtml(html);
  if (!p) return null;
  let shippingOre = p.shippingOre;
  if (shippingOre == null && cfg.freeShippingFromOre != null && p.priceOre >= cfg.freeShippingFromOre) shippingOre = 0;
  if (shippingOre == null) shippingOre = cfg.defaultShippingOre ?? null;
  return {
    storeSlug: cfg.storeSlug,
    url,
    externalId: p.sku,
    title: p.name,
    brand: p.brand,
    gtin: p.gtin,
    modelNumber: p.mpn,
    imageUrl: p.image,
    category: p.category,
    priceOre: p.priceOre,
    beforePriceOre: p.beforePriceOre,
    shippingOre,
    stockStatus: p.stockStatus,
    deliveryDaysMin: p.deliveryDaysMin,
    deliveryDaysMax: p.deliveryDaysMax,
  };
}
