import { describe, it, expect } from 'vitest';
import { computeFee, type FeeConfig } from '../../src/core/fee';
import { grossUp, GrossUpError } from '../../src/core/grossup';
import { forward, reverse } from '../../src/core/calculate';

const F = (p: number, f: number, ep = 0, ef = 0): FeeConfig => ({
  percentageRatePpm: p,
  fixedFeeMinor: f,
  extraPercentageRatePpm: ep,
  extraFixedFeeMinor: ef,
});

const netAt = (gross: number, fee: FeeConfig): number =>
  gross - computeFee(gross, fee).totalFeeMinor;

describe('grossUp — canonical cases', () => {
  it('Stripe US: receive $1,000 → charge $1,030.17', () => {
    const { grossMinor, netMinor } = grossUp(100_000, F(29_000, 30));
    expect(grossMinor).toBe(103_017);
    expect(netMinor).toBe(100_000);
    // breakdown at that gross: pct part 2987 + fixed 30 = $30.17
    const fee = computeFee(103_017, F(29_000, 30));
    expect(fee.totalFeeMinor).toBe(3017);
  });

  it('percentage only', () => {
    const { grossMinor, netMinor } = grossUp(10_000, F(29_000, 0));
    expect(grossMinor).toBe(10_299);
    expect(netMinor).toBe(10_000);
  });

  it('fixed fee only', () => {
    expect(grossUp(10_000, F(0, 30)).grossMinor).toBe(10_030);
  });

  it('zero fee returns the target', () => {
    expect(grossUp(500, F(0, 0)).grossMinor).toBe(500);
    expect(grossUp(1, F(0, 0)).grossMinor).toBe(1);
  });

  it('extra percentage (international surcharge)', () => {
    const { grossMinor, netMinor } = grossUp(100_000, F(29_000, 30, 15_000, 0));
    expect(grossMinor).toBe(104_633);
    expect(netMinor).toBe(100_000);
    expect(netAt(104_632, F(29_000, 30, 15_000, 0))).toBe(99_999);
  });

  it('extra fixed fee', () => {
    const { grossMinor } = grossUp(100_000, F(29_000, 30, 0, 50));
    expect(grossMinor).toBe(103_069);
  });

  it('target of 1 minor unit', () => {
    expect(grossUp(1, F(29_000, 30)).grossMinor).toBe(31 + 1);
  });
});

describe('grossUp — rounding boundaries the naive formula gets wrong', () => {
  it('finds the satisfying gross below the algebraic ceil (fee rounds down)', () => {
    // target 101: algebraic ceil = 105, but fee rounds down enough at 104.
    expect(grossUp(101, F(29_000, 0)).grossMinor).toBe(104);
  });

  it('walks up when the algebraic candidate nets one minor unit short', () => {
    // Multi-part fees round each component separately, so the ceiled algebraic
    // bound can undershoot: ceil((448+30)/0.956) = 500 nets only 447 here.
    const fee = F(29_000, 30, 15_000, 0);
    expect(netAt(500, fee)).toBe(447);
    const { grossMinor, netMinor } = grossUp(448, fee);
    expect(grossMinor).toBe(501);
    expect(netMinor).toBe(448);
  });
});

describe('grossUp — invariants across a grid', () => {
  const fees: FeeConfig[] = [
    F(29_000, 30),
    F(29_000, 0),
    F(0, 30),
    F(34_900, 49),
    F(29_900, 49),
    F(15_000, 20),
    F(33_000, 30),
    F(29_000, 30, 15_000, 0),
    F(29_000, 30, 0, 50),
    F(10_000, 0, 5_000, 25),
    F(0, 0),
    F(500, 1),
    F(900_000, 0),
  ];

  it('net >= target at the returned gross, for every fee and many targets', () => {
    for (const fee of fees) {
      for (let target = 1; target <= 20_000; target += 97) {
        const { grossMinor, netMinor } = grossUp(target, fee);
        expect(netMinor, `fee=${JSON.stringify(fee)} target=${target}`).toBeGreaterThanOrEqual(
          target,
        );
        expect(grossMinor).toBeGreaterThanOrEqual(target);
      }
    }
  });

  it('is minimal: gross - 1 never still satisfies the target', () => {
    for (const fee of fees) {
      for (let target = 1; target <= 20_000; target += 113) {
        const { grossMinor } = grossUp(target, fee);
        if (grossMinor > 1) {
          expect(
            netAt(grossMinor - 1, fee),
            `fee=${JSON.stringify(fee)} target=${target} gross=${grossMinor}`,
          ).toBeLessThan(target);
        }
      }
    }
  });

  it('matches brute force on a dense interval', () => {
    const fee = F(29_000, 30);
    for (let target = 1; target <= 2_000; target++) {
      let brute = target;
      while (netAt(brute, fee) < target) brute++;
      expect(grossUp(target, fee).grossMinor).toBe(brute);
    }
  });
});

describe('grossUp — errors', () => {
  it('throws when rates reach 100%', () => {
    expect(() => grossUp(100, F(1_000_000, 0))).toThrow(GrossUpError);
    expect(() => grossUp(100, F(600_000, 0, 400_000, 0))).toThrow(GrossUpError);
  });
});

describe('calculate — forward/reverse integration', () => {
  it('forward: gross − roundedFee = net', () => {
    const r = forward(103_017, F(29_000, 30));
    expect(r.netMinor).toBe(100_000);
    expect(r.fee.totalFeeMinor).toBe(3017);
    expect(r.effectiveRatePpm).toBe(29_286); // 3017/103017 → 2.93%
  });

  it('forward with a fee that exceeds the charge nets negative', () => {
    const r = forward(30, F(29_000, 30));
    expect(r.netMinor).toBe(30 - 31);
  });

  it('reverse: returned gross makes forward() net >= target', () => {
    const r = reverse(100_000, F(29_000, 30));
    expect(r.grossMinor).toBe(103_017);
    expect(r.netMinor).toBe(100_000);
    expect(r.extraChargedMinor).toBe(3_017);
    expect(forward(r.grossMinor, F(29_000, 30)).netMinor).toBeGreaterThanOrEqual(100_000);
  });

  it('reverse of the forward value round-trips', () => {
    const fee = F(34_900, 49);
    const rev = reverse(5_000, fee);
    expect(rev.netMinor).toBeGreaterThanOrEqual(5_000);
    expect(netAt(rev.grossMinor - 1, fee)).toBeLessThan(5_000);
  });
});
