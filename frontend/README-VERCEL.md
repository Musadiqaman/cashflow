# Vercel par frontend aur backend alag projects mein deploy karo

Is ZIP mein sirf do independent folders hain: `frontend` aur `backend`. Dono ko ek GitHub repository mein rakh sakte ho aur Vercel par do projects import kar sakte ho. Alag GitHub repositories bhi kaam karti hain; us surat mein har project ki Root Directory `./` hogi.

## 1. Atlas

Atlas cluster mein `cashbook` ke liye database user aur strong password banao. User ko `cashbook` database par `readWrite` permissions do. Connect → Drivers se URI lo:

```text
mongodb+srv://USERNAME:URL_ENCODED_PASSWORD@YOUR_CLUSTER/cashbook?retryWrites=true&w=majority
```

Network Access mein apni hosting ka access configure karo. Vercel ke normal outbound IPs fixed nahi hotay. Restricted production networking ke liye Vercel Static IPs ya suitable private network use karo. Agar personal test ke liye `0.0.0.0/0` allow karte ho, to yeh har internet IP ko authentication attempt karne deta hai: strong unique password aur database-scoped permissions zaroor rakho. Laptop ka Current IP allow karna local Atlas use ke liye hai; woh akela Vercel ko allow nahi karta.

## 2. Backend Vercel project

Vercel → Add New → Project → repository import karo.

| Setting          | Value                                           |
| ---------------- | ----------------------------------------------- |
| Project name     | Apna backend naam, misal `musadiq-cashbook-api` |
| Root Directory   | `backend`                                       |
| Framework        | `Other`                                         |
| Install Command  | `npm ci --omit=dev`                             |
| Build Command    | `node --check api/index.js`                     |
| Output Directory | `public`                                        |
| Node.js          | `22.x` or `24.x`                                |

Yeh settings `backend/vercel.json` mein already hain. Normal Express preset select karne ki zaroorat nahi; `api/index.js` Vercel function hai.

Production Environment Variables:

| Name                  | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`            | `production`                                                            |
| `MONGODB_URI`         | Apni Atlas URI                                                          |
| `APP_SECRET`          | Pehla random secret                                                     |
| `PROXY_SECRET`        | Doosra random secret; frontend mein bhi yahi value                      |
| `APP_ORIGIN`          | Apna frontend HTTPS domain, misal `https://musadiq-cashbook.vercel.app` |
| `AUTO_CREATE_INDEXES` | `true`                                                                  |
| `LOG_LEVEL`           | `info`                                                                  |

Secrets banane ke liye backend terminal mein `npm run secret` **do dafa** chalao. Pehli value `APP_SECRET`, doosri `PROXY_SECRET` ke liye use karo. Secrets GitHub ya React ke `VITE_` variables mein mat daalo.

`NODEJS_HELPERS=0` aur `TRUST_PROXY_HOPS=1` Vercel configuration mein already set hain.

Deploy karo. Backend ka actual **Production URL** copy karo. `/health/ready` par `{"status":"ready"}` aana chahiye. Agar frontend domain abhi exact maloom nahi, expected HTTPS frontend domain set karo; step 4 mein actual domain confirm karke update karna hai.

## 3. Frontend Vercel project

Vercel → Add New → Project se wohi repository dobara import karo; yeh naya project hoga.

| Setting          | Value                                        |
| ---------------- | -------------------------------------------- |
| Project name     | Apna frontend naam, misal `musadiq-cashbook` |
| Root Directory   | `frontend`                                   |
| Framework        | `Vite`                                       |
| Install Command  | `npm ci --include=dev`                       |
| Build Command    | `npm run build`                              |
| Output Directory | `dist`                                       |
| Node.js          | `22.x` or `24.x`                             |

Frontend ki Production Environment Variables mein:

```dotenv
BACKEND_URL=https://YOUR-ACTUAL-BACKEND.vercel.app
PROXY_SECRET=EXACTLY-THE-SAME-PROXY-SECRET-AS-BACKEND
```

`BACKEND_URL` backend ka exact Production origin ho: aakhir mein slash ya `/api` nahi. Yeh variables server-side hain. `VITE_` prefix use mat karo. Frontend mein MongoDB URI ya `APP_SECRET` nahi dena.

Frontend deploy karo.

## 4. Actual frontend domain confirm karo

Frontend Project → Settings → Domains se permanent Production domain lo. Backend ke `APP_ORIGIN` mein woh exact value set karo, misal `https://YOUR-ACTUAL-FRONTEND.vercel.app`, phir **backend Redeploy** karo. Aakhir mein `/` nahi lagana.

Frontend ka `PROXY_SECRET` backend se match hona chahiye. Environment variable change ke baad us project ko redeploy karo.

App hamesha isi frontend Production domain se kholo. Random deployment/preview URLs ke origins different hotay hain. Preview tests ke liye alag test database, secrets aur matching origin use karo.

## 5. Final checks

- Frontend URL par register/login karo.
- Cash In aur Cash Out save karke dashboard balance dekho.
- Transactions page refresh karo; edit/void aur password change check karo.
- Mobile par HTTPS frontend URL kholo; Settings → Install Cashbook. iPhone: Safari → Share → Add to Home Screen.

Database collections aur indexes automatically bante hain.

## Login kaise kaam karega?

Hosting projects do hain. Browser frontend ke `/api` se baat karta hai. Frontend ka chhota server-only gateway request backend tak pohanchata hai. Is se HttpOnly login cookie frontend ke apne domain par rehti hai aur third-party-cookie settings par depend nahi karti. Gateway verified client IP bhi bhejta hai taa-ke rate limiting har user IP ke liye sahi rahe.

Backend ke `/api` ko seedha browser mein kholne par `PROXY_REJECTED` aana is setup mein expected hai. Readiness `/health/ready` se check karo; application frontend se use karo.

## Errors

| Error                              | Check                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Frontend `BACKEND_NOT_CONFIGURED`  | Frontend `BACKEND_URL` exact HTTPS origin aur `PROXY_SECRET` at least 48 characters ho |
| `PROXY_REJECTED` through frontend  | Dono projects ka `PROXY_SECRET` same ho; dono updated deployments use karo             |
| `ORIGIN_REJECTED`                  | Backend `APP_ORIGIN` browser ke frontend origin se exact match ho                      |
| `DATABASE_UNAVAILABLE`             | Atlas URI, DB user/password, permissions aur Network Access                            |
| HTML/sign-in screen instead of API | Actual backend Production domain use karo; protected Preview URL mat use karo          |
| API 404                            | Correct folder import hua ho aur uska `api/index.js` + `vercel.json` commit hon        |

Vercel Hobby personal non-commercial use ke liye hai. Shop/business hosting ke liye suitable commercial plan choose karo. Live deployment aur mobile install ko apne account/device par verify karo; source package ki local checks hosting-account verification ka substitute nahi hain.

Official references checked 20 October 2026 (Pakistan time):

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/plans/hobby
- https://www.mongodb.com/docs/atlas/security/ip-access-list/
