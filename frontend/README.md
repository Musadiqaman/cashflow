# Cashbook frontend — v2

React/Vite responsive cash-management app with cash-in/out pages, dashboard graphs, transaction history, dark/system themes and installable PWA support.

## Local run

Use Node **22.22.2+ within 22.x**, or **24.15.0+ within 24.x**. Node 22.22.3 is supported.

First start the backend in its own terminal (`cd backend`, `npm install`, `npm run dev`). Its default URI uses ordinary local MongoDB.

Then open a second terminal inside this `frontend` folder:

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Create an account and start entering cash. No frontend `.env` is required locally. Vite forwards `/api` and `/health` to `http://127.0.0.1:4000`.

If you choose a different local backend address, copy `.env.example` to `.env` and change `API_TARGET`. Do not put database credentials into frontend configuration.

## Structure

| Folder            | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `src/pages/`      | Overview, authentication, cash entry, transactions and settings screens |
| `src/components/` | Reusable interface and ledger components                                |
| `src/context/`    | Authentication, theme and PWA state                                     |
| `src/routes/`     | Route definitions and protected/guest layouts                           |
| `src/services/`   | Same-origin API client and CSRF handling                                |
| `src/hooks/`      | Connectivity state                                                      |
| `src/utils/`      | Currency/date formatting and display helpers                            |
| `src/styles/`     | Responsive light/dark design                                            |
| `public/`         | Manifest, PWA icons and theme bootstrap                                 |
| `api/index.js`    | Small server-only Vercel gateway entry                                  |
| `server/proxy.js` | Secure connection to the separately deployed backend                    |

## Separate Vercel deployment

Full instructions: **README-VERCEL.md** in this folder (also included with the backend).

Create a second Vercel project with Root Directory `frontend`, Framework **Vite**, Build Command `npm run build`, Output Directory `dist`.

Set these Production variables in the Vercel dashboard:

```dotenv
BACKEND_URL=https://YOUR-ACTUAL-BACKEND.vercel.app
PROXY_SECRET=the-same-random-value-as-the-backend
```

No trailing slash or `/api` in BACKEND_URL. Neither variable gets a `VITE_` prefix. They are read by the server-only gateway and are not embedded in browser JavaScript. Backend APP_ORIGIN must match the actual frontend Production domain.

## Checks and limitations

```bash
npm test
npm run build
```

The browser keeps HttpOnly cookies on the frontend's own origin, so separate Vercel projects do not depend on cross-site cookies. Installation requires HTTPS or localhost. The public app shell can load offline, but viewing/saving financial records requires connectivity.

Version 2 reorganizes the folders and hosting/database behavior; it preserves the existing interface and features. Live Vercel hosting and physical-device installation still need checks on your account/device.
