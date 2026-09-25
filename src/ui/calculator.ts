/**
 * Calculator controller — the only client-side code on the page.
 * Presentation only: every number flows through src/core domain
 * functions (integer minor units, ppm rates). No framework, no
 * hydration islands, no data leaves the browser.
 */
import { forward, reverse, type CalcMode, type CalcResult } from '../core/calculate';
import { currencyByCode, DEFAULT_CURRENCY, type Currency } from '../core/currencies';
import { parseRate, ppmToInput, type FeeConfig } from '../core/fee';
import { GrossUpError } from '../core/grossup';
import { formatMoney, formatSigned, minorToInput, parseAmount } from '../core/money';
import { presetById } from '../core/presets';
import { decodeState, encodeState } from '../core/urlstate';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const form = el<HTMLFormElement>('calc');
const amountInput = el<HTMLInputElement>('amount');
const amountLabel = el<HTMLLabelElement>('amount-label');
const amountError = el<HTMLElement>('amount-error');
const currencySelect = el<HTMLSelectElement>('currency');
const presetSelect = el<HTMLSelectElement>('preset');
const presetMeta = el<HTMLElement>('preset-meta');
const presetConditions = el<HTMLElement>('preset-conditions');
const pctInput = el<HTMLInputElement>('pct');
const pctError = el<HTMLElement>('pct-error');
const fixedInput = el<HTMLInputElement>('fixed');
const fixedError = el<HTMLElement>('fixed-error');
const epctInput = el<HTMLInputElement>('epct');
const epctError = el<HTMLElement>('epct-error');
const efixedInput = el<HTMLInputElement>('efixed');
const efixedError = el<HTMLElement>('efixed-error');
const resultSection = el<HTMLElement>('result');
const resultLabel = el<HTMLElement>('result-label');
const resultMain = el<HTMLElement>('result-main');
const breakdownEl = el<HTMLElement>('breakdown');
const copyBtn = el<HTMLButtonElement>('copy');
const copyLinkBtn = el<HTMLButtonElement>('copy-link');
const noJsEl = el<HTMLElement>('no-js');

let lastResult: CalcResult | null = null;
let currency: Currency = currencyByCode(DEFAULT_CURRENCY)!;
// An untouched empty field isn't an error yet — flag it once the user
// actually interacts (input or leaving the field).
let amountDirty = false;

/* ---------- field helpers ---------- */

function setError(input: HTMLElement, errEl: HTMLElement, message: string | null): void {
  if (message === null) {
    errEl.hidden = true;
    errEl.textContent = '';
    input.removeAttribute('aria-invalid');
  } else {
    errEl.hidden = false;
    errEl.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }
}

function mode(): CalcMode {
  const checked = form.querySelector<HTMLInputElement>('input[name="mode"]:checked');
  return checked?.value === 'charge' ? 'charge' : 'receive';
}

function setMode(m: CalcMode): void {
  const radio = form.querySelector<HTMLInputElement>(`input[name="mode"][value="${m}"]`);
  if (radio) radio.checked = true;
  amountLabel.textContent =
    m === 'receive' ? 'Amount you want to receive' : 'Amount you plan to charge';
}

/* ---------- preset / currency interplay ---------- */

function applyPreset(id: string): void {
  const preset = presetById(id);
  if (!preset) return;
  const cur = currencyByCode(preset.currency);
  if (cur) {
    currency = cur;
    currencySelect.value = cur.code;
  }
  pctInput.value = ppmToInput(preset.fee.percentageRatePpm);
  fixedInput.value = minorToInput(preset.fee.fixedFeeMinor, currency);
  epctInput.value = preset.fee.extraPercentageRatePpm
    ? ppmToInput(preset.fee.extraPercentageRatePpm)
    : '';
  efixedInput.value = preset.fee.extraFixedFeeMinor
    ? minorToInput(preset.fee.extraFixedFeeMinor, currency)
    : '';
  renderPresetMeta();
}

function renderPresetMeta(): void {
  presetConditions.replaceChildren();
  const id = presetSelect.value;
  if (id === 'custom') {
    presetMeta.textContent = 'Enter the fee your provider actually charges.';
    return;
  }
  const preset = presetById(id);
  if (!preset) {
    presetMeta.textContent = '';
    return;
  }
  presetMeta.replaceChildren(
    document.createTextNode(`${preset.provider} — ${preset.market}. `),
    Object.assign(document.createElement('a'), {
      href: preset.sourceUrl,
      textContent: preset.sourceLabel,
      rel: 'noopener noreferrer',
    }),
    document.createTextNode(
      `, verified ${preset.verifiedAt}. Fees change — verify for your account.`,
    ),
  );
  for (const cond of preset.conditions) {
    const li = document.createElement('li');
    li.textContent = cond;
    presetConditions.append(li);
  }
}

/* ---------- validation + compute ---------- */

function readFee(): { fee: FeeConfig | null; hadError: boolean } {
  let hadError = false;

  const pct = parseRate(pctInput.value === '' ? '0' : pctInput.value);
  if (pct.ok) setError(pctInput, pctError, null);
  else {
    setError(pctInput, pctError, pct.message);
    hadError = true;
  }

  const fixed =
    fixedInput.value.trim() === ''
      ? { ok: true as const, value: 0 }
      : parseAmount(fixedInput.value, currency);
  if (fixed.ok) setError(fixedInput, fixedError, null);
  else {
    setError(fixedInput, fixedError, fixed.message);
    hadError = true;
  }

  const epct =
    epctInput.value.trim() === '' ? { ok: true as const, ppm: 0 } : parseRate(epctInput.value);
  if (epct.ok) setError(epctInput, epctError, null);
  else {
    setError(epctInput, epctError, epct.message);
    hadError = true;
  }

  const efixed =
    efixedInput.value.trim() === ''
      ? { ok: true as const, value: 0 }
      : parseAmount(efixedInput.value, currency);
  if (efixed.ok) setError(efixedInput, efixedError, null);
  else {
    setError(efixedInput, efixedError, efixed.message);
    hadError = true;
  }

  if (hadError) return { fee: null, hadError };
  return {
    fee: {
      percentageRatePpm: (pct as { ppm: number }).ppm,
      fixedFeeMinor: (fixed as { value: number }).value,
      extraPercentageRatePpm: (epct as { ppm: number }).ppm,
      extraFixedFeeMinor: (efixed as { value: number }).value,
    },
    hadError,
  };
}

function compute(): CalcResult | null {
  const amount = parseAmount(amountInput.value, currency);
  if (!amount.ok) {
    setError(
      amountInput,
      amountError,
      amount.code === 'empty' && !amountDirty ? null : amount.message,
    );
    return null;
  }
  setError(amountInput, amountError, null);
  if (amount.value === 0) {
    setError(amountInput, amountError, 'Amount must be greater than zero.');
    return null;
  }

  const { fee, hadError } = readFee();
  if (!fee || hadError) return null;

  try {
    return mode() === 'receive' ? reverse(amount.value, fee) : forward(amount.value, fee);
  } catch (err) {
    const message =
      err instanceof GrossUpError
        ? err.code === 'unreachable'
          ? 'These fees add up to 100% or more — a positive payout is impossible.'
          : 'The required charge is too large.'
        : 'Could not compute this fee.';
    setError(pctInput, pctError, message);
    return null;
  }
}

/* ---------- rendering ---------- */

function row(term: string, value: string, strong = false): [HTMLElement, HTMLElement] {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (strong) {
    dt.style.fontWeight = '700';
    dd.style.fontWeight = '700';
  }
  const wrap = document.createElement('div');
  wrap.className = 'row' + (strong ? ' total' : '');
  wrap.append(dt, dd);
  return [wrap, dd];
}

function render(result: CalcResult | null): void {
  lastResult = result;
  if (!result) {
    resultSection.hidden = true;
    return;
  }
  const cur = currency;
  const { fee } = result;
  const pctDisplay = ppmToInput(fee.totalRatePpm);

  if (result.mode === 'receive') {
    resultLabel.textContent = 'Charge at least';
    resultMain.textContent = formatMoney(result.grossMinor, cur);
  } else {
    resultLabel.textContent = 'You receive';
    resultMain.textContent = formatMoney(result.netMinor, cur);
  }

  breakdownEl.replaceChildren();
  const add = (term: string, value: string, strong = false) =>
    breakdownEl.append(row(term, value, strong)[0]);

  if (result.mode === 'receive') {
    add('You want to receive', formatMoney(result.grossMinor - result.extraChargedMinor, cur));
  } else {
    add('Charge amount', formatMoney(result.grossMinor, cur));
  }
  add(
    `Percentage fee (${pctDisplay}%)`,
    formatSigned(-fee.percentagePartMinor - fee.extraPercentagePartMinor, cur),
  );
  if (fee.extraFixedPartMinor > 0) {
    add('Fixed fees', formatSigned(-fee.fixedPartMinor - fee.extraFixedPartMinor, cur));
  } else {
    add('Fixed fee', formatSigned(-fee.fixedPartMinor, cur));
  }
  add('Total processing fee', formatSigned(-fee.totalFeeMinor, cur), true);
  if (result.mode === 'receive') {
    add('You receive', formatMoney(result.netMinor, cur));
    add('Extra charged to cover the fee', formatSigned(result.extraChargedMinor, cur));
  }
  add('Effective fee rate', `${(result.effectiveRatePpm / 10_000).toFixed(2)}%`);

  resultSection.hidden = false;
}

/* ---------- URL share-state ---------- */

function currentState() {
  return {
    mode: mode(),
    amount: amountInput.value.trim(),
    currency: currency.code,
    preset: presetSelect.value === 'custom' ? null : presetSelect.value,
    percentage: pctInput.value.trim(),
    fixed: fixedInput.value.trim(),
    extraPercentage: epctInput.value.trim(),
    extraFixed: efixedInput.value.trim(),
  };
}

function syncUrl(): void {
  const qs = encodeState(currentState());
  const url = window.location.pathname + qs + window.location.hash;
  history.replaceState(null, '', url);
}

/* ---------- events ---------- */

function update(): void {
  // Mode radios are clicked directly, so re-sync the label from what's
  // actually checked (setMode also covers URL-restored state in init).
  setMode(mode());
  render(compute());
  syncUrl();
}

form.addEventListener('input', (ev) => {
  const target = ev.target as HTMLElement;
  if (target === amountInput) amountDirty = true;
  if (
    (target === pctInput ||
      target === fixedInput ||
      target === epctInput ||
      target === efixedInput) &&
    presetSelect.value !== 'custom'
  ) {
    // Editing a preset's numbers converts it to custom — the values stay.
    presetSelect.value = 'custom';
    renderPresetMeta();
  }
  update();
});

amountInput.addEventListener('blur', () => {
  // Tabbing past an empty field counts as interaction → show the error.
  if (amountDirty || amountInput.value.trim() !== '') return;
  amountDirty = true;
  update();
});

presetSelect.addEventListener('change', () => {
  if (presetSelect.value === 'custom') {
    renderPresetMeta();
  } else {
    applyPreset(presetSelect.value);
  }
  update();
});

currencySelect.addEventListener('change', () => {
  const next = currencyByCode(currencySelect.value);
  if (!next) return;
  currency = next;
  if (presetSelect.value !== 'custom') {
    // Fee numbers are denominated in the preset's currency — once the
    // currency changes they're the user's own values.
    presetSelect.value = 'custom';
    renderPresetMeta();
  }
  update();
});

async function copyText(text: string, btn: HTMLButtonElement, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const original = btn.textContent ?? '';
  btn.textContent = done;
  setTimeout(() => {
    btn.textContent = original;
  }, 1600);
}

copyBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const minor = lastResult.mode === 'receive' ? lastResult.grossMinor : lastResult.netMinor;
  void copyText(minorToInput(minor, currency), copyBtn, 'Copied');
});

copyLinkBtn.addEventListener('click', () => {
  void copyText(window.location.href, copyLinkBtn, 'Link copied');
});

/* ---------- init ---------- */

function init(): void {
  const state = decodeState(new URLSearchParams(window.location.search));
  setMode(state.mode);
  const cur = currencyByCode(state.currency);
  if (cur) {
    currency = cur;
    currencySelect.value = cur.code;
  }
  amountInput.value = state.amount;
  if (state.preset === null) {
    presetSelect.value = 'custom';
    pctInput.value = state.percentage;
    fixedInput.value = state.fixed;
    epctInput.value = state.extraPercentage;
    efixedInput.value = state.extraFixed;
  } else {
    presetSelect.value = state.preset;
    applyPreset(state.preset);
  }
  renderPresetMeta();
  noJsEl.hidden = true;
  update();
}

init();
