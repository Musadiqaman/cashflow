import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
process.env.NODE_ENV = 'test';
process.env.APP_SECRET = randomBytes(48).toString('hex');
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
let replica, app, models, dates, owner, other;
let password = 'A long private passphrase 42';
function actor(response) {
  assert.ok(response.body.csrfToken);
  return {
    cookie: response.headers['set-cookie'][0].split(';')[0],
    csrf: response.body.csrfToken,
    user: response.body.user,
  };
}
function call(who, method, url, body, headers = {}) {
  let r = request(app)[method](url).set('Origin', process.env.APP_ORIGIN);
  if (who) r = r.set('Cookie', who.cookie).set('X-CSRF-Token', who.csrf);
  for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
  return method === 'get' ? r : r.send(body ?? {});
}
function input(overrides = {}) {
  return {
    type: 'in',
    amount: '100.25',
    category: 'Sales',
    title: 'Customer payment',
    note: 'Invoice paid',
    occurredOn: dates.today('Asia/Karachi'),
    ...overrides,
  };
}
async function create(who = owner, data = input(), key = randomUUID()) {
  return call(who, 'post', '/api/entries', data, { 'Idempotency-Key': key });
}
before(
  async () => {
    const args = [
      ...(process.platform === 'win32' ? [] : ['--nounixsocket']),
      '--setParameter',
      'diagnosticDataCollectionEnabled=false',
    ];
    replica =
      process.env.TEST_TOPOLOGY === 'replica'
        ? await MongoMemoryReplSet.create({
            replSet: { count: 1, storageEngine: 'wiredTiger', args },
          })
        : await MongoMemoryServer.create({ instance: { storageEngine: 'wiredTiger', args } });
    process.env.MONGODB_URI = replica.getUri('cashbook_test');
    models = await import('../src/models/index.js');
    dates = await import('../src/utils/dates.js');
    const { connectDatabase } = await import('../src/config/database.js');
    await connectDatabase();
    app = (await import('../src/app.js')).createApp();
    const a = await call(null, 'post', '/api/auth/register', {
      name: 'Ayesha Khan',
      email: 'owner@example.com',
      password,
    });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    owner = actor(a);
    const b = await call(null, 'post', '/api/auth/register', {
      name: 'Hamza Ali',
      email: 'other@example.com',
      password,
    });
    assert.equal(b.status, 201);
    other = actor(b);
  },
  { timeout: 180000 },
);
beforeEach(async () => {
  await models.RateBucket.deleteMany({});
  await models.Entry.deleteMany({});
  await models.AuditEvent.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test('registration stores a salted password hash and an HttpOnly session', async () => {
  const user = await models.User.findById(owner.user.id).select('+passwordHash').lean();
  assert.ok(user.passwordHash.startsWith('scrypt$32768$8$3$'));
  assert.ok(!user.passwordHash.includes(password));
  const response = await call(null, 'post', '/api/auth/login', {
    email: 'OWNER@EXAMPLE.COM',
    password,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(response.body.user.passwordHash, undefined);
  assert.equal((await call(null, 'get', '/api/entries')).status, 401);
});
test('production cookie uses __Host prefix, Secure, HttpOnly and SameSite', () => {
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import {cookieName,cookieOptions} from './src/middleware/auth.js';console.log(JSON.stringify({cookieName,cookieOptions}))",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'production', APP_ORIGIN: 'https://cashbook.example.com' },
        encoding: 'utf8',
      },
    ),
  );
  assert.equal(result.cookieName, '__Host-cb_session');
  assert.equal(result.cookieOptions.secure, true);
  assert.equal(result.cookieOptions.httpOnly, true);
  assert.equal(result.cookieOptions.sameSite, 'lax');
  assert.equal(result.cookieOptions.path, '/');
});
test('security headers and API no-store are applied', async () => {
  const response = await call(owner, 'get', '/api/auth/me');
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(response.headers['x-powered-by'], undefined);
});
test('malicious Origin, missing CSRF and malformed JSON cannot mutate cash', async () => {
  const body = input();
  assert.equal(
    (
      await call(owner, 'post', '/api/entries', body, {
        'Idempotency-Key': randomUUID(),
        Origin: 'https://evil.example',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(owner, 'post', '/api/entries', body, {
        'Idempotency-Key': randomUUID(),
        'X-CSRF-Token': '',
      })
    ).status,
    403,
  );
  const invalid = await request(app)
    .post('/api/entries')
    .set('Origin', process.env.APP_ORIGIN)
    .set('Content-Type', 'application/json')
    .send('{invalid');
  assert.equal(invalid.status, 400);
  assert.equal(await models.Entry.countDocuments(), 0);
});
test('cash in and out use exact integer arithmetic and update summaries', async () => {
  assert.equal((await create(owner, input({ amount: '0.10' }))).status, 201);
  assert.equal((await create(owner, input({ amount: '0.20' }))).status, 201);
  assert.equal(
    (await create(owner, input({ type: 'out', category: 'Food', amount: '0.05' }))).status,
    201,
  );
  const response = await call(owner, 'get', '/api/dashboard');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.balanceMinor, 25);
  assert.equal(response.body.period.inMinor, 30);
  assert.equal(response.body.period.outMinor, 5);
  assert.equal(response.body.period.count, 3);
  assert.equal(response.body.expenses[0].name, 'Food');
});
test('invalid amounts, dates, categories and extra userId fields are rejected', async () => {
  for (const amount of ['0', '-1', '1.001', '1e3', 'NaN', '01.00', '1000000000'])
    assert.equal((await create(owner, input({ amount }))).status, 400, amount);
  for (const patch of [
    { occurredOn: '2026-02-30' },
    { occurredOn: dates.addDays(dates.today('Asia/Karachi'), 2) },
    { category: 'Rent' },
    { userId: other.user.id },
  ])
    assert.equal((await create(owner, input(patch))).status, 400);
  assert.equal(await models.Entry.countDocuments(), 0);
});
test('idempotency prevents double entry and rejects different payload reuse', async () => {
  const key = randomUUID(),
    a = await create(owner, input(), key),
    b = await create(owner, input(), key);
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(b.body.replayed, true);
  assert.equal(a.body.entry.id, b.body.entry.id);
  assert.equal((await create(owner, input({ amount: '200' }), key)).status, 409);
  assert.equal(await models.Entry.countDocuments(), 1);
  assert.equal((await call(owner, 'get', '/api/dashboard')).body.balanceMinor, 10025);
});
test('concurrent idempotent requests commit a single entry', async () => {
  const key = randomUUID(),
    results = await Promise.all([
      create(owner, input(), key),
      create(owner, input(), key),
      create(owner, input(), key),
    ]);
  assert.ok(
    results.every((r) => r.status === 200 || r.status === 201),
    JSON.stringify(results.map((r) => r.body)),
  );
  assert.equal(await models.Entry.countDocuments(), 1);
  assert.equal((await models.Entry.findOne({}).select('+history')).history.length, 1);
});
test('concurrent independent cash writes keep live dashboard totals consistent', async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) => create(owner, input({ amount: String(i + 1) }))),
  );
  assert.ok(
    results.every((r) => r.status === 201),
    JSON.stringify(results.map((r) => r.body)),
  );
  const response = await call(owner, 'get', '/api/dashboard');
  assert.equal(response.body.balanceMinor, 2100);
  assert.equal(response.body.period.inMinor, 2100);
  assert.equal(response.body.period.count, 6);
});
test('failed atomic entry insert cannot leave a balance or audit side effect', async (t) => {
  t.mock.method(models.Entry.collection, 'insertOne', async () => {
    throw new Error('Simulated write failure');
  });
  const response = await create();
  assert.equal(response.status, 500);
  assert.equal(await models.Entry.countDocuments(), 0);
  assert.equal(await models.AuditEvent.countDocuments(), 0);
  assert.equal((await call(owner, 'get', '/api/dashboard')).body.balanceMinor, 0);
});
test('every ledger read, mutation, audit and export is scoped to the current user', async () => {
  const created = (await create()).body.entry;
  const entries = await call(other, 'get', '/api/entries');
  assert.equal(entries.body.items.length, 0);
  assert.equal((await call(other, 'get', '/api/dashboard')).body.balanceMinor, 0);
  assert.equal(
    (await call(other, 'patch', `/api/entries/${created.id}`, { ...input(), version: 1 })).status,
    404,
  );
  assert.equal(
    (
      await call(other, 'post', `/api/entries/${created.id}/void`, {
        version: 1,
        reason: 'Not mine',
      })
    ).status,
    404,
  );
  assert.equal((await call(other, 'get', `/api/entries/${created.id}/history`)).status, 404);
  assert.ok(!(await call(other, 'get', '/api/export')).text.includes(created.reference));
});
test('editing updates all-time totals, categories and original day without drift', async () => {
  const entry = (await create()).body.entry,
    previous = dates.addDays(dates.today('Asia/Karachi'), -1);
  const response = await call(owner, 'patch', `/api/entries/${entry.id}`, {
    ...input({ amount: '50.10', type: 'out', category: 'Rent', occurredOn: previous }),
    version: 1,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.entry.version, 2);
  const stats = (await call(owner, 'get', '/api/dashboard')).body;
  assert.equal(stats.balanceMinor, -5010);
  assert.equal(stats.period.inMinor, 0);
  assert.equal(stats.period.outMinor, 5010);
  assert.equal(stats.period.count, 1);
  assert.equal(stats.expenses[0].name, 'Rent');
  assert.equal(
    (await call(owner, 'patch', `/api/entries/${entry.id}`, { ...input(), version: 1 })).status,
    409,
  );
});
test('void removes financial effect while preserving audit and disallowing edits', async () => {
  const entry = (await create()).body.entry;
  const response = await call(owner, 'post', `/api/entries/${entry.id}/void`, {
    version: 1,
    reason: 'Duplicate receipt',
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.entry.status, 'void');
  assert.equal((await call(owner, 'get', '/api/dashboard')).body.balanceMinor, 0);
  assert.equal((await call(owner, 'get', '/api/entries')).body.items.length, 0);
  assert.equal((await call(owner, 'get', '/api/entries?status=void')).body.items.length, 1);
  const history = await call(owner, 'get', `/api/entries/${entry.id}/history`);
  assert.equal(history.body.events.length, 2);
  assert.equal(
    (await call(owner, 'patch', `/api/entries/${entry.id}`, { ...input(), version: 2 })).status,
    409,
  );
});
test('cursor pagination is bounded, stable on same-day entries and signed to owner/filter', async () => {
  for (let i = 0; i < 7; i++) await create(owner, input({ title: `Payment ${i}` }));
  const all = [],
    first = await call(owner, 'get', '/api/entries?limit=3');
  let page = first.body;
  assert.equal(page.items.length, 3);
  assert.ok(page.nextCursor);
  while (true) {
    all.push(...page.items.map((e) => e.id));
    if (!page.nextCursor) break;
    const response = await call(owner, 'get', `/api/entries?limit=3&cursor=${page.nextCursor}`);
    assert.equal(response.status, 200);
    page = response.body;
  }
  assert.equal(all.length, 7);
  assert.equal(new Set(all).size, 7);
  assert.equal(
    (await call(other, 'get', `/api/entries?limit=3&cursor=${first.body.nextCursor}`)).status,
    400,
  );
  assert.equal(
    (await call(owner, 'get', `/api/entries?limit=3&type=out&cursor=${first.body.nextCursor}`))
      .status,
    400,
  );
  assert.equal(
    (await call(owner, 'get', `/api/entries?limit=3&cursor=${first.body.nextCursor}x`)).status,
    400,
  );
  assert.equal((await call(owner, 'get', '/api/entries?limit=100000')).status, 400);
});
test('exact reference lookup, date filters and safe CSV export work', async () => {
  const entry = (await create(owner, input({ title: '  =HYPERLINK("bad")', note: '@formula' })))
    .body.entry;
  const found = await call(owner, 'get', `/api/entries?reference=${entry.reference}`);
  assert.equal(found.body.items[0].id, entry.id);
  const response = await call(owner, 'get', `/api/export?reference=${entry.reference}`);
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/csv/);
  assert.ok(response.text.includes("'=HYPERLINK"));
  assert.ok(response.text.includes("'@formula"));
  assert.ok(response.text.includes('100.25'));
  const tomorrow = dates.addDays(dates.today('Asia/Karachi'), 1);
  assert.equal((await call(owner, 'get', `/api/entries?from=${tomorrow}`)).body.items.length, 0);
});
test('Vercel exports reject oversized UTF-8 CSV with an actionable error', async (t) => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  const rows = Array.from({ length: 2200 }, () => ({
    reference: 'CB-TEST',
    occurredOn: '2026-01-01',
    type: 'in',
    title: 'Receipt',
    category: 'Sales',
    amountMinor: 100,
    status: 'active',
    note: 'ا'.repeat(1000),
  }));
  const query = {
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    maxTimeMS() {
      return this;
    },
    async lean() {
      return rows;
    },
  };
  t.mock.method(models.Entry, 'find', () => query);
  try {
    const response = await call(owner, 'get', '/api/export');
    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, 'EXPORT_SIZE_LIMIT');
    assert.match(response.body.error.message, /smaller date range/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test('serverless entry preserves private authenticated API routes and query strings', async () => {
  const { createServerlessApp } = await import('../src/serverless.js');
  const { connectDatabase } = await import('../src/config/database.js');
  const cloud = createServerlessApp({ connect: () => connectDatabase({ indexes: false }) });
  const created = (await create()).body.entry;
  const response = await request(cloud)
    .get(`/api/entries?reference=${created.reference}`)
    .set('Cookie', owner.cookie);
  assert.equal(response.status, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, created.id);
  await request(cloud).get('/api/entries').expect(401);
});

test('MongoDB operator injection and excessively broad dashboard ranges fail validation', async () => {
  assert.equal((await call(owner, 'get', '/api/entries?type%5B%24ne%5D=in')).status, 400);
  assert.equal(
    (await call(owner, 'get', '/api/dashboard?from=2000-01-01&to=2026-01-01')).status,
    400,
  );
  assert.equal(
    (await call(owner, 'post', '/api/auth/login', { email: { $ne: null }, password })).status,
    400,
  );
});
test('all required indexes are created automatically, including TTL and unique indexes', async () => {
  const entries = await models.Entry.collection.indexes();
  assert.ok(entries.some((i) => i.name === 'ledger_user_status_date'));
  assert.ok(entries.some((i) => i.name === 'ledger_idempotency_unique' && i.unique));
  assert.ok(entries.some((i) => i.name === 'ledger_user_category_date'));
  const sessions = await models.Session.collection.indexes();
  assert.ok(sessions.some((i) => i.expireAfterSeconds === 0));
  await create();
  const explain = await models.Entry.find({ userId: owner.user.id, status: 'posted' })
    .sort({ occurredOn: -1, _id: -1 })
    .limit(20)
    .explain('queryPlanner');
  assert.match(JSON.stringify(explain.queryPlanner), /IXSCAN/);
});
test('profile update works but cannot alter email, currency, ownership or totals', async () => {
  const response = await call(owner, 'patch', '/api/auth/profile', {
    name: 'Ayesha Updated',
    timezone: 'Asia/Dubai',
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.name, 'Ayesha Updated');
  assert.equal(
    (
      await call(owner, 'patch', '/api/auth/profile', {
        name: 'Ayesha',
        timezone: 'UTC',
        currency: 'USD',
        totals: { inMinor: 1 },
      })
    ).status,
    400,
  );
});
test('password change verifies current password, revokes old sessions and rotates CSRF', async () => {
  const oldSession = owner,
    second = actor(
      await call(null, 'post', '/api/auth/login', { email: 'owner@example.com', password }),
    );
  assert.equal(
    (
      await call(owner, 'post', '/api/auth/password', {
        currentPassword: 'incorrect password',
        newPassword: 'New secure passphrase 2026',
      })
    ).status,
    400,
  );
  const updated = await call(owner, 'post', '/api/auth/password', {
    currentPassword: password,
    newPassword: 'New secure passphrase 2026',
  });
  assert.equal(updated.status, 200);
  owner = actor(updated);
  password = 'New secure passphrase 2026';
  assert.notEqual(owner.csrf, oldSession.csrf);
  assert.equal((await call(oldSession, 'get', '/api/auth/me')).status, 401);
  assert.equal((await call(second, 'get', '/api/auth/me')).status, 401);
  assert.equal((await call(owner, 'get', '/api/auth/me')).status, 200);
  assert.equal(
    (
      await call(null, 'post', '/api/auth/login', {
        email: 'owner@example.com',
        password: 'A long private passphrase 42',
      })
    ).status,
    401,
  );
});
test('expired sessions are rejected even before MongoDB TTL cleanup runs', async () => {
  const login = actor(
    await call(null, 'post', '/api/auth/login', { email: 'owner@example.com', password }),
  );
  const { sha256 } = await import('../src/utils/crypto.js');
  await models.Session.updateOne(
    { tokenHash: sha256(login.cookie.split('=')[1]) },
    { $set: { expiresAt: new Date(0) } },
  );
  assert.equal((await call(login, 'get', '/api/auth/me')).status, 401);
});
test('login account rate limit is enforced using shared MongoDB counters', async () => {
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await call(null, 'post', '/api/auth/login', {
          email: 'absent@example.com',
          password: 'incorrect password',
        })
      ).status,
      401,
    );
  const response = await call(null, 'post', '/api/auth/login', {
    email: 'absent@example.com',
    password: 'incorrect password',
  });
  assert.equal(response.status, 429);
  assert.ok(response.headers['retry-after']);
});

test('the default test database is a genuine standalone MongoDB', async () => {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(Boolean(hello.setName), process.env.TEST_TOPOLOGY === 'replica');
});
test('concurrent edits commit exactly one value and one audit revision', async () => {
  const entry = (await create()).body.entry;
  const results = await Promise.all(
    ['11', '22'].map((amount) =>
      call(owner, 'patch', `/api/entries/${entry.id}`, { ...input({ amount }), version: 1 }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results.find((r) => r.status === 200).body.entry;
  const saved = await models.Entry.findById(entry.id).select('+history').lean();
  assert.equal(saved.amountMinor, winner.amountMinor);
  assert.equal(saved.history.length, 2);
  assert.equal(saved.history[1].after.amountMinor, winner.amountMinor);
  assert.equal((await call(owner, 'get', '/api/dashboard')).body.balanceMinor, winner.amountMinor);
});
test('edit and void racing on one revision cannot both commit', async () => {
  const entry = (await create()).body.entry;
  const results = await Promise.all([
    call(owner, 'patch', `/api/entries/${entry.id}`, { ...input({ amount: '25' }), version: 1 }),
    call(owner, 'post', `/api/entries/${entry.id}/void`, { version: 1, reason: 'Duplicate' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const saved = await models.Entry.findById(entry.id).select('+history').lean();
  assert.equal(saved.history.length, 2);
  assert.equal(
    (await call(owner, 'get', '/api/dashboard')).body.balanceMinor,
    saved.status === 'void' ? 0 : 2500,
  );
});
test('history is private and revision limits still allow a final void', async () => {
  const entry = (await create()).body.entry;
  assert.equal((await call(owner, 'get', '/api/entries')).body.items[0].history, undefined);
  await models.Entry.updateOne({ _id: entry.id }, { $set: { version: 1000 } });
  const edit = await call(owner, 'patch', `/api/entries/${entry.id}`, {
    ...input(),
    version: 1000,
  });
  assert.equal(edit.body.error.code, 'HISTORY_LIMIT');
  assert.equal(
    (
      await call(owner, 'post', `/api/entries/${entry.id}/void`, {
        version: 1000,
        reason: 'Replace exhausted revision history',
      })
    ).status,
    200,
  );
});
test('existing v1 audit records remain readable beside new embedded history', async () => {
  const entry = (await create()).body.entry;
  await models.Entry.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(entry.id) },
    { $unset: { history: '' } },
  );
  await models.AuditEvent.create({
    userId: owner.user.id,
    entryId: entry.id,
    action: 'create',
    after: entry,
  });
  await call(owner, 'patch', `/api/entries/${entry.id}`, {
    ...input({ amount: '55' }),
    version: 1,
  });
  const history = await call(owner, 'get', `/api/entries/${entry.id}/history`);
  assert.deepEqual(
    history.body.events.map((e) => e.action),
    ['edit', 'create'],
  );
});
test('failed replacement session creation leaves password and session valid', async (t) => {
  const before = await models.User.findById(owner.user.id).select('+passwordHash').lean();
  t.mock.method(models.Session, 'create', async () => {
    throw new Error('Session storage failed');
  });
  const response = await call(owner, 'post', '/api/auth/password', {
    currentPassword: password,
    newPassword: 'Another private passphrase 2026',
  });
  assert.equal(response.status, 500);
  const after = await models.User.findById(owner.user.id).select('+passwordHash').lean();
  assert.equal(after.passwordHash, before.passwordHash);
  assert.equal(after.authVersion, before.authVersion);
  assert.equal((await call(owner, 'get', '/api/auth/me')).status, 200);
});
test('duplicate registration cleans its unissued session', async () => {
  const count = await models.Session.countDocuments();
  const response = await call(null, 'post', '/api/auth/register', {
    name: 'Duplicate',
    email: 'owner@example.com',
    password,
  });
  assert.equal(response.status, 409);
  assert.equal(await models.Session.countDocuments(), count);
});
test('two-project proxy completes registration, cash, history and logout with one cookie origin', async (t) => {
  if (!existsSync(new URL('../../frontend/server/proxy.js', import.meta.url))) {
    t.skip('Run this cross-project check from the complete ZIP.');
    return;
  }
  const { env } = await import('../src/config/env.js');
  const { createProxyHandler } = await import('../../frontend/server/proxy.js');
  const originalSecret = env.PROXY_SECRET;
  const secret = randomBytes(48).toString('hex');
  env.PROXY_SECRET = secret;
  const backend = createServer(app);
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const proxy = createProxyHandler({
    backendUrl: `http://127.0.0.1:${backend.address().port}`,
    secret,
    production: false,
  });
  let person;
  const through = (method, path, body, extra = {}) => {
    let r = request(proxy)
      [method](path)
      .set('Origin', process.env.APP_ORIGIN)
      .set('Sec-Fetch-Site', 'same-origin');
    if (person) r = r.set('Cookie', person.cookie).set('X-CSRF-Token', person.csrf);
    for (const [key, value] of Object.entries(extra)) r = r.set(key, value);
    return method === 'get' ? r : r.send(body ?? {});
  };
  try {
    const registration = await through('post', '/api/auth/register', {
      name: 'Proxy Account',
      email: 'proxy@example.com',
      password: 'Proxy private password 123',
    });
    assert.equal(registration.status, 201, registration.text);
    person = actor(registration);
    assert.match(registration.headers['set-cookie'][0], /HttpOnly/);
    assert.equal((await through('get', '/api/auth/me')).status, 200);
    const added = await through('post', '/api/entries', input(), {
      'Idempotency-Key': randomUUID(),
    });
    assert.equal(added.status, 201, added.text);
    assert.equal((await through('get', '/api/dashboard')).body.balanceMinor, 10025);
    assert.equal(
      (await through('get', `/api/entries?reference=${added.body.entry.reference}`)).body.items
        .length,
      1,
    );
    assert.equal(
      (await through('get', `/api/entries/${added.body.entry.id}/history`)).body.events.length,
      1,
    );
    assert.equal((await request(app).get('/api/entries').set('Cookie', person.cookie)).status, 403);
    assert.equal((await through('post', '/api/auth/logout')).status, 204);
    assert.equal((await through('get', '/api/auth/me')).status, 401);
  } finally {
    env.PROXY_SECRET = originalSecret;
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});
test('logout everywhere invalidates all account sessions', async () => {
  const second = actor(
    await call(null, 'post', '/api/auth/login', { email: 'owner@example.com', password }),
  );
  assert.equal((await call(owner, 'post', '/api/auth/logout-all')).status, 204);
  assert.equal((await call(owner, 'get', '/api/auth/me')).status, 401);
  assert.equal((await call(second, 'get', '/api/auth/me')).status, 401);
  assert.equal((await call(other, 'get', '/api/auth/me')).status, 200);
});
