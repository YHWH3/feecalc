# FeeCalc

A fast, private **payment fee & invoice gross-up calculator**: tell it the amount you want to
end up with, and it works backwards through the processor's fee — including real fee rounding —
to give you the minimum amount to charge. Or flip direction: see what a given charge actually
nets after fees.

Everything runs in the browser. No accounts, no backend, nothing you type leaves your device.

## Stack

- [Astro](https://astro.build) 7, static output (`output: 'static'`) — deployable to any static host
- Strict TypeScript throughout; the calculator is the only client JS (one vanilla TS module)
- Framework-agnostic domain core in `src/core` — no DOM, no Astro, no framework imports
  (enforced by ESLint `no-restricted-imports`)
- Vitest (unit), Playwright + axe-core (e2e/a11y), Lighthouse (perf)

## Local development

```bash
pnpm install
pnpm dev        # dev server
pnpm build      # astro check + production build → dist/
pnpm preview    # serve the built site
```

## Commands

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `pnpm format:check` | Prettier check (`pnpm format` to fix)          |
| `pnpm lint`         | ESLint                                         |
| `pnpm typecheck`    | `astro check`                                  |
| `pnpm test`         | Unit tests (Vitest)                            |
| `pnpm e2e`          | Playwright e2e + axe (builds + previews first) |
| `pnpm perf`         | Lighthouse audit of the production build       |

## Architecture

```
src/core/        deterministic domain — pure functions, integer math only
  currencies.ts    currency metadata (code, symbol, minorUnits)
  money.ts         MinorUnits, parseAmount, formatMoney — no floats
  fee.ts           FeeConfig (pct+fixed+optional extra pct+extra fixed), ppm rates, rounding
  grossup.ts       reverse calculation: minimum gross s.t. net ≥ target
  calculate.ts     forward()/reverse() use-cases + CalcResult
  presets.ts       provider fee presets + provenance (single source of truth)
  urlstate.ts      URL share-state encode/decode (strict, garbage-safe)
src/ui/
  calculator.ts    DOM controller — presentation only, calls core
src/pages, src/layouts, src/styles   Astro page + shell + CSS
tests/unit, tests/e2e
```

### How the money math works

- All amounts are **integer minor units** (cents, pence, fils, paise). No `gross * 0.029`
  anywhere — percentages are integer **parts-per-million** (2.9% = 29000 ppm) and fee
  multiplication runs through BigInt.
- Each percentage fee component is rounded to the nearest minor unit, half away from zero —
  the convention card processors use.
- **Reverse** starts from the algebraic bound `gross ≥ (target + fixed) / (1 − rate)`, computed
  with integer ceiling, then corrects for rounding: it steps _up_ while the rounded net is short
  and _down_ while a smaller gross already satisfies the target. The result is the minimum
  chargeable gross, and the test suite asserts both invariants directly
  (`net ≥ target`, and `gross − 1` fails).

### Presets and provenance

Provider presets live only in `src/core/presets.ts`. Each entry carries the market, the currency
of the fixed fee, human-readable conditions, the **official pricing page URL** and the date it
was verified. There is deliberately no "global" Stripe/PayPal rate — presets are per-market and
per-payment-type. When provider pricing changes, update the numbers and `verifiedAt`, and keep
`conditions` honest about what the preset does not cover. If a fee can't be verified on a
first-party page, don't add it — Custom mode covers everything else.

### URL state

`?mode=&amt=&cur=&pre=` plus custom-fee params `p= f= ep= ef=` serialize the form inputs so a
configured calculation is shareable. Decoding is strict — invalid params fall back to defaults.
The canonical URL is always `/`, so parameterized URLs can't create duplicate indexable pages.

## Limitations

- Results are estimates. Providers change pricing; your account's schedule may differ.
- Presets cover a handful of verified market/payment-type combinations — check conditions.
- FX, cross-border fees, dispute fees, taxes and account-specific pricing are not modeled unless
  added via the extra fee fields.

## Configuration

`SITE_URL` (env var) sets the canonical origin at build time; defaults to `https://feecalc.com`.
