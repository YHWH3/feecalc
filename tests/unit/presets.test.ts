import { describe, it, expect } from 'vitest';
import { FEE_PRESETS, presetById } from '../../src/core/presets';
import { currencyByCode } from '../../src/core/currencies';
import { computeFee, PPM_DENOMINATOR } from '../../src/core/fee';

describe('fee presets — schema validity', () => {
  it('has unique ids', () => {
    const ids = FEE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset is internally consistent', () => {
    for (const p of FEE_PRESETS) {
      expect(p.id, p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.provider.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.market.length).toBeGreaterThan(0);
      expect(currencyByCode(p.currency), `${p.id} currency`).toBeDefined();
      expect(p.fee.percentageRatePpm, `${p.id} pct`).toBeGreaterThanOrEqual(0);
      expect(p.fee.percentageRatePpm, `${p.id} pct`).toBeLessThan(PPM_DENOMINATOR);
      expect(p.fee.extraPercentageRatePpm).toBeGreaterThanOrEqual(0);
      expect(
        p.fee.percentageRatePpm + p.fee.extraPercentageRatePpm,
        `${p.id} total rate`,
      ).toBeLessThan(PPM_DENOMINATOR);
      expect(p.fee.fixedFeeMinor, `${p.id} fixed`).toBeGreaterThanOrEqual(0);
      expect(p.fee.extraFixedFeeMinor).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(p.fee.fixedFeeMinor)).toBe(true);
      expect(Number.isInteger(p.fee.extraFixedFeeMinor)).toBe(true);
      expect(p.conditions.length, `${p.id} conditions`).toBeGreaterThan(0);
      expect(p.sourceUrl, `${p.id} source`).toMatch(/^https:\/\//);
      expect(p.sourceLabel.length).toBeGreaterThan(0);
      expect(p.verifiedAt, `${p.id} verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(p.verifiedAt).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('is retrievable by id', () => {
    for (const p of FEE_PRESETS) {
      expect(presetById(p.id)).toBe(p);
    }
    expect(presetById('no-such-preset')).toBeUndefined();
  });

  it('every preset fee actually computes', () => {
    for (const p of FEE_PRESETS) {
      const fee = computeFee(100_000, p.fee);
      expect(fee.totalFeeMinor, p.id).toBeGreaterThan(0);
      expect(fee.totalFeeMinor, p.id).toBeLessThan(100_000);
    }
  });
});

describe('fee presets — verified values', () => {
  it('Stripe US domestic: 2.9% + $0.30', () => {
    const p = presetById('stripe-us-domestic')!;
    expect(p.fee.percentageRatePpm).toBe(29_000);
    expect(p.fee.fixedFeeMinor).toBe(30);
    expect(p.currency).toBe('USD');
  });

  it('Stripe UK: 1.5% + 20p', () => {
    const p = presetById('stripe-uk-domestic')!;
    expect(p.fee.percentageRatePpm).toBe(15_000);
    expect(p.fee.fixedFeeMinor).toBe(20);
    expect(p.currency).toBe('GBP');
  });

  it('PayPal Checkout: 3.49% + $0.49', () => {
    const p = presetById('paypal-us-checkout')!;
    expect(p.fee.percentageRatePpm).toBe(34_900);
    expect(p.fee.fixedFeeMinor).toBe(49);
  });
});
