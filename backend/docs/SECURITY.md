# Security notes

- Random 256-bit session tokens are stored as SHA-256 hashes. Production cookies use the __Host prefix, HttpOnly, Secure and SameSite=Lax; no Domain attribute is set.
- Password hashes use salted scrypt (N=32768, r=8, p=3), with bounded concurrent password work. Current passwords are required for password changes.
- Shared MongoDB rate counters cover API, auth IP/account, password, writes and exports. TTL cleanup is not trusted for enforcing session expiry.
- Strict origin checks and session-bound HMAC CSRF tokens protect mutations. JSON bodies are limited to 16 KB. Input schemas reject unknown ownership and money fields, NoSQL query operators, malformed dates and invalid categories.
- Every entry read/write/export/history query is scoped to the authenticated owner. Session version changes revoke older logins across application instances.
- Versioned atomic entry writes preserve both money fields and history. Integer minor units and Decimal128 aggregation prevent floating-point accumulation errors.
- Signed cursor tokens are bound to the account and exact query filters. CSV fields neutralize spreadsheet formula prefixes.
- Helmet and Vercel headers set CSP, framing prevention, MIME protections, referrer policy and production HSTS. APIs use no-store. Application logs omit request bodies, cookies and connection strings.

## Two-project gateway

Set the same random PROXY_SECRET (at least 48 characters) in both Vercel projects. The frontend gateway signs a JSON tuple of HTTP method, original request path/query, client IP, timestamp and nonce. The backend verifies the HMAC and a 90-second clock window before accepting proxied API traffic. Missing/invalid signatures are rejected when configured. Requests cannot override the configured upstream URL or provide a trusted client-IP header themselves.

The frontend uses Vercel's overwritten x-forwarded-for client identity, not a client-provided identity passed through unchanged. Do not host this gateway behind arbitrary untrusted proxies or change trusted-proxy behavior without reviewing identity handling. Local development does not enable production proxy validation.

The gateway forwards only required authentication/request headers and selected response headers, including Set-Cookie. It never follows upstream redirects, caps request/response sizes, has a bounded timeout and hides upstream exception details. Production BACKEND_URL must be an exact HTTPS origin. Credentials and records are not cached.

The gateway adds a function hop and consumes function usage in both projects. Keep both near Atlas and monitor connection counts, traffic, limits and latency. Vercel deployment protection may require separate configuration for account-specific setups; use the normal Production backend URL in the supplied setup.

## Operational scope

This is a cash tracker, not a bank/payment processor. Email verification, email password recovery, organization roles, payment gateways and external security certification are not included. Use HTTPS, strong secrets, scoped Atlas database credentials, appropriate network restrictions, backups and restore checks. Keep dependencies updated. Testing is not a guarantee that every security issue has been eliminated.

Relevant primary references:

- https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/functions/limitations
