import { describe, expect, it } from 'vitest';
import { checkDeal, discount, isFreeShipping, lowestPriceInWindow, totalPrice } from './pricing';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('totalPrice', () => {
  it('legger sammen pris og frakt', () => {
    expect(totalPrice(129900, 4900)).toBe(134800);
  });
  it('regner ukjent frakt som 0', () => {
    expect(totalPrice(129900, null)).toBe(129900);
  });
  it('gratis frakt', () => {
    expect(totalPrice(129900, 0)).toBe(129900);
    expect(isFreeShipping(0)).toBe(true);
    expect(isFreeShipping(null)).toBe(false);
    expect(isFreeShipping(4900)).toBe(false);
  });
});

describe('discount', () => {
  it('regner rabatt i kr og prosent', () => {
    expect(discount(199900, 299900)).toEqual({ ore: 100000, pct: 33 });
  });
  it('avrunder prosent til nærmeste hele', () => {
    // 1 - 2490/2990 = 16,72 % → 17
    expect(discount(249000, 299000)).toEqual({ ore: 50000, pct: 17 });
  });
  it('gir 0 uten førpris', () => {
    expect(discount(199900, null)).toEqual({ ore: 0, pct: 0 });
  });
  it('gir 0 når førpris er lik eller lavere enn pris', () => {
    expect(discount(199900, 199900)).toEqual({ ore: 0, pct: 0 });
    expect(discount(199900, 149900)).toEqual({ ore: 0, pct: 0 });
  });
  it('tåler førpris 0', () => {
    expect(discount(100, 0)).toEqual({ ore: 0, pct: 0 });
  });
});

describe('lowestPriceInWindow', () => {
  const history = [
    { priceOre: 300000, recordedAt: day('2026-09-01') },
    { priceOre: 280000, recordedAt: day('2026-10-20') },
    { priceOre: 290000, recordedAt: day('2026-11-05') },
  ];

  it('tar med prisen som gjaldt ved starten av vinduet', () => {
    // Vindu 1.–15. nov: 280000 gjaldt fra 20. okt og inn i vinduet
    expect(lowestPriceInWindow(history, day('2026-11-01'), day('2026-11-15'))).toBe(280000);
  });
  it('ser bort fra priser etter vinduet', () => {
    expect(lowestPriceInWindow(history, day('2026-09-02'), day('2026-10-01'))).toBe(300000);
  });
  it('gir null uten historikk før slutten av vinduet', () => {
    expect(lowestPriceInWindow(history, day('2026-08-01'), day('2026-08-15'))).toBeNull();
  });
  it('er uavhengig av rekkefølge', () => {
    expect(lowestPriceInWindow([...history].reverse(), day('2026-11-01'), day('2026-11-15'))).toBe(280000);
  });
});

describe('checkDeal («Ekte tilbud?»)', () => {
  const currentSince = day('2026-11-20');
  const history = [
    { priceOre: 299900, recordedAt: day('2026-09-01') },
    { priceOre: 279900, recordedAt: day('2026-11-01') },
    { priceOre: 249900, recordedAt: currentSince }, // selve tilbudsprisen
  ];

  it('ekte tilbud når prisen er lavere enn laveste siste 30 dager', () => {
    const r = checkDeal({ priceOre: 249900, beforePriceOre: 279900, currentSince, history });
    expect(r).toEqual({ verdict: 'real', lowest30Ore: 279900, inflatedBeforePrice: false });
  });

  it('flagger oppblåst førpris', () => {
    const r = checkDeal({ priceOre: 249900, beforePriceOre: 349900, currentSince, history });
    expect(r.verdict).toBe('real');
    expect(r.inflatedBeforePrice).toBe(true);
  });

  it('tåler små avvik i førpris (1 %)', () => {
    const r = checkDeal({ priceOre: 249900, beforePriceOre: 282000, currentSince, history });
    expect(r.inflatedBeforePrice).toBe(false);
  });

  it('ikke ekte når produktet var billigere for to uker siden', () => {
    const h = [
      { priceOre: 299900, recordedAt: day('2026-09-01') },
      { priceOre: 229900, recordedAt: day('2026-11-05') },
      { priceOre: 299900, recordedAt: day('2026-11-12') },
      { priceOre: 249900, recordedAt: currentSince },
    ];
    const r = checkDeal({ priceOre: 249900, beforePriceOre: 299900, currentSince, history: h });
    expect(r.verdict).toBe('not_real');
    expect(r.lowest30Ore).toBe(229900);
    expect(r.inflatedBeforePrice).toBe(true);
  });

  it('samme pris som laveste siste 30 dager', () => {
    const r = checkDeal({ priceOre: 279900, beforePriceOre: null, currentSince, history });
    expect(r.verdict).toBe('same');
  });

  it('priser eldre enn 30 dager teller ikke, bortsett fra den som fortsatt gjaldt', () => {
    const h = [
      { priceOre: 199900, recordedAt: day('2026-08-01') }, // utenfor vinduet og erstattet
      { priceOre: 299900, recordedAt: day('2026-09-01') }, // gjaldt ved vindusstart
      { priceOre: 249900, recordedAt: currentSince },
    ];
    const r = checkDeal({ priceOre: 249900, beforePriceOre: 299900, currentSince, history: h });
    expect(r).toEqual({ verdict: 'real', lowest30Ore: 299900, inflatedBeforePrice: false });
  });

  it('ukjent uten historikk', () => {
    const r = checkDeal({
      priceOre: 249900,
      beforePriceOre: 299900,
      currentSince,
      history: [{ priceOre: 249900, recordedAt: currentSince }],
    });
    expect(r).toEqual({ verdict: 'unknown', lowest30Ore: null, inflatedBeforePrice: false });
  });
});
