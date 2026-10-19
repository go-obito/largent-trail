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
