import { normalizeForSearch } from './normalize';

// ---------------------------------------------------------------------------
// EAN / GTIN
// ---------------------------------------------------------------------------

/** Sjekker kontrollsifferet for GTIN-8/12/13/14 (mod 10, vekter 3 og 1 fra høyre). */
function hasValidCheckDigit(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 2, pos = 0; i >= 0; i--, pos++) {
    sum += Number(digits[i]) * (pos % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]);
}

/**
 * Normaliserer EAN/UPC/GTIN til GTIN-14 (14 siffer med ledende nuller),
 * slik at EAN-13 «0194253939528» og UPC-A «194253939528» blir like.
 * Returnerer null for ugyldige koder.
 */
export function normalizeGtin(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null;
  if (!hasValidCheckDigit(digits)) return null;
  return digits.padStart(14, '0');
}

// ---------------------------------------------------------------------------
// Modellnummer
// ---------------------------------------------------------------------------

/** «WH-1000XM5/B» → «WH1000XM5B». */
export function normalizeModelNumber(mpn: string | null | undefined): string | null {
  if (!mpn) return null;
  const n = mpn.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return n.length >= 4 ? n : null;
}

/**
 * Finner ord i et produktnavn som ser ut som modellnumre:
 * minst 5 tegn med både bokstaver og tall, f.eks. «WH-1000XM5» eller «SM-S928B».
 */
export function extractModelNumbers(name: string): string[] {
  const candidates = name.split(/[\s,()]+/);
  const result = new Set<string>();
  for (const raw of candidates) {
    const n = normalizeModelNumber(raw);
    if (n && n.length >= 5 && /[A-Z]/.test(n) && /\d/.test(n)) result.add(n);
  }
  return [...result];
}

// ---------------------------------------------------------------------------
// Navnelikhet
// ---------------------------------------------------------------------------

/** Ord som ikke sier noe om hvilket produkt det er. */
const STOPWORDS = new Set([
  'med', 'og', 'for', 'til', 'i', 'the', 'with', 'and',
  'tradlose', 'tradlos', 'wireless', 'ny', 'new', 'nyhet',
  'svart', 'sort', 'hvit', 'black', 'white', 'gra', 'grey', 'gray', 'silver', 'solv',
  'kampanje', 'tilbud', 'week', 'friday',
]);

export function nameTokens(name: string): string[] {
  return normalizeForSearch(name)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/**
 * Likhet mellom to produktnavn fra 0 til 1 (Dice-koeffisient på ord).
 * Tall teller ekstra: «PS5» og «PS4», eller «Pro 2» og «Pro», skal ikke matche.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  let score = (2 * shared) / (ta.size + tb.size);

  const numsA = [...ta].filter((t) => /\d/.test(t));
  const numsB = [...tb].filter((t) => /\d/.test(t));
  const sameNumbers = numsA.length === numsB.length && numsA.every((n) => tb.has(n));
  if (!sameNumbers) {
    score *= numsA.length > 0 && numsB.length > 0 ? 0.4 : 0.7;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Kobling av et butikktilbud til et produkt
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  id: string;
  name: string;
  brand: string;
  gtins: string[];
  modelNumbers: string[];
}

export interface RawProductInfo {
  name: string;
  brand?: string | null;
  gtin?: string | null;
  modelNumber?: string | null;
}

export type MatchMethod = 'gtin' | 'model_number' | 'name';

export interface MatchResult {
  productId: string;
  method: MatchMethod;
  /** 0–1. GTIN = 1. */
  confidence: number;
}

export interface MatchOptions {
  /** Minste navnelikhet for å godta en navnematch. */
  nameThreshold?: number;
  /** Beste navnematch må slå nest beste med minst så mye, ellers er det tvetydig. */
  ambiguityMargin?: number;
}

function sameBrand(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true; // ukjent merke stopper ikke en match
  return normalizeForSearch(a) === normalizeForSearch(b);
}

/**
 * Kobler et tilbud til et eksisterende produkt.
 * Rekkefølge: 1) EAN/GTIN, 2) merke + modellnummer, 3) navnelikhet.
 * Returnerer null når vi ikke er sikre nok; da skal tilbudet sjekkes manuelt
 * eller bli et nytt produkt.
 */
export function matchProduct(
  raw: RawProductInfo,
  candidates: MatchCandidate[],
  options: MatchOptions = {},
): MatchResult | null {
  const nameThreshold = options.nameThreshold ?? 0.75;
  const ambiguityMargin = options.ambiguityMargin ?? 0.05;

  // 1) GTIN
  const gtin = normalizeGtin(raw.gtin);
  if (gtin) {
    const hit = candidates.find((c) => c.gtins.some((g) => normalizeGtin(g) === gtin));
    if (hit) return { productId: hit.id, method: 'gtin', confidence: 1 };
  }

  // 2) Modellnummer (oppgitt eller funnet i navnet), med samme merke
  const rawModels = new Set<string>();
  const given = normalizeModelNumber(raw.modelNumber);
  if (given) rawModels.add(given);
  for (const m of extractModelNumbers(raw.name)) rawModels.add(m);

  if (rawModels.size > 0) {
    const hits = candidates.filter(
      (c) =>
        sameBrand(raw.brand, c.brand) &&
        c.modelNumbers.some((m) => {
          const n = normalizeModelNumber(m);
          return n != null && rawModels.has(n);
        }),
    );
    if (hits.length === 1) return { productId: hits[0]!.id, method: 'model_number', confidence: 0.9 };
  }

  // 3) Navn, innenfor samme merke
  const scored = candidates
    .filter((c) => sameBrand(raw.brand, c.brand))
    .map((c) => ({ c, score: nameSimilarity(`${raw.brand ?? ''} ${raw.name}`, `${c.brand} ${c.name}`) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < nameThreshold) return null;
  const second = scored[1];
  if (second && best.score - second.score < ambiguityMargin) return null;

  return { productId: best.c.id, method: 'name', confidence: Math.round(best.score * 100) / 100 };
}
