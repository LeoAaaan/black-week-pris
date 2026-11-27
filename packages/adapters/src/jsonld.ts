import type { StockStatus } from '@bwp/shared';

/**
 * Leser schema.org-data (JSON-LD) fra en produktside.
 * De fleste nettbutikker legger dette inn for Google Shopping, så én tolker
 * dekker mange butikker uten skjør HTML-scraping.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: Json | undefined): Json[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function hasType(o: Obj, type: string): boolean {
  return asArray(o['@type']).some((t) => typeof t === 'string' && t.replace(/^.*[/#]/, '') === type);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle JSON-LD-blokker på siden. Ugyldig JSON hoppes over. */
export function extractJsonLd(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1]!.trim();
    for (const candidate of [raw, decodeEntities(raw)]) {
      try {
        out.push(JSON.parse(candidate) as Json);
        break;
      } catch {
        /* prøv neste variant */
      }
    }
  }
  return out;
}

/** Går gjennom arrays og @graph og finner alle objekter av en gitt type. */
function findByType(nodes: Json[], type: string): Obj[] {
  const found: Obj[] = [];
  const visit = (n: Json | undefined) => {
    if (Array.isArray(n)) n.forEach(visit);
    else if (isObj(n)) {
      if (hasType(n, type)) found.push(n);
      if (n['@graph']) visit(n['@graph']);
    }
  };
  nodes.forEach(visit);
  return found;
}

/**
 * Tolker priser i ulike formater til øre:
 * 1299, "1299", "1299.00", "1 299,00", "1.299,-", "kr 1 299"
 */
export function parsePriceToOre(value: Json | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  if (typeof value !== 'string') return null;
  let s = value.replace(/kr|nok|,-|\.-/gi, '').replace(/[\s  ]/g, '');
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Den siste er desimalskilletegnet
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.length - lastComma - 1 === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot > -1 && s.length - lastDot - 1 === 3 && s.indexOf('.') !== lastDot) {
    s = s.replace(/\./g, '');
  } else if (lastDot > -1 && s.length - lastDot - 1 === 3) {
    // «1.299» er tusenskille i norsk format
    s = s.replace('.', '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function mapAvailability(value: Json | undefined): StockStatus {
  if (typeof value !== 'string') return 'unknown';
  const v = value.replace(/^.*[/#]/, '').toLowerCase();
  if (v === 'instock' || v === 'instoreonly' || v === 'onlineonly') return 'in_stock';
  if (v === 'limitedavailability') return 'low_stock';
  if (v === 'preorder' || v === 'presale' || v === 'backorder') return 'preorder';
  if (v === 'outofstock' || v === 'soldout' || v === 'discontinued') return 'out_of_stock';
  return 'unknown';
}

function text(v: Json | undefined): string | null {
  // Mange butikker HTML-koder tekst inne i JSON-en («&amp;»).
  if (typeof v === 'string') return decodeEntities(v).trim() || null;
  if (typeof v === 'number') return String(v);
  if (isObj(v) && typeof v.name === 'string') return v.name.trim() || null;
  if (Array.isArray(v)) return text(v[0]);
  return null;
}

function imageUrl(v: Json | undefined): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return imageUrl(v[0]);
  if (isObj(v)) return text(v.url) ?? text(v.contentUrl);
  return null;
}

export interface JsonLdProduct {
  name: string;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  sku: string | null;
  image: string | null;
  category: string | null;
  priceOre: number;
  beforePriceOre: number | null;
  shippingOre: number | null;
  stockStatus: StockStatus;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  url: string | null;
}

/** Førpris fra priceSpecification med priceType StrikethroughPrice/ListPrice (Googles anbefaling). */
function beforePrice(offer: Obj): number | null {
  for (const spec of asArray(offer.priceSpecification)) {
    if (!isObj(spec)) continue;
    const type = text(spec.priceType)?.replace(/^.*[/#]/, '');
    if (type === 'StrikethroughPrice' || type === 'ListPrice' || type === 'SRP') {
      return parsePriceToOre(spec.price);
    }
  }
  return null;
}

function currentPrice(offer: Obj): number | null {
  const direct = parsePriceToOre(offer.price) ?? parsePriceToOre(offer.lowPrice);
  if (direct != null) return direct;
  for (const spec of asArray(offer.priceSpecification)) {
    if (!isObj(spec)) continue;
    const type = text(spec.priceType)?.replace(/^.*[/#]/, '');
    if (!type || type === 'SalePrice') {
      const p = parsePriceToOre(spec.price);
      if (p != null) return p;
    }
  }
  return null;
}

function shipping(offer: Obj): { ore: number | null; min: number | null; max: number | null } {
  for (const sd of asArray(offer.shippingDetails)) {
    if (!isObj(sd)) continue;
    const rate = isObj(sd.shippingRate) ? sd.shippingRate : null;
    const ore = rate ? parsePriceToOre(rate.value) : null;
    let min: number | null = null;
    let max: number | null = null;
    const dt = isObj(sd.deliveryTime) ? sd.deliveryTime : null;
    if (dt) {
      const transit = isObj(dt.transitTime) ? dt.transitTime : null;
      const handling = isObj(dt.handlingTime) ? dt.handlingTime : null;
      const n = (o: Obj | null, k: string) => (o && typeof o[k] === 'number' ? (o[k] as number) : 0);
      if (transit || handling) {
        min = n(handling, 'minValue') + n(transit, 'minValue');
        max = n(handling, 'maxValue') + n(transit, 'maxValue');
      }
    }
    return { ore, min, max };
  }
  return { ore: null, min: null, max: null };
}

/** Plukker første offer i NOK (eller uten valuta) fra Offer/AggregateOffer. */
function pickOffer(product: Obj): Obj | null {
  const offers = asArray(product.offers).filter(isObj);
  const flat: Obj[] = [];
  for (const o of offers) {
    if (hasType(o, 'AggregateOffer') && o.offers) flat.push(...asArray(o.offers).filter(isObj));
    flat.push(o);
  }
  const nok = flat.filter((o) => {
    const c = text(o.priceCurrency);
    return !c || c.toUpperCase() === 'NOK';
  });
  return nok.find((o) => currentPrice(o) != null) ?? null;
}

/** Leser første produkt med gyldig NOK-pris fra en side. Returnerer null hvis siden mangler det. */
export function parseProductFromHtml(html: string): JsonLdProduct | null {
  const products = findByType(extractJsonLd(html), 'Product');
  for (const p of products) {
    const name = text(p.name);
    const offer = pickOffer(p);
    if (!name || !offer) continue;
    const priceOre = currentPrice(offer)!;
    const before = beforePrice(offer);
    const ship = shipping(offer);
    const gtin = text(p.gtin13) ?? text(p.gtin) ?? text(p.gtin14) ?? text(p.gtin12) ?? text(p.gtin8) ?? text(offer.gtin13) ?? text(offer.gtin);
    return {
      name,
      brand: text(p.brand) ?? text(p.manufacturer),
      gtin,
      mpn: text(p.mpn) ?? text(offer.mpn),
      sku: text(p.sku) ?? text(offer.sku) ?? text(p.productID),
      image: imageUrl(p.image),
      category: text(p.category),
      priceOre,
      beforePriceOre: before != null && before > priceOre ? before : null,
      shippingOre: ship.ore,
      stockStatus: mapAvailability(offer.availability),
      deliveryDaysMin: ship.min,
      deliveryDaysMax: ship.max,
      url: text(offer.url) ?? text(p.url),
    };
  }
  return null;
}
