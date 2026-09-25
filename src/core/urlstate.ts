/**
 * URL share-state: encode/decode the calculator's inputs in query
 * params so a configured calculation can be linked. Decoding is strict
 * and total — every param is validated against the same rules as the
 * form fields; anything invalid is dropped to defaults, never coerced.
 * Params encode inputs (raw field strings), never results.
 */
import { currencyByCode, DEFAULT_CURRENCY } from './currencies';
import { presetById } from './presets';
import type { CalcMode } from './calculate';

export interface CalcState {
  mode: CalcMode;
  /** Raw amount text as the user typed it. */
  amount: string;
  currency: string;
  /** Preset id, or null for custom fee entry. */
  preset: string | null;
  percentage: string;
  fixed: string;
  extraPercentage: string;
  extraFixed: string;
}

export const DEFAULT_STATE: CalcState = {
  mode: 'receive',
  amount: '',
  currency: DEFAULT_CURRENCY,
  preset: 'stripe-us-domestic',
  percentage: '2.9',
  fixed: '0.30',
  extraPercentage: '',
  extraFixed: '',
};

const MAX_FIELD_LEN = 32;

function clean(v: string | null): string {
  if (v === null) return '';
  const t = v.trim();
  return t.length > MAX_FIELD_LEN ? t.slice(0, MAX_FIELD_LEN) : t;
}

/** Encode non-default fields. Mode 'receive' + defaults yield an empty query. */
export function encodeState(state: CalcState): string {
  const p = new URLSearchParams();
  if (state.mode !== 'receive') p.set('mode', state.mode);
  if (state.amount !== '') p.set('amt', state.amount);
  if (state.currency !== DEFAULT_CURRENCY) p.set('cur', state.currency);
  if (state.preset !== DEFAULT_STATE.preset) p.set('pre', state.preset ?? 'custom');
  if (state.preset === null) {
    if (state.percentage !== '') p.set('p', state.percentage);
    if (state.fixed !== '') p.set('f', state.fixed);
    if (state.extraPercentage !== '') p.set('ep', state.extraPercentage);
    if (state.extraFixed !== '') p.set('ef', state.extraFixed);
  }
  const q = p.toString();
  return q === '' ? '' : `?${q}`;
}

/** Decode params; invalid values silently fall back to defaults. */
export function decodeState(params: URLSearchParams): CalcState {
  const state: CalcState = { ...DEFAULT_STATE };

  const mode = params.get('mode');
  if (mode === 'receive' || mode === 'charge') state.mode = mode;

  const cur = params.get('cur');
  if (cur && currencyByCode(cur)) state.currency = cur.toUpperCase();

  const pre = params.get('pre');
  if (pre !== null) {
    if (pre === 'custom') {
      state.preset = null;
    } else if (presetById(pre)) {
      state.preset = pre;
      const preset = presetById(pre);
      if (preset) state.currency = preset.currency;
    }
    // unknown preset ids are ignored
  }
  if (state.preset !== null) {
    const preset = presetById(state.preset);
    if (preset) state.currency = preset.currency;
  }

  // fee fields only mean something in custom mode
  if (state.preset === null) {
    state.percentage = clean(params.get('p')) || DEFAULT_STATE.percentage;
    state.fixed = clean(params.get('f')) || DEFAULT_STATE.fixed;
    state.extraPercentage = clean(params.get('ep'));
    state.extraFixed = clean(params.get('ef'));
  }

  state.amount = clean(params.get('amt'));
  return state;
}
