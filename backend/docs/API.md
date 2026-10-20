# API contract

Base path: `/api`. The browser uses same-origin cookies. All mutation requests require `Origin` equal to `APP_ORIGIN` and `Content-Type: application/json`. Authenticated mutations also require `X-CSRF-Token` from login, registration, password change or `/auth/me`. Tokens are kept in memory, not localStorage.

## Endpoints

| Method | Endpoint                                   | Purpose                                                                                     |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| POST   | `/auth/register`                           | Name, email, password, currency, timezone; returns user and CSRF token, sets session cookie |
| POST   | `/auth/login`                              | Email/password; returns user and CSRF token, sets session cookie                            |
| GET    | `/auth/me`                                 | Current public profile and CSRF token                                                       |
| POST   | `/auth/logout`                             | End current session; JSON `{}` body                                                         |
| POST   | `/auth/logout-all`                         | End all sessions for this user; JSON `{}` body                                              |
| PATCH  | `/auth/profile`                            | Name and supported timezone                                                                 |
| POST   | `/auth/password`                           | `currentPassword`, `newPassword`; rotates session and revokes other sessions                |
| GET    | `/categories`                              | Supported incoming/outgoing categories                                                      |
| GET    | `/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` | Totals, previous period, daily series, spending categories                                  |
| GET    | `/entries`                                 | Cursor-paginated records                                                                    |
| POST   | `/entries`                                 | Create entry with `Idempotency-Key: UUID`                                                   |
| PATCH  | `/entries/:id`                             | Full editable fields and current `version`                                                  |
| POST   | `/entries/:id/void`                        | `version` and 3–200 character `reason`                                                      |
| GET    | `/entries/:id/history`                     | Current entry and up to 50 recent audit events                                              |
| GET    | `/export`                                  | CSV for the same filters as `/entries`, without a cursor                                    |

Health routes are outside `/api`: `GET /health/live`, `GET /health/ready`.

In the separate Vercel deployment, use the frontend origin for these endpoints. Its server-only gateway signs requests to the backend. Direct unsigned requests to the backend `/api` return `403 PROXY_REJECTED`. Local Vite development uses its regular proxy without a secret.

## Cash entry request

```json
{
  "type": "in",
  "amount": "1250.50",
  "category": "Sales",
  "title": "Payment for order 12",
  "note": "Received in cash",
  "occurredOn": "2026-10-18"
}
```

The date must be valid and not later than the account's current business date. The amount is a decimal string; stored and returned money uses integer minor units. Edits include `"version": 1` (the current returned version). The API never accepts `userId`, balance or currency as entry fields.

Supported categories:

| Cash in      | Cash out      |
| ------------ | ------------- |
| Sales        | Supplies      |
| Salary       | Rent          |
| Freelance    | Utilities     |
| Investment   | Transport     |
| Refund       | Food          |
| Gift         | Shopping      |
| Other income | Health        |
|              | Other expense |

## Listing and filtering

Query parameters: `type=in|out`, `status=posted|void` (default posted), `category`, `from`, `to`, exact `reference`, `limit=1..100` (default 20), `cursor`.

`category` requires a matching `type`. Dates are inclusive. A response is:

```json
{ "items": [], "nextCursor": null, "hasMore": false }
```

Use the returned cursor verbatim with exactly the same filters and limit. Clear it when filters change. There is no expensive total-page count; the UI maintains previous-page cursor history.

## Errors and retries

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": { "title": "Add a short description." },
    "requestId": "request-uuid"
  }
}
```

- 400: invalid input, date, category or signed cursor.
- 401: missing/expired credentials or invalid login.
- 403: untrusted Origin, missing/invalid CSRF token or invalid deployment proxy signature.
- 404: unavailable entry, including another user's record.
- 409: stale entry version, void edit, duplicate registration, idempotency conflict or edit revision limit.
- 413: oversized JSON body. 415: non-JSON mutation.
- 422: export over 10,000 entries or 4,000,000 bytes, or an aggregate exceeds the safe reporting limit; narrow the filters where possible.
- 429: rate limit; honor `Retry-After`.
- 503: password hashing temporarily saturated.

A successful new create returns 201. Replaying the same key and normalized request returns 200 with `replayed: true`, without another entry. Never automatically retry a financial create with a **new** key after an uncertain network failure. Keep the same key until the result is known or the user intentionally changes the form.
