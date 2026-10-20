# Verification — Cashbook v2

Verified on 20 October 2026 in a Linux execution environment using **Node 22.22.3**, the same Node version reported by the user. Node 24.19.0 also passed the initial suite. These are measured source-package checks, not a claim of live Vercel deployment.

| Check                                                      | Result                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Backend suite with genuine standalone MongoDB 8.2.6        | 37 passed, 0 failed, 0 skipped                                                              |
| React component/authentication tests in JSDOM              | 14 passed                                                                                   |
| Frontend server gateway tests                              | 3 passed                                                                                    |
| Unique default tests                                       | **54 passed**                                                                               |
| API suite repeated on a temporary replica set              | 32 passed, 0 failed, 0 skipped                                                              |
| Vite production build under Node 22.22.3                   | Passed; app chunks and public-only service worker generated                                 |
| Both production dependency audits (`npm audit --omit=dev`) | 0 reported vulnerabilities at verification time                                             |
| Automatic local `.env` setup                               | Standalone URI and random secret generated; existing file preserved on a second run         |
| Both Vercel rewrite configurations                         | Compiled with the official routing utility; API, health, SPA and static-asset cases checked |

The default backend tests explicitly check that MongoDB has **no replica-set name**. They exercise real database writes and indexes; standalone compatibility does not rely on a mocked database or bypassed startup check.

Covered behavior includes registration/login, password replacement and session revocation, ownership isolation, CSRF and origin checks, validation, idempotency, signed cursor pagination, cash-in/out totals, edit/void history, concurrent edit conflicts, atomic-write failures, CSV escaping and response bounds, legacy history, and serverless initialization retry. An HTTP integration test runs the actual frontend gateway against the actual backend with a temporary database and checks registration cookies, authentication, cash creation, dashboard, listing, history and logout.

The gateway checks include query/cookie forwarding, trusted client identity, request-size limits, path restrictions and generic upstream errors. The Vercel checks verify route compilation and intended matching, not a hosted request path through Vercel's infrastructure.

## Reproduce

In `backend`:

```bash
npm ci
npm test
npm run test:replica
```

In `frontend`:

```bash
npm ci
npm test
npm run build
```

Tests create their own temporary database. The first backend test run downloads a MongoDB binary; normal app startup does not. The cross-project HTTP test runs when both sibling folders are present and is skipped when testing the backend as an independent repository.

## Checks still belonging to deployment

No account-specific Vercel deployment, real Atlas cluster, Windows execution, physical-device PWA installation, load benchmark or independent security audit was performed. The UI was preserved and covered by component tests; a new browser visual review was not performed for this restructuring. Follow README-VERCEL.md and verify registration, both cash pages, reload/login, password changes and installation on the final domain before using production data.
