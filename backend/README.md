# Cashbook backend — v2

Normal local MongoDB, MongoDB Atlas, and a separate Vercel backend project are supported. This folder has its own package.json and lockfile. There is no root workspace or Docker requirement.

## Local run — Windows / macOS / Linux

Use Node **22.22.2 or newer within 22.x**, or **24.15.0 or newer within 24.x**. Node 22.22.3 is supported.

Keep your normal MongoDB service running. Then open a terminal inside this `backend` folder:

```bash
npm install
npm run dev
```

The first `npm run dev` automatically creates `.env` and generates a random application secret. It never overwrites an existing `.env`.

Default configuration:

```dotenv
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/cashbook
APP_ORIGIN=http://localhost:5173
```

The generated `APP_SECRET` is also in `.env`. Keep it private. Ordinary standalone MongoDB works; no replica-set setup is needed. The database and declared indexes are created automatically.

Start the frontend in a second terminal using its README. Open **http://localhost:5173**. The backend readiness endpoint is **http://localhost:4000/health/ready**.

If using an existing local database named `cashboo`, set `MONGODB_URI=mongodb://127.0.0.1:27017/cashboo` in `.env`. Existing account and entry records remain readable. Never point development tests at a real business database.

## Folder responsibilities

| Folder / file       | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `src/models/`       | Individual User, Session, Entry and RateLimit models; legacy audit reader |
| `src/routes/`       | Endpoint definitions, authentication and rate-limit middleware            |
| `src/controllers/`  | Request validation, service calls and HTTP responses                      |
| `src/services/`     | Authentication, entry operations, dashboard aggregation and CSV export    |
| `src/validators/`   | Strict input schemas and category/date rules                              |
| `src/middleware/`   | Session auth, CSRF, proxy validation, rate limits and error handling      |
| `src/config/`       | Environment, MongoDB and logging configuration                            |
| `src/utils/`        | Exact money conversion, dates, signing and errors                         |
| `src/app.js`        | Express middleware and route assembly                                     |
| `src/server.js`     | Local/persistent Node server and graceful shutdown                        |
| `src/serverless.js` | Reusable MongoDB initialization for Vercel                                |
| `api/index.js`      | Vercel function entry point                                               |
| `scripts/setup.mjs` | Automatic local `.env` setup                                              |
| `test/`             | Real MongoDB API tests, money tests and function adapter checks           |

## Deploy

Follow **README-VERCEL.md**. Import this folder as a separate Vercel project, with Root Directory `backend` when both folders share one repository. The frontend is imported as a second project.

## Commands

```bash
npm test
npm run test:replica
npm run db:indexes
npm run secret
```

`npm test` starts a genuine temporary standalone MongoDB. `test:replica` repeats the API tests on a temporary replica set. The first test run downloads the MongoDB binary. These tests never use your `.env` database. The optional cross-project test requires the sibling `frontend` folder.

`npm start` is for a persistent Node server after its environment is configured; Vercel invokes `api/index.js` automatically.

## Common local errors

| Message                                   | Fix                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Connection refused / cannot reach MongoDB | Start the installed MongoDB service; confirm Compass can connect to `mongodb://127.0.0.1:27017` |
| `EADDRINUSE`                              | Stop the older backend terminal with Ctrl+C before starting this version                        |
| Origin rejected                           | Open the frontend at `http://localhost:5173` and use that exact `APP_ORIGIN`                    |
| Replica set required                      | You are running the previous package. Use this new backend folder                               |
| Port 5173 already in use                  | Stop the earlier frontend terminal, then start this one                                         |

Architecture, safeguards, limits and verification are in `docs/`.
