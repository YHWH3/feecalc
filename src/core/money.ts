/**
 * Money handling in integer minor units. No binary floating point is
 * ever used to represent or compute a monetary value — parsing is pure
 * string/integer arithmetic and formatting goes through Intl or plain
 * integer string building.
 */
import { multiplier, type Currency } from './currencies';

/** Integer minor units: cents for USD, pence for GBP, fils for AED… */
export type MinorUnits = number;

/** Hard ceiling — no legitimate single invoice approaches this. */
export const MAX_MINOR: MinorUnits = 10 ** 13; // e.g. $100 billion USD

export interface ParseOk {
  ok: true;
  value: MinorUnits;
}
export interface ParseErr {
  ok: false;
  code: 'empty' | 'malformed' | 'negative' | 'precision' | 'too_large';
  message: string;
}
export type ParseResult = ParseOk | ParseErr;

const GROUPING_SEPARATORS = /[\s'_’]/g;

function isDigits(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return s.length > 0;
}

/**
 * Parse a user-typed amount ("1,234.56", "10,50", "1234") into integer
 * minor units. Locale-tolerant: with both '.' and ',' present the LAST
 * separator is decimal; a lone ',' followed by exactly `minorUnits`
 * digits is decimal, by three digits is a group separator.
 * Never silently coerces — every rejected input maps to a clear error.
 */
export function parseAmount(input: string, currency: Currency): ParseResult {
  const raw = input.trim();
  if (raw === '') {
    return { ok: false, code: 'empty', message: 'Enter an amount.' };
  }
  if (raw.startsWith('-') || /^−/.test(raw)) {
    return { ok: false, code: 'negative', message: 'Amount must be positive.' };
  }

  const cleaned = raw.replace(GROUPING_SEPARATORS, '').replace(/^\+/, '');
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;

  // A run of separators inside the integer part is only a valid
  // thousands grouping if every group after it has exactly 3 digits.
  const groupingOk = (intSection: string): boolean =>
    /^\d+$/.test(intSection) || /^\d{1,3}([.,]\d{3})+$/.test(intSection);

  let normalized = cleaned;
  if (dotCount > 1 || (dotCount >= 1 && commaCount >= 1)) {
    // '.' present: last of either separator is decimal, the rest grouping
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decAt = Math.max(lastDot, lastComma);
    const intSection = cleaned.slice(0, decAt);
    if (!groupingOk(intSection)) {
      return { ok: false, code: 'malformed', message: 'Enter a valid number, e.g. 1,000.50.' };
    }
    normalized = intSection.replace(/[.,]/g, '') + '.' + cleaned.slice(decAt + 1);
  } else if (commaCount > 0) {
    const lastComma = cleaned.lastIndexOf(',');
    const after = cleaned.length - lastComma - 1;
    if (commaCount === 1 && after !== 3) {
      // lone comma not followed by 3 digits = decimal separator
      normalized = cleaned.slice(0, lastComma) + '.' + cleaned.slice(lastComma + 1);
    } else {
      // commas used as grouping — every group must be 3 digits
      if (!groupingOk(cleaned)) {
        return { ok: false, code: 'malformed', message: 'Enter a valid number, e.g. 1,000.50.' };
      }
      normalized = cleaned.replace(/,/g, '');
    }
  }

  const dot = normalized.indexOf('.');
  const intPart = (dot === -1 ? normalized : normalized.slice(0, dot)) || '0';
  const fracPart = dot === -1 ? '' : normalized.slice(dot + 1);

  if (!isDigits(intPart) || (fracPart !== '' && !isDigits(fracPart))) {
    return { ok: false, code: 'malformed', message: 'Enter a valid number, e.g. 1,000.50.' };
  }
  if (normalized === '' || normalized === '.') {
    return { ok: false, code: 'malformed', message: 'Enter a valid number, e.g. 1,000.50.' };
  }
  if (fracPart.length > currency.minorUnits) {
    return {
      ok: false,
      code: 'precision',
      message: `Too many decimals — ${currency.code} allows ${currency.minorUnits}.`,
    };
  }

  const fracPadded = fracPart.padEnd(currency.minorUnits, '0');
  const minor = Number(intPart + fracPadded);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) {
    return { ok: false, code: 'too_large', message: 'Amount is too large.' };
  }
  return { ok: true, value: minor };
}

/** Format minor units for display: "$1,234.56". Intl handles grouping. */
export function formatMoney(minor: MinorUnits, currency: Currency): string {
  const nf = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.minorUnits,
    maximumFractionDigits: currency.minorUnits,
  });
  return nf.format(minor / multiplier(currency));
}

/** Format minor units as a plain decimal string for inputs: "1234.56". */
export function minorToInput(minor: MinorUnits, currency: Currency): string {
  const mult = multiplier(currency);
  const int = Math.floor(minor / mult);
  const frac = minor % mult;
  if (currency.minorUnits === 0) return String(int);
  return `${int}.${String(frac).padStart(currency.minorUnits, '0')}`;
}

/** "+$1,234.56" style signed display for deltas. */
export function formatSigned(minor: MinorUnits, currency: Currency): string {
  const sign = minor < 0 ? '−' : '+';
  return `${sign}${formatMoney(Math.abs(minor), currency)}`;
}
