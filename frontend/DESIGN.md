# Largent Mobile Design System

## 1. Design direction

Largent is a mobile-first personal finance interface. The visual
language combines a cool, near-white canvas, deep navy typography and
balance surfaces, a strong blue action colour, restrained semantic
colours, rounded surfaces, and a persistent bottom navigation bar.

The goal is financial clarity, not decoration. Use cards selectively: a
surface should group information that benefits from separation, not
simply wrap every section. Prefer spacing, typography, dividers, and
compact progress indicators for secondary content.

## 2. Core CSS tokens

``` css
:root {
  /* Brand */
  --color-brand: #315BEA;
  --color-brand-hover: #244BD0;
  --color-brand-soft: #E8EEFF;
  --color-brand-tint: #F2F5FF;

  /* Primary surfaces */
  --color-page: #F4F6FB;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F8F9FC;
  --color-surface-muted: #EDF1F7;
  --color-surface-inverse: #111827;
  --color-balance-start: #18213F;
  --color-balance-end: #101522;

  /* Text */
  --color-text-primary: #20283A;
  --color-text-secondary: #697386;
  --color-text-muted: #8A93A3;
  --color-text-inverse: #FFFFFF;
  --color-text-on-brand: #FFFFFF;

  /* Borders and separators */
  --color-border: #020202;
  --color-border-strong: #65fd00;
  --color-divider: #000000;

  /* Semantic finance colours */
  --color-income: #079455;
  --color-income-soft: #E7F7EF;
  --color-expense: #E53935;
  --color-expense-soft: #FDECEC;
  --color-warning: #D97706;
  --color-warning-soft: #FFF4DB;
  --color-info: #315BEA;
  --color-info-soft: #E8EEFF;

  /* Progress */
  --color-progress-track: #DCE3EF;
  --color-progress-fill: #315BEA;
  --color-progress-good: #16B878;
  --color-progress-over: #E53935;

  /* Typography */
  --font-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-size-xs: 0.75rem;      /* 12px */
  --font-size-sm: 0.875rem;     /* 14px */
  --font-size-md: 1rem;         /* 16px */
  --font-size-lg: 1.125rem;     /* 18px */
  --font-size-xl: 1.25rem;      /* 20px */
  --font-size-2xl: 1.5rem;      /* 24px */
  --font-size-3xl: 1.875rem;    /* 30px */
  --font-size-display: 2.5rem;  /* 40px */

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.15;
  --line-height-normal: 1.45;
  --line-height-relaxed: 1.6;

  /* Spacing: 4px base scale */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */

  /* Shape */
  --radius-sm: 0.5rem;     /* 8px */
  --radius-md: 0.75rem;    /* 12px */
  --radius-lg: 1rem;       /* 16px */
  --radius-xl: 1.5rem;     /* 24px */
  --radius-pill: 999px;

  /* Elevation */
  --shadow-subtle: 0 2px 8px rgb(17 24 39 / 4%);
  --shadow-card: 0 4px 14px rgb(17 24 39 / 5%);
  --shadow-nav: 0 -1px 0 rgb(17 24 39 / 7%);

  /* Layout */
  --page-gutter: 1rem;          /* 16px on compact phones */
  --content-max-width: 30rem;   /* 480px; useful for larger phones */
  --header-height: 4rem;        /* 64px, excluding safe area */
  --bottom-nav-height: 4.75rem; /* 76px, excluding safe area */
  --tap-target-min: 2.75rem;    /* 44px */
}
```

## 3. Layout and spacing

-   **Mobile-first:** design for a 320--430 CSS-pixel viewport, then
    adapt fluidly to larger phones.
-   **Page gutter:** use 16px on compact phones and 20px on wider
    phones. Avoid edge-to-edge text.
-   **Vertical rhythm:** use 20--24px between major sections, 12--16px
    within a section, and 8--12px between related rows.
-   **Header:** keep the brand mark and wordmark left-aligned, with a
    single compact utility action on the right. Avoid a tall header.
-   **Safe areas:** respect `env(safe-area-inset-top)` and
    `env(safe-area-inset-bottom)`.
-   **Content flow:** one main column. Use horizontal rows for paired
    metrics, compact quick actions, category rows, and filters.
-   **Scrolling:** only the content region scrolls. The bottom
    navigation remains fixed and content must have enough bottom padding
    to avoid being obscured.
-   **Density target:** on the dashboard, users should be able to see
    the balance, quick actions, daily spending summary, and at least the
    beginning of recent activity on a typical phone. Do not spend the
    first viewport on oversized headings and stacked cards.
    **Avoid horizontal scrools and zoom in when typing in an input**


### Surface hierarchy

1.  **Page canvas:** `--color-page`.
2.  **Default content:** transparent background; group using spacing and
    dividers.
3.  **Raised surface:** `--color-surface`, used only when a group needs
    clear separation.
4.  **Primary financial surface:** dark navy for total balance, if the
    balance needs a strong focal point.
5.  **Feature emphasis:** brand blue for daily-spending status or one
    key action, not for multiple large blocks on the same screen.

## 5. Typography

Use Inter or a close system sans-serif. Typography should create
hierarchy without requiring every section to have a coloured background.

  -----------------------------------------------------------------------
  Use                     Token                   Guidance
  ----------------------- ----------------------- -----------------------
  Page title              `--font-size-2xl` to    Bold; keep to one or
                          `--font-size-3xl`       two lines

  Main balance            `--font-size-display`   Bold; tabular numerals
                                                  preferred

  Section heading         `--font-size-lg`        Semibold

  Primary row title       `--font-size-md`        Medium or semibold

  Body and controls       `--font-size-sm` to     Regular
                          `--font-size-md`        

  Metadata and timestamps `--font-size-xs`        Secondary colour

  Financial status        `--font-size-sm`        Semibold; pair colour
                                                  with text, not colour
                                                  alone
  -----------------------------------------------------------------------

Use `font-variant-numeric: tabular-nums` for amounts and aligned
financial columns. Use sentence case for headings and labels. Avoid
large introductory copy that pushes actionable financial information
below the fold.

## 6. Navigation

### Bottom navigation

The mobile mock-ups use five destinations: Home, Transactions, Budgets,
Needs, and Reports. The supplied live screenshot instead shows Home,
Transactions, Budgets, Reports, and Profile. Treat the exact destination
set as a product decision; the visual token pattern is consistent.

-   Fixed to the viewport bottom, with a white surface and a subtle top
    divider.
-   Height: approximately 72--80px plus bottom safe-area inset.
-   Five equal-width destinations maximum.
-   Icon size: 22--24px; label: 11--12px.
-   Active item: brand blue; inactive items: muted grey.
-   Always reserve content padding equal to the navigation height plus
    safe area.
-   Keep labels short and do not rely on icons alone.

### Header

-   Approximately 56--64px tall, plus safe-area inset.
-   Wordmark around 20--22px, bold.
-   Utility icons around 22--24px.
-   Keep the header visually quiet; avoid placing a second oversized
    title directly beneath it unless it adds useful context.

## 7. Component patterns

### Balance summary

-   Show total balance and account scope.
-   Use the dark navy surface with white primary text and muted white
    secondary text.
-   Use 36--40px numerals on larger phones; reduce toward 32px on
    compact screens.
-   Keep period/account selection compact.
-   Optional income/expense comparison should be a small secondary line,
    not another large tile.

### Quick actions

-   Prefer 3--4 compact actions in one row, with 44px minimum touch
    targets.
-   Icon size: 22--24px; label: 12--14px, medium weight.
-   Avoid four 170px-tall tiles. A compact row should communicate
    actions without competing with financial summaries.

### Daily spending

-   Show the amount remaining, spent-versus-target values, a progress
    track, and a clear record-spending action.
-   Suggested order: label and status → remaining amount → progress →
    spent/target values → compact action.
-   Keep the feature prominent but compact; aim for roughly 180--230px
    tall depending on viewport and content.
-   Use brand blue as a feature surface only if contrast remains
    accessible. Otherwise use a light blue surface with blue emphasis.
-   When the user is over target, switch to the semantic expense colour
    and update the status text.

### Transaction list

-   Use a continuous list, not a stack of cards.
-   Row layout: icon/category marker, title and metadata, amount aligned
    to the trailing edge.
-   Suggested row height: 60--72px.
-   Positive amounts use `--color-income`; expenses use
    `--color-expense`.
-   Amounts should remain readable at a glance and not wrap.
-   Use thin dividers and consistent horizontal alignment.

### Budget category row

-   Show category name, spent/limit or remaining amount, and a small
    progress bar.
-   Suggested row height: 64--76px.
-   Use semantic colours consistently, but avoid giving each category a
    saturated background.
-   A category list can be grouped in one surface or rendered on the
    page with dividers.

### Reports

-   Lead with one clear insight, such as total spending for the selected
    period.
-   Charts should have clear labels and avoid unnecessary legends or
    decoration.
-   Keep category breakdowns compact and scannable.
-   Ensure charts reflow to the phone width and never require horizontal
    scrolling.

### Needs

-   Show today's planned/allowed amount, spent, and remaining.
-   Use a concise list of need categories and a weekly plan that
    prioritizes amount and progress.
-   Keep the Needs destination distinct from Budgets: Needs focuses on
    essential day-to-day allocations and the daily plan; Budgets focuses
    on limits and category performance.

### Filters and status chips

-   Compact controls, typically 32--40px high.
-   Use a subtle border or tinted surface; avoid large pills that
    dominate the screen.
-   Status chips should communicate a state such as "Within target" and
    remain secondary to the amount.

## 8. Responsive guidance

``` css
.app-shell {
  min-height: 100dvh;
  background: var(--color-page);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.app-content {
  width: 100%;
  max-width: var(--content-max-width);
  margin-inline: auto;
  padding: var(--space-4) var(--page-gutter);
  padding-bottom: calc(
    var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--space-6)
  );
}

.bottom-nav {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 20;
  min-height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: var(--shadow-nav);
}

.financial-amount {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.transaction-row {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 4rem;
  border-bottom: 1px solid var(--color-divider);
}
```

## 9. Accessibility and interaction

-   Maintain WCAG AA contrast for text and interactive controls.
-   Never use red/green alone to distinguish income and expenses;
    include signs, labels, or icons.
-   Provide at least 44×44px interactive targets.
-   Give icon-only buttons accessible names.
-   Show visible focus states for keyboard and assistive technology
    users.
-   Progress bars must expose current value, maximum value, and a
    textual equivalent.
-   Respect reduced-motion preferences.
-   Avoid placing critical labels only inside charts or colour-coded
    areas.

## 10. Design constraints

1.  **Reduce card count.** Cards are for meaningful grouping, not
    decoration.
2.  **Prioritize above-the-fold utility.** Balance, daily allowance, and
    recent activity should be reachable with minimal scrolling.
3.  **Avoid oversized hero copy.** The dashboard is a working tool, not
    a marketing landing page.
4.  **Keep financial values aligned.** Use tabular numerals and
    consistent currency formatting.
5.  **Use colour semantically.** Blue for primary actions and emphasis;
    green for positive/income/within target; red for expenses or
    over-target states; muted neutrals for structure.
6.  **Keep patterns consistent across screens.** Shared spacing,
    typography, row layouts, dividers, and controls should feel like one
    system.
7.  **Do not copy mock-up sample amounts as product data.** Values shown
    in the screenshots are illustrative only.

## 11. Validation checklist

-   [ ] Check at 320px, 375px, 390px, and 430px viewport widths.
-   [ ] Verify the bottom navigation never covers content.
-   [ ] Confirm the dashboard exposes useful activity above the fold.
-   [ ] Check long merchant names, large balances, and long category
    labels.
-   [ ] Check empty, loading, error, and over-budget states.
-   [ ] Verify contrast and touch targets.
-   [ ] Confirm the actual app's currency formatting is locale-aware;
    the screenshots show Ghana cedi values.
-   [ ] Compare implemented values with this estimated token set and
    adjust from real-device screenshots.
