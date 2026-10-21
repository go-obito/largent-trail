# Decisions

Short implementation decisions that do not need an ADR.

## B6a needs

- Savings pool is the total balance of non-archived, non-deleted accounts, behind `savings_pool(session)`.
- Unallocated savings is the pool minus the sum of `allocated_minor` over active needs. It may go negative and is reported as `over_allocated`, never auto-corrected.
- Allocating moves money inside the pool; the pool and account balances never change.
- `percent` is `min(100, allocated * 100 // target)`. A need is complete when `allocated_minor >= target_minor` and stays listed at 100% until deleted.
- Lowering a target below the allocated amount is allowed: the need is complete, remaining is 0, the excess stays allocated until released.
- Exception to cursor pagination (AGENT.md §9): `GET /v1/needs` is unpaginated because a user has at most 200 active needs (422 `limit_reached`).
- Placement: rank high 0, medium 1, low 2. A created need, or one whose priority changes, goes after the last other active need of equal or higher priority, then positions are rewritten `1..n`. Active needs are locked with a per-user advisory lock and `FOR UPDATE`. `PUT /v1/needs/order` may cross priority groups.
- `PUT /v1/needs/order` takes `{"ids": [...]}`; a mismatch returns 422 `invalid_order`.
- `GET /v1/needs` returns `{"items": [...]}`.
- Deleting a need soft deletes it and renumbers the remaining positions.
- `allocated_minor` is 0 until the allocation ledger exists (checkpoint 2); `_allocated_by_need` is the single grouped-query seam.

## B7 dashboard

- Dashboard aggregates are read-only and use bounded grouped SQL queries; its seven-day breakdown is zero-filled in the user's local week.
- `balance_range=all_time` reports the current balance only; week and month ranges add their income-minus-expense net change without changing that balance.
- Reports use the user's local date for anchor validation and inclusive week/month boundaries; category history retains archived categories and groups uncategorized expenses under a null category ID.
- The requested 20,000-row EXPLAIN check could not run here because Docker access is denied before a dev PostgreSQL container can be reached; no index was added without a plan.

## B11 production migrations

- Production deployments apply database migrations as a separate, explicit deployment step. The development Compose stack runs a one-shot migration service before the API and worker, but production does not auto-migrate during API startup.

## B9 CSV import schema

- Import batches store only the owning user, account, idempotency key, outcome counts, and undo timestamps; uploaded names and contents are not persisted in PostgreSQL.
- Batch and transaction ownership is enforced with composite foreign keys, and `import_batches` uses forced tenant RLS.
- Transaction import hashes are indexed only for live rows with a non-null hash; batch IDs are generated server-side as UUIDv7.

## B9 CSV preview and parsing

- Mapping values are zero-based column indexes, never header names; duplicate and blank headers are display-only. Mapping indexes must be distinct and within the first row's column count. Short rows return `missing_column`.
- Preview guesses a header only when the first row contains non-empty text cells that are neither supported dates nor amounts. Parse defaults `has_header` to true; choosing false treats row one as data and uses synthetic preview labels.
- Preview and parse run synchronously; Redis stores normalized CSV text under the user-scoped preview key for 30 minutes. Preview limits are enforced over a rolling 60-minute window.
- Parse row indexes are one-based data-row indexes after the selected header. Its response uses `items` for per-row results and `rows`, `valid`, `errors`, and `duplicates` for totals.
- Amount conversion uses `Decimal` and rounds to pesewas with half-up quantization. Import hashes include a one-based occurrence count so identical rows in one file remain distinct.
- The same `has_header` choice must carry through the future commit request so preview, parse, and commit operate on identical data rows.
