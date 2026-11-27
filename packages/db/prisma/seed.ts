/**
 * Mock-data: 8 norske butikker, ~30 produkter og 60 dager prishistorikk.
 * Alt er oppdiktet (priser, EAN-er og lagerstatus), men ser realistisk ut
 * slik at appen kan bygges og testes før ekte butikk-adaptere er på plass.
 *
 * Kjør: pnpm db:seed (sletter og fyller databasen på nytt)
 */
import { PrismaClient, type StockStatus } from '@prisma/client';
import { checkDeal, normalizeForSearch, slugify, type PricePoint } from '@bwp/shared';

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;

// Deterministisk tilfeldighet, så seed gir samme data hver gang.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261127);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

/** Lager en gyldig EAN-13 i 20–29-serien (reservert for intern bruk, så den kolliderer ikke med ekte varer). */
function fakeEan(n: number): string {
  const body = `20${String(n).padStart(10, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + ((10 - (sum % 10)) % 10);
}

/** Butikkpriser ender gjerne på 9 eller 90. */
function storePrice(kr: number): number {
  const rounded = kr >= 1000 ? Math.round(kr / 10) * 10 - 1 : Math.round(kr) - 1;
  return Math.max(rounded, 9) * 100;
}

const categories = [
  { slug: 'lyd', name: 'Lyd og hodetelefoner' },
  { slug: 'gaming', name: 'Gaming' },
  { slug: 'mobil', name: 'Mobil og nettbrett' },
  { slug: 'tv', name: 'TV' },
  { slug: 'pc', name: 'PC og tilbehør' },
  { slug: 'hjem', name: 'Hjem og kjøkken' },
];

interface StoreSeed {
  slug: string;
  name: string;
  websiteUrl: string;
  searchPath: string;
  categories: string[] | 'all';
  /** Butikkens prisnivå relativt til veiledende pris. */
  priceLevel: number;
  shippingOre: number;
  freeShippingFromOre: number | null;
}

const stores: StoreSeed[] = [
  { slug: 'elkjop', name: 'Elkjøp', websiteUrl: 'https://www.elkjop.no', searchPath: '/search?q=', categories: 'all', priceLevel: 1.0, shippingOre: 9900, freeShippingFromOre: 100000 },
  { slug: 'power', name: 'Power', websiteUrl: 'https://www.power.no', searchPath: '/search/?q=', categories: 'all', priceLevel: 0.98, shippingOre: 4900, freeShippingFromOre: 50000 },
  { slug: 'komplett', name: 'Komplett', websiteUrl: 'https://www.komplett.no', searchPath: '/search?q=', categories: ['lyd', 'gaming', 'mobil', 'tv', 'pc'], priceLevel: 0.97, shippingOre: 9900, freeShippingFromOre: null },
  { slug: 'netonnet', name: 'NetOnNet', websiteUrl: 'https://www.netonnet.no', searchPath: '/search?query=', categories: 'all', priceLevel: 0.95, shippingOre: 7900, freeShippingFromOre: 150000 },
  { slug: 'proshop', name: 'Proshop', websiteUrl: 'https://www.proshop.no', searchPath: '/?s=', categories: ['lyd', 'gaming', 'mobil', 'tv', 'pc'], priceLevel: 0.96, shippingOre: 6900, freeShippingFromOre: 200000 },
  { slug: 'multicom', name: 'Multicom', websiteUrl: 'https://www.multicom.no', searchPath: '/search?q=', categories: ['lyd', 'gaming', 'pc'], priceLevel: 0.99, shippingOre: 9900, freeShippingFromOre: 150000 },
  { slug: 'kjell', name: 'Kjell & Company', websiteUrl: 'https://www.kjell.com/no', searchPath: '/search?query=', categories: ['lyd', 'pc', 'hjem'], priceLevel: 1.02, shippingOre: 4900, freeShippingFromOre: 49900 },
  { slug: 'clasohlson', name: 'Clas Ohlson', websiteUrl: 'https://www.clasohlson.com/no', searchPath: '/search?text=', categories: ['lyd', 'hjem'], priceLevel: 1.03, shippingOre: 6900, freeShippingFromOre: 60000 },
];

interface ProductSeed {
  brand: string;
  name: string;
  category: string;
  /** Veiledende pris i hele kroner. */
  basePrice: number;
  modelNumber?: string;
}

const products: ProductSeed[] = [
  // Lyd
  { brand: 'Apple', name: 'AirPods Pro 2 (USB-C)', category: 'lyd', basePrice: 2990, modelNumber: 'MTJV3DN/A' },
  { brand: 'Apple', name: 'AirPods 4 med aktiv støydemping', category: 'lyd', basePrice: 2190, modelNumber: 'MXP93DN/A' },
  { brand: 'Sony', name: 'WH-1000XM5 trådløse hodetelefoner', category: 'lyd', basePrice: 4490, modelNumber: 'WH1000XM5B' },
  { brand: 'Sony', name: 'WH-1000XM6 trådløse hodetelefoner', category: 'lyd', basePrice: 4990, modelNumber: 'WH1000XM6B' },
  { brand: 'Bose', name: 'QuietComfort Ultra Earbuds', category: 'lyd', basePrice: 3290 },
  { brand: 'Samsung', name: 'Galaxy Buds3 Pro', category: 'lyd', basePrice: 2790, modelNumber: 'SM-R630' },
  { brand: 'JBL', name: 'Flip 6 bærbar høyttaler', category: 'lyd', basePrice: 1390 },
  { brand: 'Sonos', name: 'Era 100 smarthøyttaler', category: 'lyd', basePrice: 2790 },
  // Gaming
  { brand: 'Sony', name: 'PlayStation 5 Slim', category: 'gaming', basePrice: 6490, modelNumber: 'CFI-2016' },
  { brand: 'Sony', name: 'PlayStation 5 Slim Digital Edition', category: 'gaming', basePrice: 5490, modelNumber: 'CFI-2016B' },
  { brand: 'Sony', name: 'PlayStation 5 Pro', category: 'gaming', basePrice: 8990, modelNumber: 'CFI-7016' },
  { brand: 'Sony', name: 'DualSense trådløs kontroller', category: 'gaming', basePrice: 849 },
  { brand: 'Nintendo', name: 'Switch 2', category: 'gaming', basePrice: 5490 },
  { brand: 'Microsoft', name: 'Xbox Series X 1 TB', category: 'gaming', basePrice: 5990 },
  { brand: 'Meta', name: 'Quest 3S 128 GB', category: 'gaming', basePrice: 3490 },
  // Mobil og nettbrett
  { brand: 'Apple', name: 'iPhone 17 256 GB', category: 'mobil', basePrice: 11990 },
  { brand: 'Samsung', name: 'Galaxy S25 128 GB', category: 'mobil', basePrice: 9990, modelNumber: 'SM-S931B' },
  { brand: 'Google', name: 'Pixel 10 128 GB', category: 'mobil', basePrice: 9490 },
  { brand: 'Apple', name: 'iPad Air 11" M3 128 GB Wi-Fi', category: 'mobil', basePrice: 7490 },
  { brand: 'Garmin', name: 'Forerunner 265 GPS-klokke', category: 'mobil', basePrice: 4290 },
  // TV
  { brand: 'LG', name: '55" OLED C5 4K Smart-TV', category: 'tv', basePrice: 16990, modelNumber: 'OLED55C54LA' },
  { brand: 'Samsung', name: '55" QLED Q80D 4K Smart-TV', category: 'tv', basePrice: 12990, modelNumber: 'QE55Q80DATXXC' },
  { brand: 'Samsung', name: '65" Crystal UHD DU7175 4K Smart-TV', category: 'tv', basePrice: 7990, modelNumber: 'UE65DU7175UXXC' },
  { brand: 'Sony', name: '55" Bravia 7 Mini LED 4K', category: 'tv', basePrice: 13990, modelNumber: 'K55XR70' },
  // PC
  { brand: 'Apple', name: 'MacBook Air 13" M4 16 GB / 256 GB', category: 'pc', basePrice: 13990 },
  { brand: 'Lenovo', name: 'IdeaPad Slim 5 14" Ryzen 7 16 GB / 512 GB', category: 'pc', basePrice: 9990 },
  { brand: 'Logitech', name: 'MX Master 3S trådløs mus', category: 'pc', basePrice: 1290, modelNumber: '910-006559' },
  { brand: 'Samsung', name: '990 PRO 2 TB NVMe SSD', category: 'pc', basePrice: 2190, modelNumber: 'MZ-V9P2T0BW' },
  // Hjem
  { brand: 'Dyson', name: 'V15 Detect Absolute støvsuger', category: 'hjem', basePrice: 7990 },
  { brand: 'Philips', name: 'Airfryer XXL 7,2 l', category: 'hjem', basePrice: 2490, modelNumber: 'HD9285/90' },
  { brand: 'Roborock', name: 'Q8 Max robotstøvsuger', category: 'hjem', basePrice: 4990 },
  { brand: 'Moccamaster', name: 'KBG Select kaffetrakter', category: 'hjem', basePrice: 2990 },
  { brand: 'Philips Hue', name: 'White and Color Ambiance startpakke E27', category: 'hjem', basePrice: 1490 },
];

type Scenario = 'real' | 'fake' | 'normal' | 'new';

interface GeneratedOffer {
  history: PricePoint[];
  priceOre: number;
  beforePriceOre: number | null;
  priceChangedAt: Date;
}

/**
 * Lager prishistorikk for ett tilbud over 60 dager:
 * - real:   stabil pris, så et ekte kutt når Black Week starter
 * - fake:   prisen heves noen uker før, så «rabatteres» tilbake til omtrent vanlig pris
 * - normal: små svingninger, ingen kampanje
 * - new:    tilbudet er nytt, med for lite historikk
 */
function generateOffer(regularOre: number, scenario: Scenario, now: Date, bwStart: Date): GeneratedOffer {
  const start = new Date(now.getTime() - 60 * DAY_MS);
  const history: PricePoint[] = [{ priceOre: regularOre, recordedAt: start }];
  const regularKr = regularOre / 100;

  // Litt prisstøy før kampanjen
  if (scenario !== 'new') {
    const t = new Date(start.getTime() + between(10, 30) * DAY_MS);
    history.push({ priceOre: storePrice(regularKr * between(0.97, 1.03)), recordedAt: t });
  }

  switch (scenario) {
    case 'real': {
      const cut = storePrice(regularKr * between(0.7, 0.88));
      const at = new Date(bwStart.getTime() + between(0, 3) * DAY_MS);
      history.push({ priceOre: cut, recordedAt: at });
      return { history, priceOre: cut, beforePriceOre: regularOre, priceChangedAt: at };
    }
    case 'fake': {
      const inflated = storePrice(regularKr * between(1.15, 1.3));
      history.push({ priceOre: inflated, recordedAt: new Date(bwStart.getTime() - between(10, 20) * DAY_MS) });
      const sale = storePrice(regularKr * between(0.98, 1.04));
      const at = new Date(bwStart.getTime() + between(0, 2) * DAY_MS);
      history.push({ priceOre: sale, recordedAt: at });
      return { history, priceOre: sale, beforePriceOre: inflated, priceChangedAt: at };
    }
    case 'new': {
      const at = new Date(now.getTime() - between(0.2, 2) * DAY_MS);
      const price = storePrice(regularKr * between(0.85, 0.95));
      return {
        history: [{ priceOre: price, recordedAt: at }],
        priceOre: price,
        beforePriceOre: regularOre,
        priceChangedAt: at,
      };
    }
    default: {
      const last = history[history.length - 1]!;
      return { history, priceOre: last.priceOre, beforePriceOre: null, priceChangedAt: last.recordedAt };
    }
  }
}

function stockAndDelivery(): { stockStatus: StockStatus; min: number | null; max: number | null } {
  const r = rand();
  if (r < 0.62) return { stockStatus: 'in_stock', min: 1, max: pick([2, 3, 4]) };
  if (r < 0.77) return { stockStatus: 'low_stock', min: 1, max: 3 };
  if (r < 0.9) return { stockStatus: 'out_of_stock', min: null, max: null };
  if (r < 0.95) return { stockStatus: 'preorder', min: 10, max: 21 };
  return { stockStatus: 'unknown', min: null, max: null };
}

async function main() {
  const now = new Date();
  // Black Week startet fredagen før Black Friday
  const bwStart = new Date(now.getTime() - 7 * DAY_MS);

  console.log('Sletter gamle data …');
  await prisma.priceHistory.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.productIdentifier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.store.deleteMany();

  const catIds = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.create({ data: c });
    catIds.set(c.slug, row.id);
  }

  const storeRows = [];
  for (const s of stores) {
    const row = await prisma.store.create({
      data: {
        slug: s.slug,
        name: s.name,
        websiteUrl: s.websiteUrl,
        defaultShippingOre: s.shippingOre,
        freeShippingFromOre: s.freeShippingFromOre,
        dataSource: 'mock',
      },
    });
    storeRows.push({ seed: s, row });
  }

  let offerCount = 0;
  let historyCount = 0;

  for (const [i, p] of products.entries()) {
    const product = await prisma.product.create({
      data: {
        slug: slugify(`${p.brand} ${p.name}`),
        name: p.name,
        brand: p.brand,
        modelNumber: p.modelNumber ?? null,
        categoryId: catIds.get(p.category)!,
        searchText: normalizeForSearch(`${p.brand} ${p.name} ${p.modelNumber ?? ''}`),
        identifiers: {
          create: [
            { type: 'GTIN', value: fakeEan(i + 1).padStart(14, '0') },
            ...(p.modelNumber ? [{ type: 'MPN' as const, value: p.modelNumber }] : []),
          ],
        },
      },
    });

    for (const { seed: s, row: store } of storeRows) {
      if (s.categories !== 'all' && !s.categories.includes(p.category)) continue;
      if (rand() < 0.2) continue; // ikke alle butikker har alt

      const regular = storePrice(p.basePrice * s.priceLevel * between(0.97, 1.03));
      const scenario = pick<Scenario>(['real', 'real', 'real', 'fake', 'normal', 'normal', 'new']);
      const gen = generateOffer(regular, scenario, now, bwStart);
      const stock = stockAndDelivery();
      const shippingOre =
        s.freeShippingFromOre != null && gen.priceOre >= s.freeShippingFromOre ? 0 : s.shippingOre;
      const { lowest30Ore } = checkDeal({
        priceOre: gen.priceOre,
        beforePriceOre: gen.beforePriceOre,
        currentSince: gen.priceChangedAt,
        history: gen.history,
      });

      await prisma.offer.create({
        data: {
          productId: product.id,
          storeId: store.id,
          url: `${s.websiteUrl}${s.searchPath}${encodeURIComponent(`${p.brand} ${p.name}`)}`,
          storeTitle: `${p.brand} ${p.name}`,
          priceOre: gen.priceOre,
          beforePriceOre: gen.beforePriceOre,
          shippingOre,
          stockStatus: stock.stockStatus,
          deliveryDaysMin: stock.min,
          deliveryDaysMax: stock.max,
          priceChangedAt: gen.priceChangedAt,
          lowest30Ore,
          firstSeenAt: gen.history[0]!.recordedAt,
          lastCheckedAt: new Date(now.getTime() - between(5, 360) * 60_000),
          history: {
            create: gen.history.map((h) => ({ priceOre: h.priceOre, shippingOre, recordedAt: h.recordedAt })),
          },
        },
      });
      offerCount++;
      historyCount += gen.history.length;
    }
  }

  console.log(
    `Ferdig: ${stores.length} butikker, ${products.length} produkter, ${offerCount} tilbud, ${historyCount} prispunkter.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
