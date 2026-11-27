/**
 * Normaliserer tekst til søk og sammenligning:
 * små bokstaver, æøå → ae/o/a, fjerner aksenter og tegn,
 * og skiller bokstaver og tall («pro2» → «pro 2», «ps5» → «ps 5»).
 * Samme funksjon brukes på lagret tekst og på søket, så de treffer hverandre.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/[øö]/g, 'o')
    .replace(/[åä]/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lager en URL-vennlig slug: «AirPods Pro 2 (USB-C)» → «airpods-pro-2-usb-c». */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Vanlige forkortelser brukere skriver, utvidet før søk. */
const QUERY_SYNONYMS: Record<string, string> = {
  ps: 'playstation',
  xsx: 'xbox series x',
  mbp: 'macbook pro',
  mba: 'macbook air',
  hodetlf: 'hodetelefoner',
  robot: 'robotstovsuger',
};

/** Normaliserer et søk og utvider kjente forkortelser («ps5» → «playstation 5»). */
export function normalizeQuery(query: string): string {
  return normalizeForSearch(query)
    .split(' ')
    .map((t) => QUERY_SYNONYMS[t] ?? t)
    .join(' ');
}
