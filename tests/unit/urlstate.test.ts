import { describe, it, expect } from 'vitest';
import { decodeState, encodeState, DEFAULT_STATE, type CalcState } from '../../src/core/urlstate';

describe('encodeState / decodeState', () => {
  it('encodes defaults as an empty query', () => {
    expect(encodeState(DEFAULT_STATE)).toBe('');
  });

  it('round-trips a fully custom state', () => {
    const state: CalcState = {
      mode: 'charge',
      amount: '1,500.00',
      currency: 'GBP',
      preset: null,
      percentage: '3.49',
      fixed: '0.49',
      extraPercentage: '1.5',
      extraFixed: '0.25',
    };
    const qs = encodeState(state);
    expect(qs).toContain('mode=charge');
    expect(qs).toContain('pre=custom');
    const decoded = decodeState(new URLSearchParams(qs.slice(1)));
    expect(decoded.mode).toBe('charge');
    expect(decoded.amount).toBe('1,500.00');
    expect(decoded.preset).toBeNull();
    expect(decoded.percentage).toBe('3.49');
    expect(decoded.fixed).toBe('0.49');
    expect(decoded.extraPercentage).toBe('1.5');
    expect(decoded.extraFixed).toBe('0.25');
    // currency follows the custom value (no preset forces it)
    expect(decoded.currency).toBe('GBP');
  });

  it('encodes a preset choice without fee fields', () => {
    const state: CalcState = { ...DEFAULT_STATE, preset: 'paypal-us-checkout' };
    const qs = encodeState(state);
    expect(qs).toContain('pre=paypal-us-checkout');
    expect(qs).not.toContain('p=');
    const decoded = decodeState(new URLSearchParams(qs.slice(1)));
    expect(decoded.preset).toBe('paypal-us-checkout');
    expect(decoded.currency).toBe('USD');
  });

  it('preset selection forces the preset currency', () => {
    const decoded = decodeState(new URLSearchParams('pre=stripe-uk-domestic&cur=EUR'));
    expect(decoded.currency).toBe('GBP'); // preset wins
  });
});

describe('decodeState — garbage handling', () => {
  it('falls back to defaults on bad values', () => {
    const decoded = decodeState(
      new URLSearchParams('mode=hack&cur=XXX&pre=nope&amt=<script>&p=zzz'),
    );
    expect(decoded.mode).toBe('receive');
    expect(decoded.currency).toBe('USD');
    expect(decoded.preset).toBe('stripe-us-domestic');
  });

  it('truncates absurdly long fields', () => {
    const decoded = decodeState(new URLSearchParams(`amt=${'9'.repeat(1000)}`));
    expect(decoded.amount.length).toBeLessThanOrEqual(32);
  });

  it('handles empty params object', () => {
    const decoded = decodeState(new URLSearchParams(''));
    expect(decoded).toEqual(DEFAULT_STATE);
  });
});
