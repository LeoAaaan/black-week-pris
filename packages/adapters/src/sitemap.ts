/** Leser <loc>-adresser fra et sitemap eller en sitemap-indeks. */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = (block: string) =>
    [...block.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
      m[1]!.replace(/&amp;/g, '&'),
    );
  const sitemaps = [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)].flatMap((m) => locs(m[1]!));
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].flatMap((m) => locs(m[1]!));
  return { urls, sitemaps };
}
