import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/not_used';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.APP_SECRET = randomBytes(48).toString('hex');
process.env.LOG_LEVEL = 'silent';
const { createServerlessApp } = await import('../src/serverless.js');

test('concurrent and warm function requests share one initialization', async () => {
  let connections = 0;
  const app = createServerlessApp({
    connect: async () => {
      connections++;
    },
  });
  const responses = await Promise.all(
    Array.from({ length: 15 }, () => request(app).get('/health/live')),
  );
  responses.forEach((response) => {
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.headers['cache-control'], 'no-store');
  });
  await request(app).get('/health/live').expect(200);
  assert.equal(connections, 1);
});

test('failed function initialization retries without exposing connection credentials', async () => {
  let attempts = 0;
  const app = createServerlessApp({
    connect: async () => {
      if (++attempts === 1) throw new Error('mongodb://private-secret@example.test');
    },
  });
  const failed = await request(app).get('/health/live');
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, 'DATABASE_UNAVAILABLE');
  assert.equal(failed.headers['cache-control'], 'no-store');
  assert.equal(failed.headers['retry-after'], '5');
  assert.ok(!failed.text.includes('private-secret'));
  await request(app).get('/health/live').expect(200);
  assert.equal(attempts, 2);
});

test('function adapter preserves origin checks and the Express request size limit', async () => {
  const app = createServerlessApp({ connect: async () => {} });
  const untrusted = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'https://untrusted.example')
    .send({});
  assert.equal(untrusted.status, 403);
  const large = await request(app)
    .post('/api/auth/login')
    .set('Origin', process.env.APP_ORIGIN)
    .send({ password: 'x'.repeat(20000) });
  assert.equal(large.status, 413);
  assert.equal(large.body.error.code, 'BODY_TOO_LARGE');
  await request(app).get('/settings').expect(404);
});
