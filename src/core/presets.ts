/**
 * Verified provider fee presets — the single authoritative source for
 * processor rates. Every preset carries provenance: the official
 * first-party pricing page and the date it was checked. Presets are
 * market- and payment-type-specific; there is no "global" Stripe or
 * PayPal rate. When a provider changes pricing, update the numbers here
 * and bump `verifiedAt`.
 */
import type { FeeConfig } from './fee';

export interface FeePreset {
  id: string;
  provider: string;
  /** Short label shown in the picker, e.g. "Online card (US domestic)". */
  label: string;
  /** Market the pricing page applies to. */
  market: string;
  /** ISO 4217 currency the fixed fee is denominated in. */
  currency: string;
  fee: FeeConfig;
  /** Human-readable conditions users must check (card type, plan tier…). */
  conditions: string[];
  sourceUrl: string;
  sourceLabel: string;
  /** ISO date the source was last checked, e.g. "2026-09-25". */
  verifiedAt: string;
}

const STRIPE_US: Omit<FeePreset, 'id' | 'label' | 'fee' | 'conditions'> = {
  provider: 'Stripe',
  market: 'United States',
  currency: 'USD',
  sourceUrl: 'https://stripe.com/pricing',
  sourceLabel: 'Stripe pricing',
  verifiedAt: '2026-09-25',
};

const PAYPAL_US: Omit<FeePreset, 'id' | 'label' | 'fee' | 'conditions'> = {
  provider: 'PayPal',
  market: 'United States',
  currency: 'USD',
  sourceUrl: 'https://www.paypal.com/us/business/paypal-business-fees',
  sourceLabel: 'PayPal merchant fees',
  verifiedAt: '2026-09-25',
};

const SQUARE_US: Omit<FeePreset, 'id' | 'label' | 'fee' | 'conditions'> = {
  provider: 'Square',
  market: 'United States',
  currency: 'USD',
  sourceUrl: 'https://squareup.com/us/en/payments/our-fees',
  sourceLabel: 'Square processing fees',
  verifiedAt: '2026-09-25',
};

export const FEE_PRESETS: readonly FeePreset[] = [
  {
    ...STRIPE_US,
    id: 'stripe-us-domestic',
    label: 'Online card — domestic',
    fee: {
      percentageRatePpm: 29_000,
      fixedFeeMinor: 30,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'Domestic cards',
      '+1.5% for international cards',
      '+1% if currency conversion required',
    ],
  },
  {
    ...STRIPE_US,
    id: 'stripe-us-international',
    label: 'Online card — international',
    fee: {
      percentageRatePpm: 29_000,
      fixedFeeMinor: 30,
      extraPercentageRatePpm: 15_000,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'International cards (2.9% + 1.5% international surcharge)',
      '+1% more if currency conversion required',
    ],
    sourceUrl: 'https://stripe.com/pricing/local-payment-methods',
  },
  {
    ...STRIPE_US,
    id: 'stripe-us-manual',
    label: 'Manually entered card',
    fee: {
      percentageRatePpm: 29_000,
      fixedFeeMinor: 30,
      extraPercentageRatePpm: 5_000,
      extraFixedFeeMinor: 0,
    },
    conditions: ['Cards keyed in manually (2.9% + 0.5% manual surcharge)'],
    sourceUrl: 'https://stripe.com/pricing/local-payment-methods',
  },
  {
    id: 'stripe-uk-domestic',
    label: 'Online card — standard UK',
    provider: 'Stripe',
    market: 'United Kingdom',
    currency: 'GBP',
    fee: {
      percentageRatePpm: 15_000,
      fixedFeeMinor: 20,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'Standard UK cards',
      '2.8% + 20p for premium UK cards',
      '2.5% + 20p for non-domestic cards',
    ],
    sourceUrl: 'https://stripe.com/gb/pricing',
    sourceLabel: 'Stripe UK pricing',
    verifiedAt: '2026-09-25',
  },
  {
    id: 'stripe-eu-eea',
    label: 'Online card — standard EEA',
    provider: 'Stripe',
    market: 'Eurozone (EEA)',
    currency: 'EUR',
    fee: {
      percentageRatePpm: 15_000,
      fixedFeeMinor: 25,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'Standard EEA cards',
      '2.8% + €0.25 premium EEA cards',
      '2.5% + €0.25 UK cards',
      '3.15–3.25% + €0.25 international',
    ],
    sourceUrl: 'https://stripe.com/en-de/pricing',
    sourceLabel: 'Stripe EU pricing',
    verifiedAt: '2026-09-25',
  },
  {
    id: 'stripe-ca-domestic',
    label: 'Online card — domestic',
    provider: 'Stripe',
    market: 'Canada',
    currency: 'CAD',
    fee: {
      percentageRatePpm: 29_000,
      fixedFeeMinor: 30,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: ['Domestic cards'],
    sourceUrl: 'https://stripe.com/en-ca/pricing',
    sourceLabel: 'Stripe Canada pricing',
    verifiedAt: '2026-09-25',
  },
  {
    id: 'stripe-au-domestic',
    label: 'Online card — domestic',
    provider: 'Stripe',
    market: 'Australia',
    currency: 'AUD',
    fee: {
      percentageRatePpm: 17_000,
      fixedFeeMinor: 30,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'Domestic cards, fees include GST',
      '3.5% + A$0.30 for international cards',
      'Stripe has announced lower domestic pricing effective 1 Oct 2026',
    ],
    sourceUrl: 'https://stripe.com/au/pricing',
    sourceLabel: 'Stripe Australia pricing',
    verifiedAt: '2026-09-25',
  },
  {
    ...PAYPAL_US,
    id: 'paypal-us-checkout',
    label: 'PayPal Checkout / Guest Checkout / Venmo',
    fee: {
      percentageRatePpm: 34_900,
      fixedFeeMinor: 49,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'PayPal Checkout, Guest Checkout and Pay with Venmo',
      'Fixed fee varies by currency: $0.49 USD',
    ],
  },
  {
    ...PAYPAL_US,
    id: 'paypal-us-card',
    label: 'Standard credit/debit card',
    fee: {
      percentageRatePpm: 29_900,
      fixedFeeMinor: 49,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: ['Standard credit and debit card payments'],
  },
  {
    ...PAYPAL_US,
    id: 'paypal-us-goods-services',
    label: 'Goods & services payment',
    fee: {
      percentageRatePpm: 29_900,
      fixedFeeMinor: 0,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: ['Send/receive money for goods and services — no fixed fee'],
  },
  {
    ...SQUARE_US,
    id: 'square-us-online',
    label: 'Online / invoice card',
    fee: {
      percentageRatePpm: 33_000,
      fixedFeeMinor: 30,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: [
      'Free plan rate for online or invoice card payments',
      'Plus/Premium plans: 2.9% + 30¢',
    ],
  },
  {
    ...SQUARE_US,
    id: 'square-us-inperson',
    label: 'In-person tap/dip/swipe',
    fee: {
      percentageRatePpm: 26_000,
      fixedFeeMinor: 15,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: ['Free plan rate when a card is present', 'Plus: 2.5% + 15¢, Premium: 2.4% + 15¢'],
  },
  {
    ...SQUARE_US,
    id: 'square-us-manual',
    label: 'Manual entry / card on file',
    fee: {
      percentageRatePpm: 35_000,
      fixedFeeMinor: 15,
      extraPercentageRatePpm: 0,
      extraFixedFeeMinor: 0,
    },
    conditions: ['Manually entered or card-on-file payments'],
  },
];

const BY_ID: ReadonlyMap<string, FeePreset> = new Map(FEE_PRESETS.map((p) => [p.id, p]));

export function presetById(id: string): FeePreset | undefined {
  return BY_ID.get(id);
}
