# ADR 0005: Transactions

- Status: Accepted
- Date: 2026-10-18

## Context

B4a adds the first money table. It must follow the §5 money rules, the §7 tenancy
rules and the §9 idempotent-create rule, and it must make invalid combinations of
account, category and kind impossible at the database level, not only in services.

## Decision

**Scope.** A transaction is `income` or `expense`. Transfers are out of the MVP:
they need two linked rows or a second account, which changes balance and report
semantics, and no reviewed requirement exists for them. Adding them later means a
new ADR and migration, not a change to the meaning of these two kinds.

**Shape.** `transactions` carries `TenantMixin`, `SyncedMixin` and
`UNIQUE (user_id, id)`. The account is required. The category is optional because
CSV imports arrive uncategorized. `amount_minor` is a positive `BIGINT` of at most
`10^12`, `currency` is `GHS` (checked), `note` is 1 to 280 characters or null, and
`occurred_on` is a `DATE` in the user's local time chosen by the client. There is no
`server_seq` yet (§10 sequencing rule: B8 adds it). Deletion is soft only.

**Kind-enforcing composite foreign keys.**

- `(user_id, account_id) -> accounts (user_id, id)` is the §7 pattern.
- `(user_id, category_id, kind) -> categories (user_id, id, kind)` additionally ties
  the transaction kind to the category kind. It needs `UNIQUE (user_id, id, kind)` on
  `categories`, added in migration 0005. The FK uses `MATCH SIMPLE`, so with
  `category_id` NULL the constraint is not checked and uncategorized rows are valid.
- Foreign keys cannot compare two different enum types, so `transactions.kind` reuses
  the `category_kind` Postgres enum.

**Immutable category kind.** Because transactions reference `(category, kind)`
together, changing a referenced category's kind would orphan them. The categories
API no longer has any way to change `kind` (PATCH with `kind` returns 422, and the
service refuses it too), and the FK blocks it in the database as well. A wrong kind
means creating a new category.

**Idempotent create.** Same client UUIDv7 `id` and identical payload returns 200 with
the original row; a different payload, a deleted row or an id owned by another tenant
returns the same 409 `id_conflict`. A replay is resolved before any reference or date
check, so it keeps working after the account is archived.

**Reference and date rules (422).** `invalid_reference` is returned identically for
a missing, foreign or soft-deleted account or category. `archived_reference` blocks
using an archived account or category for a new reference. `kind_mismatch` covers a
category of the other kind. `invalid_date` requires `2000-01-01 <= occurred_on <=
local today + 1 day`, where local today comes from the user's stored timezone via
`zoneinfo`. The extra day tolerates a client clock slightly ahead of the server. The
rules live in `domain/transaction_rules.py`; the clock is injectable (`core/clock.py`).

**PATCH.** Changes are merged and re-validated, but only what the change touches:
a changed `account_id` or `category_id` must be usable (existing, owned, not deleted,
not archived, kind-compatible), a changed `occurred_on` must be in range, and a
changed `kind` requires a compatible `category_id` in the same request (or null).
References that did not change are not re-checked, so archiving an account or
category never prevents editing the notes or amounts of existing transactions.
`id`, `user_id` and `currency` are not editable and unknown fields are rejected.

**List.** Filters `from`, `to` (inclusive), `account_id`, `category_id`, `kind`.
Order is `occurred_on DESC, created_at DESC, id DESC`, served by a partial index
(`WHERE deleted_at IS NULL`). The signed keyset cursor gains an optional date part:
dated and undated cursors are not interchangeable, so a cursor from another list is
rejected with 400.

## Balances and delete rules (B4b)

**Balance.** Every account response carries `balance_minor`: opening balance plus the
income total minus the expense total of the account's live (not soft-deleted)
transactions, computed per request in one grouped query and never stored (§5.5). It is a
signed integer, because expenses may exceed funds. Archived accounts keep their balance.
The arithmetic is `domain/money.account_balance`; the accounts router composes it with
`transactions.service.account_totals`, so no module touches another's repository.

**Deleting an account or category is always allowed.** Soft-deleting a parent never
blocks and never touches its transactions: they stay readable, listable and editable,
and still count toward the balance. A deleted account or category can no longer be
referenced by new transactions or by a PATCH that changes the reference
(`invalid_reference`). Because of this, no reassignment endpoint exists: a client that
wants the transactions elsewhere changes `account_id` or `category_id` with the normal
transaction PATCH. A bulk reassignment can be added later if a screen needs it.

## Consequences

- Cross-tenant references and kind mismatches fail in Postgres even if a service has
  a bug.
- Category kind can never be edited; a UI must offer "create a new category" instead.
- Soft-deleting a parent leaves its transactions intact.
- Balances are recomputed on each read; if this proves slow at scale, a derived
  cache needs a new ADR.
- Notes and amounts are never logged; only ids and status codes appear in logs.
