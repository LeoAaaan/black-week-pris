import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toRawOffer } from './jsonld-adapter';
import { extractJsonLd, mapAvailability, parsePriceToOre, parseProductFromHtml } from './jsonld';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('parsePriceToOre', () => {
  it.each([
    [1299, 129900],
    ['1299', 129900],
    ['1299.00', 129900],
    ['1299.5', 129950],
    ['1 299,00', 129900],
    ['1 299,-', 129900],
    ['1.299,-', 129900],
    ['1.299', 129900],
    ['12.999,50', 1299950],
    ['12,999.50', 1299950],
    ['kr 899', 89900],
    ['5 990,00', 599000],
  ])('%s → %s øre', (input, expected) => {
    expect(parsePriceToOre(input)).toBe(expected);
  });

  it('avviser tull', () => {
    expect(parsePriceToOre('gratis')).toBeNull();
    expect(parsePriceToOre(null)).toBeNull();
    expect(parsePriceToOre(-5)).toBeNull();
  });
});

describe('mapAvailability', () => {
  it('forstår schema.org-verdier med og uten URL', () => {
    expect(mapAvailability('https://schema.org/InStock')).toBe('in_stock');
    expect(mapAvailability('InStock')).toBe('in_stock');
    expect(mapAvailability('http://schema.org/OutOfStock')).toBe('out_of_stock');
    expect(mapAvailability('https://schema.org/LimitedAvailability')).toBe('low_stock');
    expect(mapAvailability('https://schema.org/PreOrder')).toBe('preorder');
    expect(mapAvailability(undefined)).toBe('unknown');
  });
});

describe('parseProductFromHtml', () => {
  it('leser et vanlig Product med Offer, førpris, frakt og leveringstid', () => {
    expect(parseProductFromHtml(fixture('product-offer.html'))).toEqual({
      name: 'Sony WH-1000XM5 trådløse hodetelefoner',
      brand: 'Sony',
      gtin: '4548736132610',
      mpn: 'WH1000XM5B',
      sku: '1205456',
      image: 'https://example.com/img/xm5.jpg',
      category: null,
      priceOre: 349000,
      beforePriceOre: 449000,
      shippingOre: 0,
      stockStatus: 'in_stock',
      deliveryDaysMin: 1,
      deliveryDaysMax: 4,
      url: 'https://example.com/product/1205456',
    });
  });

  it('håndterer @graph, flere typer, AggregateOffer og velger NOK', () => {
    const p = parseProductFromHtml(fixture('product-graph.html'))!;
    expect(p.name).toBe('PlayStation 5 Slim & kontroller');
    expect(p.brand).toBe('Sony');
    expect(p.gtin).toBe('0711719577294');
    expect(p.priceOre).toBe(599000);
    expect(p.stockStatus).toBe('low_stock');
    expect(p.beforePriceOre).toBeNull();
  });

  it('hopper over ugyldig JSON uten å krasje', () => {
    expect(extractJsonLd(fixture('product-graph.html'))).toHaveLength(1);
  });

  it('gir null for sider uten produkt', () => {
    expect(parseProductFromHtml('<html><body>Hei</body></html>')).toBeNull();
  });

  it('ignorerer førpris som ikke er høyere enn prisen', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"@type":"Offer","price":100,"priceCurrency":"NOK","priceSpecification":{"priceType":"StrikethroughPrice","price":100}}}</script>`;
    expect(parseProductFromHtml(html)!.beforePriceOre).toBeNull();
  });
});

describe('toRawOffer', () => {
  const cfg = { storeSlug: 'test', origin: 'https://example.com', productUrlPattern: /./ };

  it('bruker butikkens standardfrakt når siden ikke oppgir frakt', () => {
    const r = toRawOffer({ ...cfg, defaultShippingOre: 9900 }, 'https://example.com/p', fixture('product-graph.html'))!;
    expect(r.shippingOre).toBe(9900);
  });

  it('gir gratis frakt over grensen', () => {
    const r = toRawOffer(
      { ...cfg, defaultShippingOre: 9900, freeShippingFromOre: 100000 },
      'https://example.com/p',
      fixture('product-graph.html'),
    )!;
    expect(r.shippingOre).toBe(0);
  });

  it('frakt fra siden vinner', () => {
    const r = toRawOffer({ ...cfg, defaultShippingOre: 9900 }, 'https://example.com/p', fixture('product-offer.html'))!;
    expect(r.shippingOre).toBe(0);
    expect(r.gtin).toBe('4548736132610');
    expect(r.modelNumber).toBe('WH1000XM5B');
  });
});
