# DESIGN.md — Largent visual specification

Authoritative visual reference for `frontend/`. Read it together with `AGENT.md`. The reference images are `frontend/docs/design/largent-mockup.png` (desktop and mobile Home) and `frontend/docs/design/largent-screens.png` (desktop and mobile Transactions, Budgets, Reports and Profile). Where this file and an older prompt disagree on visuals, **this file wins**. Colors and radii come only from `src/styles/palette.ts`; behavior and data rules stay in `AGENT.md`.

## 1. Principles

- Clean, airy, financial. Soft cloud surfaces, one confident cobalt accent, generous spacing, big readable figures.
- **Real, specific icons everywhere** (section 6). No generic placeholders, no emoji, no letter-in-a-circle except user avatars.
- Same layout language on every screen; desktop is a true wide layout, not a stretched phone column.
- Never show a number the backend did not give us (section 7).

## 2. Breakpoints and shell

| Width | Navigation | Content |
|---|---|---|
| under 768px (mobile) | Top bar (logo, notification bell) and a bottom tab bar | One column, 16px side padding |
| 768 to 1023px (tablet) | Collapsed icon rail on the left | Up to 2 columns |
| 1024px and up (desktop) | Left sidebar, 240px wide, with labels | `PageContainer` with a max width of 1280px, 12-column grid, 24px gaps |

- **Sidebar:** Largent logo (mark and wordmark) at the top, then Home, Transactions, Budgets, Needs, Reports, Profile. The active item has a `selected-surface` background, `primary` text and icon, rounded 12px. No "Upgrade" card (there are no paid plans).
- **Top bar (desktop):** a search field slot on the left (hidden until the backend supports search, see section 7), then the notification bell and the user menu (avatar initial, first name, chevron) on the right. Page title sits below it where a screen needs one.
- **Notification bell:** opens a popover listing budget alerts (budgets that are near limit or over limit, from the existing alert helpers), each linking to `/budgets`. A small `error` dot shows when any alert exists. Empty state: "You're all caught up".
- **User menu:** Profile, Theme (Light, Dark, System), Sign out.
- **Mobile bottom bar:** Home, Transactions, Budgets, Reports, Profile. Active item shows the icon and label in `primary` (no circle). Inactive items use `text-secondary`. Safe-area padding at the bottom.
- The old 640px centered column is removed on desktop. Screens use `PageContainer` and responsive grids.

## 3. Cards and surfaces

- Card: `surface` background, 20px radius (`--radius-card`), 1px `border` in dark mode, soft shadow in light mode (`--shadow-card`: a faint 1px shadow plus a large 24px blur at about 5% of `text-primary`).
- Section header inside a card: bold title on the left, a text link or compact select on the right ("See all", "This month").
- Compact select / range pill: `surface-elevated` background, 12px radius, small chevron (MUI `Select` styled to match).
- Progress bars: 8px high, fully rounded, track `surface-elevated`, fill by status (`primary`, `warning`, `error`).
- Amounts use tabular numerals. Income is `success` with `+`, expenses are `error` with `−` (never color alone).

## 4. Home layout

**Desktop (12-column grid):**
1. Row 1: **Hero balance card** (8 columns) and **Daily spending card** (4 columns).
2. Row 2: four **stat cards**, 3 columns each: Income, Expenses, Savings, Needs.
3. Row 3: **Recent transactions** (7 columns) and **Spending overview** donut with legend (5 columns).
4. Row 4: **Budgets** card (4), **Weekly breakdown** bars (4), **Priority needs** list (4).

**Mobile (single column, in order):** hero balance card, quick-action tiles, daily spending card, recent transactions, spending overview, budgets, weekly breakdown, priority needs.

Components:
- **Hero balance card:** gradient from `hero-from` to `hero-to`, text `on-hero`, radius 20px. "Total Balance" label, large amount, a translucent range pill (All time, This week, This month) at the top right. When the backend supplies comparison and history data, also show a delta chip ("+12.5% from last week") and a soft area sparkline on the right; until then these slots stay empty and the layout does not leave a gap.
- **Stat card:** round tinted icon badge at the top, a label, the amount, and a footer line. Income: icon `TrendingUp`-style in `success` tint, value `week.income_minor`. Expenses: `error` tint, `week.spent_minor`. Savings: `primary` tint, value `needs.unallocated_savings_minor`. Needs: `secondary` tint, "₵X planned" from `needs.total_target_minor` with a progress bar from allocated over target (and "N% saved"). Deltas ("↑ 8%") appear only when comparison data exists.
- **Quick actions (mobile only):** a row of four tiles with icon and label: Add expense, Add income, Needs, Import CSV (only once the import screen exists; otherwise a "More" tile).
- **Recent transactions row:** 44px rounded-12 icon badge, bold title (the note, or the category name when there is no note), a muted subtitle (the category name, or the account name when the title is already the category), the signed amount on the right and a relative date under it (Today, Yesterday, "Oct 18").
- **Spending overview:** a donut (plain SVG, no library) of expense totals by category for the selected range (This month or This week), the total spent in the center with "Total spent", and a legend on the right (color dot, category name, share %). Show the top 5 categories and group the rest into "Other". The range select defaults to This month. Data: the existing reports endpoint.
- **Budgets card:** up to 3 budgets with name, "₵ spent / ₵ limit", progress bar and percent (as in the mockup's "Weekly Food Budget").
- **Daily spending card:** unchanged from F1 (this is the signature feature), restyled to match.

## 5. Screens

Every screen follows the shell and card rules above. Mobile and desktop show the same content; desktop uses wider grids and tables.

### 5.1 Page header pattern
- Title (24 to 28px bold) with a one-line subtitle in `text-secondary`. Subtitles: Transactions "View, add and manage all your transactions."; Budgets "Plan your spending and stay on track."; Reports "Understand your spending and build better habits."; Profile "Manage your account and preferences."; Needs "Plan what you need and save toward it."
- Desktop: the primary action sits at the right of the header row ("+ Add Transaction", "+ Add Budget", "+ Add need"), next to the bell and user menu. Mobile: title on the left and, where needed, a compact range select or icon button on the right.

### 5.2 Transactions
- **Desktop:** a search field slot (hidden until the backend supports `q`) beside the "+ Add Transaction" button; a chip row with All, Income, Expense (no Transfer chip, there are no transfers), a period dropdown (This week, This month, Last 30 days, All time, Custom range) and a Filters button for account and category (popover). Below, a table with columns Date, Description, Category, Amount and a row-actions column. Rows are grouped under "Today", "Yesterday" and then dates. Date cells read "Oct 21, 2026". Description shows the category badge and the title (the note, or the category name when there is no note). The row action is a kebab menu with Edit and Delete (delete asks for confirmation). Clicking a row also opens Edit.
- **Mobile:** title with a range or filter icon, a search field slot with a filter icon button (opens the filter sheet), the same chips, grouped rows (badge, title, category subtitle, signed amount, and the time of day from `created_at` in the user's timezone beneath it), a kebab menu per row, and a floating "+" button above the bottom bar.

### 5.3 Budgets
- Tabs: **Overview** and **Categories**. The Categories tab (category management) appears only once that screen exists (F7); until then show Overview alone, without tabs.
- **Overview:** a range select (This month, This week) driving a **spending donut** (spending by category from the reports endpoint) with the total in the center and a legend. When the backend supplies a total budgeted amount for the range, show "of ₵X" and "N% used" in the center; otherwise omit them. Below it, the **Category Budgets** card with a "+ Add Budget" button (and "See all" on mobile).
- **Budget row/card:** category badge, name, "₵spent / ₵limit", a period chip (Weekly or Monthly), a progress bar, the percentage and a kebab menu (Edit, Archive, Delete). The bar uses the category's chart color while on track and switches to `warning` when near limit and `error` when over, always with the status chip or icon, so alerts are never lost.
- Desktop shows the donut and the list side by side or stacked per width; mobile stacks them with a two-column legend.

### 5.4 Reports
- A period navigator plus a This week / This month select (compact on mobile).
- **Stat cards:** Total Income (success badge), Total Expenses (error badge), Net (primary badge), each with a delta line only when comparison data exists.
- **Spending Trend card:** a Daily | Weekly toggle over the shared bar chart, now with a y-axis (nice round tick labels) and sparse x labels. Weekly groups the daily series into Monday-start weeks (display aggregation) and is offered only for the month period. A Monthly option is omitted until multi-month data exists.
- **Spending by Category:** donut plus legend (top 5 and "Other").
- **Top Spending Days:** the top 5 days by expense from the daily series (rank, date, amount), with "See all" expanding the full sorted list. No extra request needed.
- Desktop: stat row, then the trend card full width, then category donut and top days side by side. Mobile: stacked in that order.

### 5.5 Needs (Goals in the mockup)
Not shown in the reference images; follow the same patterns: header with "+ Add need", a responsive grid of cards with a `Target` badge, priority chip, progress bar, saved and remaining amounts and the allocation actions (F5).

### 5.6 Profile
- A profile card: avatar (the Clerk profile photo from `user.imageUrl`, initials when there is none), name, email and an Edit button.
- Grouped list rows (label on the left, value and chevron on the right):
  - **Account:** Name (editable, saved with `PATCH /v1/me`), Email (read-only, managed by Clerk), Password and Security (opens Clerk's user profile dialog).
  - **Preferences:** Currency "GHS (Ghana Cedi)" (read-only), Theme (Light, Dark, System), Timezone (IANA zone select, default Africa/Accra, saved with `PATCH /v1/me`).
  - **Data and Security:** only items the backend supports. Export Data and Delete Account appear after backend B10. "Manage Connected Accounts", Notifications and Language rows from the mockup stay hidden until those features exist.
- A Sign out button at the bottom. The dev-only token button stays dev-only.
- Desktop: centered column up to 720px. Mobile: full width.

### 5.7 Forms
Add and edit forms (transaction, budget, need) are a centered card up to 560px on desktop, full width on mobile, with a sticky action bar on mobile only.

## 6. Icons (real, specific)

- UI and category icons come from `lucide-react` (already installed), always imported per icon. No emoji and no placeholder letters. Avatars may show initials.
- **Navigation:** Home `House`, Transactions `ArrowLeftRight`, Budgets `Wallet`, Needs `Target`, Reports `ChartColumn`, Profile `User`, notifications `Bell`.
- **Default categories** each get their own icon and a tinted badge (icon in the chart color, background a 14% tint of it): Food `UtensilsCrossed`, Transport `Bus`, Airtime and Data `Smartphone`, Utilities `Zap`, Rent `House`, Health `HeartPulse`, Education `GraduationCap`, Shopping `ShoppingBag`, Entertainment `Clapperboard`, Giving `HandHeart`, Family Support `Users`, Savings `PiggyBank`, Salary `Banknote`, Business `Briefcase`, Gift `Gift`, Other `Ellipsis`. Verify each name exists in the installed lucide version; if one does not, choose the closest specific icon and note it in `docs/DECISIONS.md`.
- Badge colors come from `chartColors` in `palette.ts`: a fixed mapping for the defaults, a stable hash of the category name for custom categories (custom categories without a chosen icon show a neutral `Shapes` icon).
- **Brand mark:** the Largent logo (a rounded blue mark with the wordmark) is an SVG component recreated from the mockup. The app icons, favicon and manifest icons are regenerated from the mark. Final artwork from the owner replaces it later.
- **Merchant logos** (the mockup shows Netflix, McDonald's and similar) are an optional, flag-controlled layer (`NEXT_PUBLIC_MERCHANT_LOGOS`, default off). They depend on matching the free-text note to a brand, and brand logos carry trademark considerations, so they ship disabled until the owner decides.

## 7. Data the mockup shows that the backend does not provide yet

The mockup includes: percentage changes on cards ("+12.5% from last week", "↑ 8%"), a balance sparkline, a transaction search field, and "Transfer" and "Scan" actions. **Do not fake any of these.** Build the slots so they appear automatically when the API supplies the data (previous-period totals, a balance series, a `q` search parameter), and hide them cleanly otherwise. Transfers, receipt scanning and the "Upgrade" card are out of scope.

## 8. Typography, motion and currency

- Font: Inter via `next/font` (self-hosted, no external request), weights 400, 500, 600, 700. Page titles 24 to 28px bold, card titles 16 to 18px semibold, hero amount 36 to 44px bold, captions 12px.
- Tabular numerals for all money (`font-variant-numeric: tabular-nums`).
- Subtle motion only (150 to 200ms transitions); respect `prefers-reduced-motion`.
- Currency prefix stays `₵` (as in the prototype and `formatGhs`), even though the mockup shows "GHS". Changing it later is a one-line edit in `formatGhs`.
- Both themes use the same layout. Dark mode uses `surface` cards with a `border`, no shadow.
