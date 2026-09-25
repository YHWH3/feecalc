/**
 * Fee model: one percentage + one fixed fee, plus an optional second
 * percentage and second fixed amount (cross-border surcharges, card-type
 * surcharges, published add-on fees). Percentages are integer
 * parts-per-million: 2.9% = 29000 ppm — exact, no floats.
 *
 * Fee rounding matches processor convention: each percentage component
 * is rounded to the nearest minor unit, half away from zero. All
 * multiplication runs through BigInt so `gross * ppm` can never lose
 * precision.
 */
import type { MinorUnits } from './money';

export const PPM_DENOMINATOR = 1_000_000;
const PPM_DENOM = BigInt(PPM_DENOMINATOR);
const HALF_PPM = PPM_DENOM / 2n;

export type FeeRounding = 'half-up' | 'up' | 'down';

export interface FeeConfig {
  /** Primary percentage, parts-per-million (2.9% → 29000). */
  percentageRatePpm: number;
  /** Fixed component in minor units ($0.30 → 30 for USD). */
  fixedFeeMinor: MinorUnits;
  /** Optional additional percentage (surcharge), ppm. 0 when absent. */
  extraPercentageRatePpm: number;
  /** Optional additional fixed amount, minor units. 0 when absent. */
  extraFixedFeeMinor: MinorUnits;
  rounding?: FeeRounding;
}

export const ZERO_FEE: FeeConfig = {
  percentageRatePpm: 0,
  fixedFeeMinor: 0,
  extraPercentageRatePpm: 0,
  extraFixedFeeMinor: 0,
};

export interface FeeBreakdown {
  percentagePartMinor: MinorUnits;
  fixedPartMinor: MinorUnits;
  extraPercentagePartMinor: MinorUnits;
  extraFixedPartMinor: MinorUnits;
  totalFeeMinor: MinorUnits;
  /** Total percentage applied (primary + extra), ppm — for display. */
  totalRatePpm: number;
}

/** Round `gross * ppm / 1e6` to a minor-unit boundary. */
export function percentPart(
  grossMinor: MinorUnits,
  ppm: number,
  rounding: FeeRounding = 'half-up',
): MinorUnits {
  if (ppm === 0 || grossMinor === 0) return 0;
  const num = BigInt(grossMinor) * BigInt(ppm);
  let result: bigint;
  if (rounding === 'up') {
    result = (num + PPM_DENOM - 1n) / PPM_DENOM;
  } else if (rounding === 'down') {
    result = num / PPM_DENOM;
  } else {
    result = (num + HALF_PPM) / PPM_DENOM;
  }
  return Number(result);
}

/** Apply the full fee to a gross amount. Returns each component + total. */
export function computeFee(grossMinor: MinorUnits, fee: FeeConfig): FeeBreakdown {
  const rounding = fee.rounding ?? 'half-up';
  const percentagePartMinor = percentPart(grossMinor, fee.percentageRatePpm, rounding);
  const extraPercentagePartMinor = percentPart(grossMinor, fee.extraPercentageRatePpm, rounding);
  return {
    percentagePartMinor,
    fixedPartMinor: fee.fixedFeeMinor,
    extraPercentagePartMinor,
    extraFixedPartMinor: fee.extraFixedFeeMinor,
    totalFeeMinor:
      percentagePartMinor + fee.fixedFeeMinor + extraPercentagePartMinor + fee.extraFixedFeeMinor,
    totalRatePpm: fee.percentageRatePpm + fee.extraPercentageRatePpm,
  };
}

export function feeIsZero(fee: FeeConfig): boolean {
  return (
    fee.percentageRatePpm === 0 &&
    fee.fixedFeeMinor === 0 &&
    fee.extraPercentageRatePpm === 0 &&
    fee.extraFixedFeeMinor === 0
  );
}

/* ---------- percentage input parsing ---------- */

export interface RateParseOk {
  ok: true;
  ppm: number;
}
export interface RateParseErr {
  ok: false;
  code: 'empty' | 'malformed' | 'negative' | 'precision' | 'too_large';
  message: string;
}
export type RateParseResult = RateParseOk | RateParseErr;

const MAX_RATE_PPM = PPM_DENOMINATOR; // ≥100% can never reach a positive net
const RATE_PRECISION_LIMIT = 4; // decimals accepted in the % input (0.0001% granularity)
const RATE_GROUPING_RE = /[\s'_’,]/g;

/**
 * Parse a percentage string ("2.9", "0.035") into integer ppm.
 * String-level parsing — the float `2.9 * anything` is never used.
 */
export function parseRate(input: string): RateParseResult {
  const raw = input.trim().replace(/%$/, '').trim();
  if (raw === '') {
    return { ok: false, code: 'empty', message: 'Enter a percentage, e.g. 2.9.' };
  }
  if (raw.startsWith('-') || /^−/.test(raw)) {
    return { ok: false, code: 'negative', message: 'Rate cannot be negative.' };
  }
  const cleaned = raw.replace(RATE_GROUPING_RE, '').replace(/^\+/, '');
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) {
    return { ok: false, code: 'malformed', message: 'Enter a valid percentage, e.g. 2.9.' };
  }
  const [intPart, fracPart = ''] = cleaned.split('.');
  if (fracPart.length > RATE_PRECISION_LIMIT) {
    return {
      ok: false,
      code: 'precision',
      message: `Rates support at most ${RATE_PRECISION_LIMIT} decimals.`,
    };
  }
  const ppm = Number(intPart || '0') * 10_000 + Number(fracPart.padEnd(4, '0'));
  if (!Number.isSafeInteger(ppm)) {
    return { ok: false, code: 'malformed', message: 'Enter a valid percentage, e.g. 2.9.' };
  }
  if (ppm >= MAX_RATE_PPM) {
    return { ok: false, code: 'too_large', message: 'Rate must be under 100%.' };
  }
  return { ok: true, ppm };
}

/** ppm → display percentage string: 29000 → "2.9". Exact to 4 decimals. */
export function ppmToInput(ppm: number): string {
  const whole = Math.floor(ppm / 10_000);
  const frac = ppm % 10_000;
  if (frac === 0) return String(whole);
  const fracStr = String(frac).padStart(4, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Effective percentage of `part` relative to `whole`, in ppm. */
export function effectivePpm(part: MinorUnits, whole: MinorUnits): number {
  if (whole === 0) return 0;
  return Number((BigInt(part) * PPM_DENOM) / BigInt(whole));
}
