# ADR 0006: Budgets and the daily target

- Status: Accepted
- Date: 2026-10-19

## Context

B5 adds per-category budgets and the daily spending target of AGENT.md §6. All
amounts are integer pesewas (§5), so every division needs an explicit rounding rule.

## Decision

**Formula** (pure, in `domain/daily_target.py`):

```
weekly_budget_total = sum(weekly limits) + sum(monthly limit * 7 // days_in_month)
daily_target        = max(0, (weekly_budget_total - spent_before_today) // days_left)
left_today          = daily_target - spent_today
```

`days_left` is the days remaining in the Monday-first week including today (1..7).
With no budgets, target, left and status are all null, never zero.

**Rounding.** All division is integer floor division, so the target is rounded down
to the pesewa and the app never suggests spending more than is left. `left_today`
may be negative.

**Proration.** Each monthly limit is floored to a week on its own
(`limit * 7 // days_in_month`, with the month length of today's local date), then
summed. Prorating the sum instead would give different pesewas, so the per-budget rule
is fixed.

**Status thresholds.** Integer comparisons only, no floats. Budget status compares
period-to-date spending with the limit: `within` below 80%, `near_limit` from 80% up
to and including 100%, `over_limit` above. Daily status uses the same 80% rule against
today's target, and nothing spent today is never `near_limit`.
Progress and status are computed per request and never stored. Week and month
boundaries come from the user's timezone.

**Immutable category and period.** A budget's `category_id`, `period` and `currency`
cannot be changed (PATCH accepts only `limit_minor` and `is_archived`; unknown fields
return 422). A different category or period means a new budget. This keeps "one
active budget per (user, category, period)" simple, and the category foreign key
`(user_id, category_id, kind)` pins budgets to expense categories in the database.

**Deletion rule.** Deleting a category soft-deletes all of its budgets in the same
transaction (the categories service calls the budgets service). Budgets of deleted
categories never appear in lists or reads. Archiving a category keeps its budgets.
There is no category reassignment flow (see ADR 0005), so nothing moves budgets: a
transaction moved to another category does not carry a budget with it.

## Consequences

- Deleted-category budgets cannot be restored through the API; re-create the category
  and its budgets.
- Budgets are recomputed on each read, with one grouped query per list.
- Neither amounts nor names are logged; only ids and status codes.
