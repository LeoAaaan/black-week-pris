import { describe, expect, it } from 'vitest';
import { parseRobots } from './robots';
import { parseSitemap } from './sitemap';

const UA = 'BlackWeekPrisBot/0.1 (+https://example.com)';

describe('parseRobots', () => {
  const txt = `
# kommentar
User-agent: *
Disallow: /checkout
Disallow: /search
Allow: /search/help
Disallow: /*?sort=
Disallow: /*.pdf$
Crawl-delay: 3

User-agent: BadBot
Disallow: /

Sitemap: https://example.com/sitemap_index.xml
Sitemap: https://example.com/sitemap-products.xml
`;
  const r = parseRobots(txt, UA);

  it('tillater vanlige sider', () => {
    expect(r.isAllowed('/product/123')).toBe(true);
    expect(r.isAllowed('/')).toBe(true);
  });
  it('blokkerer Disallow-stier', () => {
    expect(r.isAllowed('/checkout')).toBe(false);
    expect(r.isAllowed('/search?q=ps5')).toBe(false);
  });
  it('lengste treff vinner (Allow innenfor Disallow)', () => {
    expect(r.isAllowed('/search/help')).toBe(true);
  });
  it('støtter * og $', () => {
    expect(r.isAllowed('/tv?sort=price')).toBe(false);
    expect(r.isAllowed('/manual.pdf')).toBe(false);
    expect(r.isAllowed('/manual.pdf?x=1')).toBe(true);
  });
  it('leser Crawl-delay og sitemaper', () => {
    expect(r.crawlDelaySeconds).toBe(3);
    expect(r.sitemaps).toEqual(['https://example.com/sitemap_index.xml', 'https://example.com/sitemap-products.xml']);
  });
  it('bruker egen gruppe når vår bot er nevnt', () => {
    const own = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: BlackWeekPrisBot\nDisallow: /', UA);
    expect(own.isAllowed('/product/1')).toBe(false);
  });
  it('tom fil betyr at alt er lov', () => {
    expect(parseRobots('', UA).isAllowed('/alt')).toBe(true);
  });
  it('flere user-agents i samme gruppe', () => {
    const g = parseRobots('User-agent: foo\nUser-agent: *\nDisallow: /privat', UA);
    expect(g.isAllowed('/privat/x')).toBe(false);
  });
});

describe('parseSitemap', () => {
  it('leser sitemap-indeks', () => {
    const xml = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap><sitemap><loc><![CDATA[https://example.com/s2.xml]]></loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({ urls: [], sitemaps: ['https://example.com/s1.xml', 'https://example.com/s2.xml'] });
  });
  it('leser url-liste og dekoder &amp;', () => {
    const xml = `<urlset><url><loc>https://example.com/product/1</loc><lastmod>2026-11-20</lastmod></url><url><loc> https://example.com/p?a=1&amp;b=2 </loc></url></urlset>`;
    expect(parseSitemap(xml).urls).toEqual(['https://example.com/product/1', 'https://example.com/p?a=1&b=2']);
  });
});
