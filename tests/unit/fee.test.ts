import { describe, it, expect } from 'vitest';
import { computeFee, parseRate, percentPart, ppmToInput, type FeeConfig } from '../../src/core/fee';

const F = (p: number, f: number, ep = 0, ef = 0): FeeConfig => ({
  percentageRatePpm: p,
  fixedFeeMinor: f,
  extraPercentageRatePpm: ep,
  extraFixedFeeMinor: ef,
});

describe('percentPart (processor rounding)', () => {
  it('rounds to the nearest minor unit, half up', () => {
    expect(percentPart(103017, 29_000)).toBe(2987); // 2987.493 → 2987
    expect(percentPart(103018, 29_000)).toBe(2988); // 2987.522 → 2988
    expect(percentPart(150, 10_000)).toBe(2); // 1.5 → 2 (half away from zero)
    expect(percentPart(250, 10_000)).toBe(3); // 2.5 → 3
  });

  it('handles zero inputs and rounding modes', () => {
    expect(percentPart(0, 29_000)).toBe(0);
    expect(percentPart(100, 0)).toBe(0);
    expect(percentPart(151, 10_000, 'up')).toBe(2);
    expect(percentPart(151, 10_000, 'down')).toBe(1);
    expect(percentPart(150, 10_000, 'up')).toBe(2);
  });
});

describe('computeFee', () => {
  it('computes Stripe-style 2.9% + $0.30', () => {
    const fee = computeFee(103017, F(29_000, 30));
    expect(fee.percentagePartMinor).toBe(2987);
    expect(fee.fixedPartMinor).toBe(30);
    expect(fee.totalFeeMinor).toBe(3017);
  });

  it('combines percentage + extra percentage separately rounded', () => {
    // Stripe international: 2.9% + 1.5% surcharge → each part rounded
    const fee = computeFee(104634, F(29_000, 30, 15_000, 0));
    expect(fee.percentagePartMinor).toBe(3034); // 3034.386 → 3034
    expect(fee.extraPercentagePartMinor).toBe(1570); // 1569.51 → 1570
    expect(fee.totalFeeMinor).toBe(4634);
    expect(fee.totalRatePpm).toBe(44_000);
  });

  it('supports fixed-only, pct-only, extra fixed, and zero fee', () => {
    expect(computeFee(10000, F(0, 30)).totalFeeMinor).toBe(30);
    expect(computeFee(10000, F(29_000, 0)).totalFeeMinor).toBe(290);
    expect(computeFee(10000, F(10_000, 0, 0, 50)).totalFeeMinor).toBe(150);
    expect(computeFee(10000, F(0, 0)).totalFeeMinor).toBe(0);
  });
});

describe('parseRate', () => {
  it('parses common rate strings', () => {
    expect(parseRate('2.9')).toEqual({ ok: true, ppm: 29_000 });
    expect(parseRate('0')).toEqual({ ok: true, ppm: 0 });
    expect(parseRate('3.49')).toEqual({ ok: true, ppm: 34_900 });
    expect(parseRate('.5')).toEqual({ ok: true, ppm: 5_000 });
    expect(parseRate('2.9%')).toEqual({ ok: true, ppm: 29_000 });
    expect(parseRate('0.035')).toEqual({ ok: true, ppm: 350 });
  });

  it('rejects bad input', () => {
    expect(parseRate('')).toMatchObject({ ok: false, code: 'empty' });
    expect(parseRate('-1')).toMatchObject({ ok: false, code: 'negative' });
    expect(parseRate('abc')).toMatchObject({ ok: false, code: 'malformed' });
    expect(parseRate('2.91234')).toMatchObject({ ok: false, code: 'precision' });
    expect(parseRate('100')).toMatchObject({ ok: false, code: 'too_large' });
    expect(parseRate('150')).toMatchObject({ ok: false, code: 'too_large' });
  });
});

describe('ppmToInput', () => {
  it('round-trips with parseRate', () => {
    for (const ppm of [0, 29_000, 34_900, 350, 500_000, 999_999]) {
      expect(parseRate(ppmToInput(ppm))).toEqual({ ok: true, ppm });
    }
  });
});
