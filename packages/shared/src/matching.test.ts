import { describe, expect, it } from 'vitest';
import {
  extractModelNumbers,
  matchProduct,
  nameSimilarity,
  normalizeGtin,
  normalizeModelNumber,
  type MatchCandidate,
} from './matching';
import { normalizeForSearch, normalizeQuery } from './normalize';

describe('normalizeGtin', () => {
  it('godtar gyldig EAN-13 og gir GTIN-14', () => {
    expect(normalizeGtin('4006381333931')).toBe('04006381333931');
  });
  it('UPC-A og EAN-13 med ledende null blir like', () => {
    expect(normalizeGtin('036000291452')).toBe(normalizeGtin('0036000291452'));
  });
  it('godtar EAN-8', () => {
    expect(normalizeGtin('96385074')).toBe('00000096385074');
  });
  it('fjerner mellomrom og bindestrek', () => {
    expect(normalizeGtin('4006381-333931')).toBe('04006381333931');
    expect(normalizeGtin(' 4006381 333931 ')).toBe('04006381333931');
  });
  it('avviser feil kontrollsiffer', () => {
    expect(normalizeGtin('4006381333932')).toBeNull();
  });
  it('avviser feil lengde, nuller og tomme verdier', () => {
    expect(normalizeGtin('12345')).toBeNull();
    expect(normalizeGtin('0000000000000')).toBeNull();
    expect(normalizeGtin('')).toBeNull();
    expect(normalizeGtin(null)).toBeNull();
    expect(normalizeGtin(undefined)).toBeNull();
  });
});

describe('modellnummer', () => {
  it('normaliserer skilletegn og store/små bokstaver', () => {
    expect(normalizeModelNumber('wh-1000xm5/b')).toBe('WH1000XM5B');
    expect(normalizeModelNumber('SM S928B')).toBe('SMS928B');
  });
  it('avviser for korte verdier', () => {
    expect(normalizeModelNumber('A1')).toBeNull();
  });
  it('finner modellnumre i produktnavn', () => {
    expect(extractModelNumbers('Sony WH-1000XM5 trådløse hodetelefoner, svart')).toEqual(['WH1000XM5']);
    expect(extractModelNumbers('Samsung 55" QLED Q80D (QE55Q80DATXXC)')).toContain('QE55Q80DATXXC');
  });
  it('tar ikke med vanlige ord eller rene tall', () => {
    expect(extractModelNumbers('Apple AirPods Pro 2 2024')).toEqual([]);
  });
});

describe('normalizeForSearch', () => {
  it('håndterer æøå, aksenter og tall', () => {
    expect(normalizeForSearch('Elkjøp')).toBe('elkjop');
    expect(normalizeForSearch('Blåbær-Café')).toBe('blabaer cafe');
    expect(normalizeForSearch('AirPods Pro2')).toBe('airpods pro 2');
    expect(normalizeForSearch('PS5')).toBe(normalizeForSearch('ps 5'));
  });
  it('utvider forkortelser i søk', () => {
    expect(normalizeQuery('PS5 pro')).toBe('playstation 5 pro');
  });
});

describe('nameSimilarity', () => {
  it('høy likhet for samme produkt med ulik skrivemåte', () => {
    expect(nameSimilarity('Apple AirPods Pro 2 (USB-C)', 'AirPods Pro (2. generasjon) USB-C Apple')).toBeGreaterThan(0.75);
  });
  it('lav likhet når tallene er ulike', () => {
    expect(nameSimilarity('Sony PlayStation 5 Slim', 'Sony PlayStation 4 Slim')).toBeLessThan(0.5);
    expect(nameSimilarity('Apple AirPods Pro 2', 'Apple AirPods Pro')).toBeLessThan(0.75);
  });
  it('fargeord påvirker ikke', () => {
    expect(nameSimilarity('Sony WH-1000XM5 svart', 'Sony WH-1000XM5 sølv')).toBe(1);
  });
  it('0 for tomme navn', () => {
    expect(nameSimilarity('', 'noe')).toBe(0);
  });
});

describe('matchProduct', () => {
  const candidates: MatchCandidate[] = [
    {
      id: 'airpods-pro-2',
      name: 'AirPods Pro 2 (USB-C)',
      brand: 'Apple',
      gtins: ['0195949052484'],
      modelNumbers: ['MTJV3DN/A'],
    },
    {
      id: 'airpods-4',
      name: 'AirPods 4 med aktiv støydemping',
      brand: 'Apple',
      gtins: ['0195949481437'],
      modelNumbers: ['MXP93DN/A'],
    },
    {
      id: 'sony-xm5',
      name: 'WH-1000XM5 trådløse hodetelefoner',
      brand: 'Sony',
      gtins: ['4548736132610'],
      modelNumbers: ['WH1000XM5B'],
    },
    {
      id: 'ps5-slim',
      name: 'PlayStation 5 Slim Digital Edition',
      brand: 'Sony',
      gtins: [],
      modelNumbers: ['CFI-2016'],
    },
  ];

  it('1) matcher på GTIN uansett navn', () => {
    expect(matchProduct({ name: 'Helt annet navn', gtin: '195949052484' }, candidates)).toEqual({
      productId: 'airpods-pro-2',
      method: 'gtin',
      confidence: 1,
    });
  });

  it('2) bruker modellnummer når GTIN mangler eller er ugyldig', () => {
    const r = matchProduct({ name: 'Hodetelefoner', brand: 'Sony', gtin: '123', modelNumber: 'WH-1000XM5/B' }, candidates);
    expect(r).toEqual({ productId: 'sony-xm5', method: 'model_number', confidence: 0.9 });
  });

  it('2) finner modellnummer i navnet', () => {
    const r = matchProduct({ name: 'Sony MTJV3DN/A', brand: 'Apple' }, candidates);
    expect(r?.productId).toBe('airpods-pro-2');
    expect(r?.method).toBe('model_number');
  });

  it('2) modellnummer fra et annet merke matcher ikke', () => {
    const r = matchProduct({ name: 'Noe', brand: 'Samsung', modelNumber: 'WH1000XM5B' }, candidates);
    expect(r).toBeNull();
  });

  it('3) faller tilbake på navn', () => {
    const r = matchProduct({ name: 'Apple AirPods Pro (2. gen) USB-C', brand: 'Apple' }, candidates);
    expect(r?.productId).toBe('airpods-pro-2');
    expect(r?.method).toBe('name');
  });

  it('3) matcher ikke PS4 mot PS5', () => {
    expect(matchProduct({ name: 'PlayStation 4 Slim Digital Edition', brand: 'Sony' }, candidates)).toBeNull();
  });

  it('3) krever samme merke', () => {
    expect(matchProduct({ name: 'AirPods Pro 2 USB-C', brand: 'Sony' }, candidates)).toBeNull();
  });

  it('returnerer null når vi ikke er sikre', () => {
    expect(matchProduct({ name: 'Ladekabel USB-C 1 m', brand: 'Apple' }, candidates)).toBeNull();
  });

  it('returnerer null ved tvetydige navnetreff', () => {
    const twins: MatchCandidate[] = [
      { id: 'a', name: 'Galaxy Buds FE', brand: 'Samsung', gtins: [], modelNumbers: [] },
      { id: 'b', name: 'Galaxy Buds FE', brand: 'Samsung', gtins: [], modelNumbers: [] },
    ];
    expect(matchProduct({ name: 'Galaxy Buds FE', brand: 'Samsung' }, twins)).toBeNull();
  });
});
