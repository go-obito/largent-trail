# Largent product summary

Largent is a mobile-first personal-finance PWA for everyday money management in
Ghana. It is a from-scratch rebuild of a single-user prototype and supports one
currency at launch: Ghanaian cedi (`GHS`).

The backend MVP will cover external authentication, users, accounts, categories,
transactions, weekly and monthly category budgets, a prioritised wishlist, reports,
CSV statement import, offline synchronization, data export, and account deletion.
Users record income and spending, plan purchases, and see a daily spending target
that adapts to spending already made that week.

Amounts are represented as positive integer pesewas, with direction expressed
separately. Balances and budget progress are derived rather than mutable stored
values. Weeks begin Monday and period calculations use each user's IANA timezone,
defaulting to `Africa/Accra`.

Every future user-owned row is isolated by user ID, explicit service filtering, and
Postgres row-level security. The application role is deliberately non-superuser and
cannot bypass RLS. APIs are versioned under `/v1`, use snake_case JSON and RFC 9457
problem responses; mobile clients will synchronize local-first changes through
idempotent push/pull endpoints.

Deferred work includes bank/mobile-money API sync, multi-currency/FX, shared
workspaces, unspecified habit tracking, and all frontend work.
