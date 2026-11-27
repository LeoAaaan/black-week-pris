import { describe, expect, it } from 'vitest';
import { formatDelivery, formatNok, formatPercent, formatRelativeTime, formatShipping } from './format';

const NBSP = ' ';
const s = (str: string) => str.replace(/ /g, NBSP);

describe('formatNok', () => {
  it('norsk format med mellomrom som tusenskille', () => {
    expect(formatNok(129900)).toBe(s('1 299 kr'));
    expect(formatNok(1999000)).toBe(s('19 990 kr'));
    expect(formatNok(123456700)).toBe(s('1 234 567 kr'));
    expect(formatNok(4900)).toBe(s('49 kr'));
    expect(formatNok(0)).toBe(s('0 kr'));
  });
  it('viser øre med komma når det finnes', () => {
    expect(formatNok(129950)).toBe(s('1 299,50 kr'));
    expect(formatNok(5)).toBe(s('0,05 kr'));
  });
  it('negative beløp', () => {
    expect(formatNok(-50000)).toBe(s('−500 kr'));
  });
});

describe('andre formater', () => {
  it('prosent', () => expect(formatPercent(23)).toBe(s('23 %')));
  it('frakt', () => {
    expect(formatShipping(0)).toBe('Gratis frakt');
    expect(formatShipping(null)).toBe('Frakt ukjent');
    expect(formatShipping(9900)).toBe(`Frakt ${s('99 kr')}`);
  });
  it('leveringstid', () => {
    expect(formatDelivery(1, 3)).toBe('1–3 dager');
    expect(formatDelivery(1, 1)).toBe('1 dag');
    expect(formatDelivery(2, null)).toBe('2 dager');
    expect(formatDelivery(0, 0)).toBe('Hent i dag');
    expect(formatDelivery(null, null)).toBeNull();
  });
  it('relativ tid', () => {
    const now = new Date('2026-11-27T12:00:00Z');
    expect(formatRelativeTime(new Date('2026-11-27T11:59:40Z'), now)).toBe('akkurat nå');
    expect(formatRelativeTime(new Date('2026-11-27T11:45:00Z'), now)).toBe('for 15 min siden');
    expect(formatRelativeTime(new Date('2026-11-27T09:00:00Z'), now)).toBe('for 3 t siden');
    expect(formatRelativeTime('2026-11-26T10:00:00Z', now)).toBe('i går');
    expect(formatRelativeTime('2026-11-23T10:00:00Z', now)).toBe('for 4 dager siden');
  });
});
