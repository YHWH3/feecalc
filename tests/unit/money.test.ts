import { describe, it, expect } from 'vitest';
import { currencyByCode } from '../../src/core/currencies';
import { formatMoney, minorToInput, parseAmount } from '../../src/core/money';

const USD = currencyByCode('USD')!;
const GBP = currencyByCode('GBP')!;
const JPY = currencyByCode('JPY')!;
const AED = currencyByCode('AED')!;

describe('currencies', () => {
  it('has required currencies with correct minor units', () => {
    for (const [code, minor] of [
      ['USD', 2],
      ['GBP', 2],
      ['EUR', 2],
      ['CAD', 2],
      ['AUD', 2],
      ['AED', 2],
      ['INR', 2],
      ['JPY', 0],
    ] as const) {
      expect(currencyByCode(code)?.minorUnits, code).toBe(minor);
    }
  });
});

describe('parseAmount', () => {
  it('parses plain decimals', () => {
    expect(parseAmount('1030.17', USD)).toEqual({ ok: true, value: 103017 });
    expect(parseAmount('100', USD)).toEqual({ ok: true, value: 10000 });
    expect(parseAmount('0.30', USD)).toEqual({ ok: true, value: 30 });
    expect(parseAmount('.56', USD)).toEqual({ ok: true, value: 56 });
  });

  it('parses grouping separators', () => {
    expect(parseAmount('1,000.00', USD)).toEqual({ ok: true, value: 100000 });
    expect(parseAmount('1,234,567.89', USD)).toEqual({ ok: true, value: 123456789 });
    expect(parseAmount('1 234.56', USD)).toEqual({ ok: true, value: 123456 });
    expect(parseAmount("1'234.56", USD)).toEqual({ ok: true, value: 123456 });
    expect(parseAmount('1,000', USD)).toEqual({ ok: true, value: 100000 });
  });

  it('parses comma decimal style', () => {
    expect(parseAmount('10,50', USD)).toEqual({ ok: true, value: 1050 });
    expect(parseAmount('1.234,56', USD)).toEqual({ ok: true, value: 123456 });
    expect(parseAmount('1.234,5', USD)).toEqual({ ok: true, value: 123450 });
  });

  it('rejects empty, malformed, negative, over-precise, huge', () => {
    expect(parseAmount('', USD).ok).toBe(false);
    expect(parseAmount('   ', USD).ok).toBe(false);
    expect(parseAmount('abc', USD).ok).toBe(false);
    expect(parseAmount('1.2.3.4', USD).ok).toBe(false); // invalid grouping
    expect(parseAmount('1,23,456', USD).ok).toBe(false); // invalid grouping
    expect(parseAmount('-5', USD)).toMatchObject({ ok: false, code: 'negative' });
    expect(parseAmount('1.234', USD)).toMatchObject({ ok: false, code: 'precision' });
    expect(parseAmount('5.5', JPY)).toMatchObject({ ok: false, code: 'precision' });
    expect(parseAmount('99999999999999', USD)).toMatchObject({ ok: false, code: 'too_large' });
  });

  it('rejects commas/letters mixed garbage', () => {
    expect(parseAmount('1,2a3', USD).ok).toBe(false);
    expect(parseAmount('$100', USD).ok).toBe(false);
    expect(parseAmount('1..5', USD).ok).toBe(false);
  });

  it('handles zero-decimal currencies', () => {
    expect(parseAmount('1000', JPY)).toEqual({ ok: true, value: 1000 });
    expect(parseAmount('10,000', JPY)).toEqual({ ok: true, value: 10000 });
    expect(parseAmount('¥500', JPY).ok).toBe(false);
  });
});

describe('formatMoney / minorToInput', () => {
  it('formats with currency symbol and grouping', () => {
    expect(formatMoney(103017, USD)).toBe('$1,030.17');
    expect(formatMoney(123456789, GBP)).toBe('£1,234,567.89');
    expect(formatMoney(500, JPY)).toBe('¥500');
    expect(formatMoney(5, USD)).toBe('$0.05');
    expect(formatMoney(123456, AED)).toContain('1,234.56');
  });

  it('produces plain input strings', () => {
    expect(minorToInput(103017, USD)).toBe('1030.17');
    expect(minorToInput(500, JPY)).toBe('500');
    expect(minorToInput(5, USD)).toBe('0.05');
    expect(minorToInput(0, USD)).toBe('0.00');
  });
});
