/**
 * Currency metadata. Monetary values are always integer minor units
 * (cents, pence, fils, paise…) so no binary floating point ever
 * touches a financial result.
 */
export interface Currency {
  /** ISO 4217 code. */
  code: string;
  name: string;
  symbol: string;
  /** Decimal places between major and minor units (USD: 2, JPY: 0). */
  minorUnits: number;
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'USD', name: 'US dollar', symbol: '$', minorUnits: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', minorUnits: 2 },
  { code: 'GBP', name: 'British pound', symbol: '£', minorUnits: 2 },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'CA$', minorUnits: 2 },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$', minorUnits: 2 },
  { code: 'AED', name: 'UAE dirham', symbol: 'د.إ', minorUnits: 2 },
  { code: 'INR', name: 'Indian rupee', symbol: '₹', minorUnits: 2 },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥', minorUnits: 0 },
];

const BY_CODE: ReadonlyMap<string, Currency> = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyByCode(code: string): Currency | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export const DEFAULT_CURRENCY = 'USD';

export function multiplier(currency: Currency): number {
  return 10 ** currency.minorUnits;
}
