# Prompt F1: Dashboard (Home)

Paste everything below the line into your **frontend** coding agent. F0 must be merged and green. Backend B7 and B7b must be merged, and `apps/api/openapi.json` regenerated.

---

Read `frontend/AGENT.md` first (§4 design language, §5 money and dates, §6 API access, §10 fast mode). This is **step F1**: the Home screen. Work only in `frontend/`. Do not touch `apps/api`.

## How to work (fast mode)

- **Write no new tests.** `pnpm check` once per checkpoint, `pnpm build` at the end. Commit at every checkpoint (Conventional Commits, scope `web`) and print one status line.
- **pnpm only**, cross-platform scripts. Ask once, with a recommendation, only if blocked on something not covered here.

## Preflight

1. `git status` clean, `pnpm check` green, `frontend/AGENT.md` Status shows F0 done.
2. Run `pnpm gen:api` and commit any schema change. Confirm `GET /v1/dashboard` exists and that its response includes: `total_balance_minor`, `net_change_minor`, `week` (with `start`, `end`, `income_minor`, `spent_minor`, `budget_total_minor`, `budget_left_minor`), `daily_target` (`target_minor`, `spent_today_minor`, `left_minor`, `status`), `daily_breakdown` (7 entries with `date`, `spent_minor`), `budgets` (with `category_name`), `recent_transactions` (with `category_name`, `account_name`) and `needs` (`total_target_minor`, `total_allocated_minor`, `unallocated_savings_minor`, `over_allocated`, `items`). If anything is missing, stop and report it; do not work around it with client-side math or extra requests.

## What to build

The Home screen follows the prototype layout, restyled with the Cobalt & Cloud tokens. All figures come from one request, `GET /v1/dashboard?balance_range=...`. **Do not recompute** balances, the daily target, statuses or totals on the client (`frontend/AGENT.md` §5). Display math only (for example a progress bar width from two numbers) is fine.

### Checkpoint 1: data layer

- `src/features/dashboard/api.ts`: `useDashboard(balanceRange)` with query key `['dashboard', balanceRange]`, `balanceRange` one of `all_time | this_week | this_month`, stale time 30 seconds, refetch when the browser comes back online. Typed from the generated schema.
- A `dashboardKeys` helper so later features (transactions, budgets, needs) can invalidate `['dashboard']`.
- Small helpers in `src/features/dashboard/`: `statusToChip(status)` mapping `within_target` to a success chip "Within target", `near_limit` to a warning chip "Near limit", `over_target` to an error chip "Over target", and the same mapping for budget statuses (`within`, `near_limit`, `over_limit`) to progress bar colors (`primary`, `warning`, `error`).

Run `pnpm check`, commit.

### Checkpoint 2: sections

Build these as small components in `src/features/dashboard/components/`, composed by `src/app/(app)/page.tsx` (keep the page thin). Each section has its own loading skeleton, error state with retry and sensible empty state, so one failing section never blanks the screen.

1. **Header:** the greeting header from F0 (uppercase caption "WEEKLY MONEY OVERVIEW", "Good afternoon, {name}" by local time in the user's timezone, avatar with initial).
2. **Hero balance card** (`hero` and `on-hero` colors): "TOTAL BALANCE" caption with a status dot, the balance in large type, and a range selector (MUI `Select` or menu) with "All time", "This week", "This month". When the range is not `all_time`, show `net_change_minor` as a signed line ("+₵120.00 this week", colored with `success` or `error`). Below a divider, two columns: "Income this week" (`+₵0.00`, success dot) and "Spent this week" (`−₵13.00`, error dot).
3. **Daily spending card:** section title "Daily spending", subtitle "A simple limit for today", a small trend icon button that links to `/reports`. Card: caption "SPENT TODAY", the amount, the status chip, a progress bar (spent today against the target; bar color follows the status), "Daily target ₵39.71" and "₵26.71 left" (when `left_minor` is negative show "₵X over" in `error`), the helper text "Adjusted for what you've spent earlier this week.", and a full-width text button "Record today's spending" linking to `/transactions/new`. When `target_minor` is null show "No daily target yet" with the helper "Set a weekly budget to get a daily limit" and a link to `/budgets`.
4. **Weekly progress:** a progress bar and the line "₵13.00 of ₵278.00" with "₵265.00 left" using `week.spent_minor`, `week.budget_total_minor` and `week.budget_left_minor` (hide the line when `budget_total_minor` is null). Then "Daily breakdown" with a "This week" label and seven bars (M T W T F S S) drawn with plain SVG or CSS (no chart library): bar heights scale to the largest day, today's bar and label use `primary`, zero days show a small muted stub, and every bar has an `aria-label` such as "Monday, ₵13.00". Provide a visually hidden table with the same data for screen readers.
5. **Your budgets** (subtitle "Small steps add up", "See all" link to `/budgets`): up to 3 budgets from `budgets`, each with the category name, the period label (Weekly or Monthly), "₵13.00 of ₵78.00" and a progress bar colored by status; show a near-limit or over-limit chip when applicable. Empty state: "No budgets yet" with a button to `/budgets`.
6. **Prioritized needs** ("Add item" link to `/needs`): the summary line ("₵X allocated of ₵Y planned", and a warning line when `over_allocated`), then up to 5 `needs.items`, each with name, priority label, target and a progress bar from `percent`; completed items show a check and 100%. This list is **read-only here**; managing needs is F5. Empty state: "Nothing on your list yet".
7. **Recent activity** ("See all" link to `/transactions`): the 5 `recent_transactions`, each row with category name (or "Uncategorized"), account name, date, note when present, and the amount with a sign (`+` and `success` for income, `−` and `error` for expenses), formatted only with `formatGhs`. Empty state: "No transactions yet".

Money is formatted only through `formatGhs`. Dates are shown for the user's timezone. Tap targets are at least 44px. Both themes must look right; use only token-based colors.

Run `pnpm check`, commit.

### Checkpoint 3: states, offline and polish

- Offline: with cached data show the Home screen from cache with the F0 `OfflineBanner`; the "Record today's spending" button stays visible (the form itself arrives in F2).
- Add a small refresh action (icon button in the header area) that refetches the dashboard, with a loading indicator.
- Create a placeholder route `/transactions/new` ("Add transaction, coming in the next step") so the button does not 404.
- **Dev-only helper:** on `/profile`, when `process.env.NODE_ENV !== 'production'`, show a "Copy API token (dev only)" button that copies a fresh Clerk session token to the clipboard so the backend's `/docs` page can be authorized for seeding test data. It must not render in production builds, must never log or display the token, and must be removed from the production bundle (check with `pnpm build`).
- Respect `prefers-reduced-motion` for any animation. No hard-coded colors outside `palette.ts` and the generated `tokens.css`.

Run `pnpm check` and `pnpm build`, commit.

## Close out

- Append decisions to `docs/DECISIONS.md`. Update `frontend/AGENT.md` Status: F1 done.
- Final `pnpm check`, `pnpm build`, `git log --oneline`, clean `git status`.

## Constraints

- No client-side recomputation of financial figures. No chart libraries, no new dependencies unless asked. No tests. No backend changes (describe any need in the report).
- Never log amounts, names, notes or tokens. If anything conflicts with `frontend/AGENT.md`, stop and ask once.

## Acceptance criteria

1. `pnpm check` and `pnpm build` pass with nothing suppressed.
2. With the backend running and test data created through the backend `/docs` page (weekly budgets 7800 and 20000 pesewas, one 1300 expense today, a few needs): Home shows target `₵39.71`, `₵26.71 left`, a "Within target" chip, `₵13.00 of ₵278.00` and `₵265.00 left`, today's bar highlighted in the breakdown, both budgets with progress bars, the needs list with progress, and the recent transaction.
3. A brand-new account (no data) shows every empty state with no errors or blank areas.
4. The range selector switches between All time, This week and This month and updates the hero card.
5. Light and dark mode both render correctly; the screen is usable at 390px wide and centered at desktop width.
6. Turning the network off keeps the last data on screen with the offline banner.
7. The dev-only token button is absent from the production build.

## Final report format

What you built, commands, results of each acceptance check, decisions not covered here, and anything left undecided for F2.
