/**
 * Reverse fee calculation: the minimum chargeable gross (in minor
 * units) such that, after the processor's *rounded* fee is deducted,
 * the recipient nets at least the target.
 *
 * The algebraic gross-up `(net + fixed) / (1 - rate)` is only a bound:
 * real processors round each fee to currency precision. Rounding can
 * push the net one minor unit below the target (fix-up needed), but it
 * can also round the fee *down*, letting a gross slightly under the
 * algebraic bound already satisfy the target (walk-down needed).
 *
 * For rates under 100% the rounded fee grows by at most one minor unit
 * per gross minor unit, so the net is nondecreasing in gross and the
 * satisfying grosses form a contiguous range — the first one found is
 * the minimum. Unit tests assert both invariants directly.
 */
import { computeFee, PPM_DENOMINATOR, type FeeConfig } from './fee';
import type { MinorUnits } from './money';
import { MAX_MINOR } from './money';

export interface GrossUpResult {
  /** Minimum gross to charge, minor units. */
  grossMinor: MinorUnits;
  /** Net after the rounded fee at that gross. */
  netMinor: MinorUnits;
}

export class GrossUpError extends Error {
  readonly code: 'unreachable' | 'too_large';
  constructor(code: 'unreachable' | 'too_large', message: string) {
    super(message);
    this.code = code;
  }
}

const MAX_STEPS = 100_000;

export function grossUp(targetNetMinor: MinorUnits, fee: FeeConfig): GrossUpResult {
  const totalPpm = fee.percentageRatePpm + fee.extraPercentageRatePpm;
  if (totalPpm >= PPM_DENOMINATOR) {
    throw new GrossUpError('unreachable', 'A 100%+ fee can never net a positive amount.');
  }

  const net = (gross: MinorUnits): MinorUnits => gross - computeFee(gross, fee).totalFeeMinor;

  const fixed = BigInt(fee.fixedFeeMinor + fee.extraFixedFeeMinor);
  const denom = BigInt(PPM_DENOMINATOR - totalPpm);
  // Algebraic bound: gross ≥ (target + fixed) * 1e6 / (1e6 - totalPpm).
  const numerator = (BigInt(targetNetMinor) + fixed) * BigInt(PPM_DENOMINATOR);
  let gross = Number((numerator + denom - 1n) / denom);
  if (!Number.isSafeInteger(gross) || gross > MAX_MINOR) {
    throw new GrossUpError('too_large', 'The required charge is too large.');
  }

  // Fix-up: rounding the fee up can leave the net one minor unit short.
  let steps = 0;
  while (net(gross) < targetNetMinor) {
    gross += 1;
    if (gross > MAX_MINOR || ++steps > MAX_STEPS) {
      throw new GrossUpError('too_large', 'The required charge is too large.');
    }
  }
  // Walk-down: rounding the fee down can already satisfy a lower gross.
  while (gross > 1 && net(gross - 1) >= targetNetMinor) {
    gross -= 1;
    if (++steps > MAX_STEPS) {
      throw new GrossUpError('too_large', 'The required charge is too large.');
    }
  }
  return { grossMinor: gross, netMinor: net(gross) };
}
