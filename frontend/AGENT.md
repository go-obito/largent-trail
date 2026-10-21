# AGENT.md — Largent web app (`frontend/`)

Largent web is the mobile-first PWA for the Largent personal finance app (Ghana, GHS). It talks to the FastAPI backend in `apps/api` and signs users in with Clerk. This file tells AI coding agents how to build and contribute to `frontend`.

**Use this file when:** writing or changing anything under `frontend`.

**Always:** follow the conventions below, run `pnpm check` before finishing each checkpoint, and ask once (with a recommendation) when something is not covered. The root `AGENT.md` governs the backend and the shared rules on money; this file governs the frontend.

---

## 1. Boundaries

- Work only in `frontend`. Never edit `apps/api`. If the frontend needs a backend change, describe it in your report (endpoint, field, reason) and work around it meanwhile.
- The backend contract is `apps/api/openapi.json`. Types are **generated** from it; never hand-write API types.
- Backend steps B8 (offline sync), B9 (CSV import), B10 (export, deletion, hardening) and B11 (deploy) may not exist yet. Do not build UI for endpoints that are not in `openapi.json`.

## 2. Stack (fixed unless an ADR changes it)

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), current stable release, `src/` directory |
| Language | TypeScript, `strict: true` |
| Package manager | **pnpm** (via corepack). **Never run `npm` or `yarn`.** Commit `pnpm-lock.yaml` |
| Components | Material UI (`@mui/material`) for interactive components (inputs, dialogs, menus, selects, snackbars) |
| Styling | Tailwind CSS for layout, spacing and custom surfaces |
| Auth | Clerk (`@clerk/nextjs`) |
| Server state | TanStack Query |
| API client | `openapi-fetch` with types from `openapi-typescript` |
| Forms | `react-hook-form` + `zod` |
| UI-only state | `zustand` (never for server data) |
| Icons | `lucide-react` (not `@mui/icons-material`; it bloats the bundle) |
| PWA | Serwist (service worker) + a web app manifest |

Adding a dependency needs a one-line justification in `docs/DECISIONS.md`. Prefer what is already installed. Keep the bundle small: the main users are on mobile data.

## 3. MUI and Tailwind rules (they fight if unmanaged)

- Set up CSS layers once: `@layer theme, base, mui, components, utilities;`, and render MUI with `enableCssLayer` through `@mui/material-nextjs` so Tailwind utilities can override MUI styles without `!important`. Verify the exact setup against the current MUI and Tailwind docs.
- **MUI owns behavior and form controls. Tailwind owns layout.** Use `className` utilities for spacing, grid, flex, sizing and the custom cards. Do not restyle MUI internals with Tailwind arbitrary selectors.
- **One source of truth for colors and radii: `src/styles/palette.ts`** (the Cobalt & Cloud tokens). `pnpm gen:tokens` generates `src/styles/tokens.css` (CSS variables for light and dark) from it; the MUI theme imports `palette.ts` directly and Tailwind's theme references the CSS variables. Never edit `tokens.css` by hand and never hard-code hex values in components.
- Import MUI per component (`import Button from '@mui/material/Button'`), never from the package barrel.
- Use native `<input type="date">` for dates. Do not add `@mui/x-date-pickers` or MUI X charts.

## 4. Design language (from the prototype)

- Mobile first (design at 390px wide), light gray page background, large rounded cards (about 24px radius), generous spacing.
- **Cobalt & Cloud palette** (see `palette.ts`): cool cloud whites, electric cobalt primary, deep midnight navy. Light and dark themes share one brand identity. Primary actions, active tab pill, links and progress bars use `primary`; the hero balance card uses `hero` and `onHero`; income uses `success`, expenses and over-limit use `error`, near-limit uses `warning`, informational uses `info`. Status chips use a tint of the semantic color (for example `color-mix(in srgb, var(--color-success) 14%, var(--color-surface))`), never new hex values.
- Small uppercase tracking-wide captions above section titles (for example "WEEKLY MONEY OVERVIEW"), bold large figures, muted gray secondary text.
- Bottom tab bar on phones with five tabs: Home, Transactions, Budgets, Reports, Profile; the active tab is a `primary` circle with an `on-primary` icon. On `md` and wider screens use a left navigation rail and center content in a column of at most 640px.
- **Contrast rule:** `secondary` and `accent` are decorative fills and borders only. Never use them for text or icons on light surfaces (contrast is too low). Text uses `text-primary` and `text-secondary`; disabled controls use `disabled`. Focus is always visible with `focus-ring`; hover and pressed states use `primary-hover` and `primary-pressed`; selected rows and chips use `selected-surface`.
- Respect safe areas (`env(safe-area-inset-*)`), 44px minimum touch targets, and both themes: follow `prefers-color-scheme` by default, with an optional `data-theme="light|dark"` override on `<html>` (a manual toggle comes later).
- Every screen has loading (skeleton), empty, error and offline states. No blank screens.

## 5. Money, dates and numbers (critical)

- Amounts are **integer pesewas** end to end. Never use floating point for money, never parse with `parseFloat`. Provide `formatGhs(minor)` (`1300 → "₵13.00"`) and `parseGhsInput(text) → minor | null` implemented with string handling and integer math, and use only these.
- Amount inputs accept `12`, `12.5`, `12.50` and `1,200.50`; reject more than 2 decimals and anything above 10^12 pesewas.
- Dates sent to the API are `YYYY-MM-DD` **in the user's timezone** (the `timezone` from `/v1/me`, default `Africa/Accra`). Compute "today" with that timezone, not the device's. The week starts Monday.
- Percentages and statuses come from the backend. Do not recompute budget status, the daily target or balances on the client.

## 6. API access

- `src/lib/api/schema.d.ts` is generated by `pnpm gen:api` from `../apps/api/openapi.json`. Commit it. Regenerate whenever `openapi.json` changes.
- One wrapper (`src/lib/api/client.ts`) attaches `Authorization: Bearer <Clerk session token>` from `getToken()`, handles problem+json errors into a typed `ApiError` (`status`, `code`, `title`), and on a 401 with `code: "token_expired"` gets a fresh token and retries **once**.
- Never put tokens in `localStorage`, URLs or logs. Never log amounts, names, notes or URLs.
- All server data goes through TanStack Query hooks in `src/features/<feature>/api.ts`. Query keys are arrays starting with the feature name. Mutations invalidate the affected keys (a transaction change invalidates dashboard, accounts, budgets, reports).
- Creating entities: generate a **UUIDv7 `id` on the client** and send it, so retries are idempotent (backend rule). Keep a small `uuidv7()` helper.

## 7. Project layout

```
frontend/
├── AGENT.md
├── docs/DECISIONS.md
├── public/                  # manifest icons, offline page assets
└── src/
    ├── app/                 # routes only: thin pages, layouts, middleware
    │   ├── (auth)/          # sign-in, sign-up
    │   └── (app)/           # authenticated shell: page, transactions, budgets, reports, needs, profile
    ├── components/          # shared UI (cards, tab bar, states, money display)
    ├── features/            # one folder per domain: api.ts, hooks, components, schemas
    ├── lib/                 # api client, money, dates, uuid, env
    ├── styles/              # palette.ts (source of truth), tokens.css (generated), theme.ts, globals
    └── sw/                  # service worker source
```

Pages stay thin: they compose feature components. Feature folders never import from each other; shared things move to `components/` or `lib/`.

## 8. PWA and offline rules

- The app is **online-first** until backend B8 (sync) exists. Reads may be cached for offline viewing; **writes require a connection** and the UI must say so plainly (disabled actions with an "You're offline" explanation), never silently queue.
- Service worker: precache the app shell and static assets; runtime-cache images and fonts; **never cache `/v1/*` API responses or anything under the auth routes in the service worker**. Offline reading of server data goes through the TanStack Query persister (IndexedDB), not the service worker.
- Provide an offline fallback page, a complete manifest (name, short name, `display: standalone`, theme and background colors, 192 and 512 icons plus a maskable icon), Apple touch icon and `viewport-fit=cover`.
- Clear persisted query data on sign-out.
- Check current Next.js and Serwist compatibility in their official docs before wiring the service worker; if the plugin conflicts with the current bundler, report it and fall back to the documented alternative rather than hacking around it.

## 9. Security and privacy

- Only `NEXT_PUBLIC_` variables reach the browser. The Clerk secret key is server-only and never exposed. Provide `.env.example` with every variable (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, Clerk sign-in URLs).
- Authenticated routes are protected by Clerk middleware; public routes are only sign-in, sign-up and the offline page.
- Never use `dangerouslySetInnerHTML` with API or user content. Render text only.
- Set sensible response headers in `next.config` (no framing, `nosniff`, referrer policy, a restrictive permissions policy).
- The web app and the API must use the **same Clerk instance** (same issuer). The frontend origin must appear in the backend's `CLERK_AUTHORIZED_PARTIES`.

## 10. Quality (fast mode)

- **Do not write new tests** unless a prompt asks. `pnpm check` = `tsc --noEmit` + `eslint` and must pass at every checkpoint. `pnpm build` must pass at the end of each step. Never suppress TypeScript or ESLint errors with `any`, `@ts-ignore` or disabled rules without a one-line reason.
- Accessibility basics: semantic elements, labels on every input, visible focus, `aria-live` for toasts and errors, contrast of at least 4.5:1.
- Keep components small and typed. Server and client components are separated deliberately; add `'use client'` only where needed.

## 11. Commands

```
pnpm dev          # local dev server on :3000
pnpm check        # typecheck + lint
pnpm build        # production build
pnpm gen:api      # regenerate src/lib/api/schema.d.ts from ../apps/api/openapi.json
pnpm gen:tokens   # regenerate src/styles/tokens.css from src/styles/palette.ts
```

## 12. How to work

1. Post a short plan first, then work in small Conventional Commits (`feat(web):`, `fix(web):`, `chore(web):`).
2. Run `pnpm check` once per checkpoint, commit, and print one status line.
3. Ask once, with a recommendation, only when blocked on something not covered here.
4. Append decisions to `docs/DECISIONS.md`; no per-step ADRs.
5. At the end of each step, update the Status section below and report what changed, how to run it, and what is left undecided.

## 13. Status

- [x] F0 scaffold, tooling, theme, API client, auth shell, PWA basics (auth shell and PWA basics complete)
- [x] F1 dashboard
- [x] F2 transactions (checkpoints 1-3: data layer, add/edit flows, list and filters complete)
- [x] F3 budgets and alerts (checkpoints 2-3: budgets screen, forms and alerts complete)
- [ ] F4 reports
- [ ] F5 priority needs (allocation, link import)
- [ ] F6 CSV import wizard (needs backend B9)
- [ ] F7 onboarding and profile
- [ ] F8 PWA polish (install prompt, offline reads, share target)
- [ ] F9 deploy
