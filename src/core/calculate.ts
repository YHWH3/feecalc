/**
 * Calculator use-cases. The UI calls these two functions; everything
 * monetary flows through integer minor units and the fee pipeline in
 * fee.ts/grossup.ts.
 */
import { computeFee, effectivePpm, type FeeBreakdown, type FeeConfig } from './fee';
import { grossUp } from './grossup';
import type { MinorUnits } from './money';

export type CalcMode = 'receive' | 'charge';

export interface CalcResult {
  mode: CalcMode;
  /** Amount the payer is charged. */
  grossMinor: MinorUnits;
  /** Net the recipient gets after the fee. */
  netMinor: MinorUnits;
  /** Fee components at `grossMinor`. */
  fee: FeeBreakdown;
  /** Total fee ÷ gross, ppm (effective percentage cost). */
  effectiveRatePpm: number;
  /** Receive-mode: extra charged on top of the desired net (= gross − target). */
  extraChargedMinor: MinorUnits;
}

/** "I plan to charge X" → what the recipient actually receives. */
export function forward(grossMinor: MinorUnits, fee: FeeConfig): CalcResult {
  const breakdown = computeFee(grossMinor, fee);
  const net = grossMinor - breakdown.totalFeeMinor;
  return {
    mode: 'charge',
    grossMinor,
    netMinor: net,
    fee: breakdown,
    effectiveRatePpm: grossMinor > 0 ? effectivePpm(breakdown.totalFeeMinor, grossMinor) : 0,
    extraChargedMinor: breakdown.totalFeeMinor,
  };
}

/**
 * "I want to receive X" → minimum gross to charge so the net after the
 * rounded fee is ≥ target. Throws GrossUpError when unreachable.
 */
export function reverse(targetNetMinor: MinorUnits, fee: FeeConfig): CalcResult {
  const { grossMinor, netMinor } = grossUp(targetNetMinor, fee);
  const breakdown = computeFee(grossMinor, fee);
  return {
    mode: 'receive',
    grossMinor,
    netMinor,
    fee: breakdown,
    effectiveRatePpm: grossMinor > 0 ? effectivePpm(breakdown.totalFeeMinor, grossMinor) : 0,
    extraChargedMinor: grossMinor - targetNetMinor,
  };
}
