# Architecture and data integrity

The frontend and backend are independent npm packages. Routes wire middleware to controllers; controllers validate HTTP input and call services; services own persistence and queries. Each model has its own file and explicit indexes.

## Standalone MongoDB support

Version 2 uses **single-document atomic writes** for cash entries on both standalone MongoDB and Atlas. Each entry embeds its own create/edit/void audit events. Editing or voiding uses an expected-version comparison in the database filter, and updates the financial fields and audit array in the same write. Concurrent changes cannot both commit against one version.

Balance, daily graphs and category totals are calculated from posted entries through one indexed aggregation with bounded output. There are no separately updated balance/rollup documents, so a process failure cannot leave an entry committed with stale counters. Dashboard reads are live aggregations; standalone MongoDB does not promise a cross-document point-in-time snapshot during concurrent writes. A subsequent refresh reflects committed changes.

Amounts are integer minor units. Aggregation uses MongoDB Decimal128 sums and validates the result before converting to JSON numbers. Each entry accepts 0.01–999,999,999.99 major units. Each reported aggregate is bounded to 900,000,000,000,000 minor units; larger reports fail explicitly instead of silently rounding. A report limit does not delete or truncate entries.

A unique `(userId, idempotencyKey)` index handles duplicate creation; payload hashing rejects reuse for different data. Entry ownership is always server-derived. A versioned comparison prevents lost edits. Posted and void entries remain separate filter states.

Audit history is excluded from normal entry queries. The history endpoint reads the newest 50 events. Up to version 1000 is supported for editing; after that an entry can still be voided and replaced. Events are never silently discarded. This bounds document growth below MongoDB's document limit for the application's validated field sizes.

## Authentication without cross-document transactions

Passwords use salted scrypt. Sessions store hashed random tokens and a copy of the user's `authVersion`. Registration stages an unissued session before inserting the user. A failed user insert cleans that session; its unknown token is never returned.

Password change stages an unissued replacement session, then atomically compares and changes the user's password hash and authVersion. If session creation fails, the password stays unchanged. Concurrent password changes cannot both win the same comparison. Old sessions are invalid immediately through version checks; cleanup/TTL is secondary. A process crash can leave an unissued session until TTL, without exposing its token. Network failures can make a committed request's response uncertain; login can recover an existing registered account.

Logout-everywhere increments authVersion atomically. Already-running authorized requests are not retroactively cancelled.

## Indexes and scalability

Indexes are added automatically before the API serves database traffic. No collection-by-collection manual setup or destructive index synchronization is needed.

- Unique user email and unique hashed session token.
- User/session lookup and session/rate-bucket TTL.
- User/status/date, user/status/type/date and user/status/type/category/date ledger indexes.
- Unique user/reference and user/idempotency key.
- A covering user/status/date/type/category/amount index for dashboard aggregation.
- The legacy audit reader retains its user/entry/date index.

List endpoints use signed cursor pagination, never deep skip pagination. Pages are capped at 100 rows; UI choices are 10/20/50. Dashboard date ranges are capped at 366 days, queries have time limits, CSV is capped at 10,000 rows and 4,000,000 bytes. Export rejects excessive results instead of returning an incomplete file.

Dashboard lifetime aggregation is proportional to that account's entries. Very large individual ledgers need measured capacity planning and potentially a verified reporting cache/materialization strategy. No million-row latency or unlimited traffic guarantee is made. Sessions and rate limits are shared in MongoDB, so backend instances do not need sticky sessions. Warm Vercel instances reuse a bounded 10-connection pool; the regular Node server uses 25 connections.

## Compatibility with v1 data

Existing User, Session and Entry collection shapes remain readable. Old stored User totals and DailySummary records are ignored; v2 derives balances from the ledger. Legacy AuditEvent documents remain readable alongside new embedded events. Existing records are not deleted and no manual migration is required for normal reads/writes.

Do not run the older v1 application as another writer against the same database or downgrade without a reviewed migration: v1's separate counters are no longer updated. Back up a real database before changing deployed versions.

## PWA and deployment

PWA caching contains only public application assets. API responses, credentials and financial records are never cached; offline financial submissions are disabled.

The frontend's Vercel gateway keeps the browser on one cookie origin while the backend is a separate deployment. A server-only HMAC secret authenticates proxy request identity. No MongoDB URI or secret is included in the React bundle. For local development, Vite directly proxies `/api` to the local backend and no proxy secret is needed.
