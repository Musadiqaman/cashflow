import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createProxyHandler } from '../server/proxy.js';
const secret = 'p'.repeat(96);
async function using(handler, action) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    return await action(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test('proxy forwards secure cookies, request identity, query strings and origin', async () => {
  let captured;
  const proxy = createProxyHandler({
    backendUrl: 'https://api.example.com',
    secret,
    production: true,
    transport: async (url, options) => {
      captured = { url: String(url), ...options };
      const headers = new Headers({
        'content-type': 'application/json',
        'set-cookie': '__Host-cb_session=token; HttpOnly; Secure; SameSite=Lax; Path=/',
      });
      return new Response('{"ok":true}', { headers });
    },
  });
  await using(proxy, async (url) => {
    const response = await fetch(url + '/api/entries?limit=20', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        origin: 'https://app.example.com',
        cookie: '__Host-cb_session=existing',
        'x-cashbook-client-ip': 'attacker',
        authorization: 'do-not-forward',
      },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /__Host-cb_session/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  assert.equal(captured.url, 'https://api.example.com/api/entries?limit=20');
  assert.equal(captured.headers['origin'], 'https://app.example.com');
  assert.equal(captured.headers['cookie'], '__Host-cb_session=existing');
  assert.equal(captured.headers['x-cashbook-client-ip'], '203.0.113.10');
  assert.equal(captured.headers.authorization, undefined);
  assert.equal(captured.redirect, 'manual');
});
test('proxy rejects large bodies before forwarding and cannot route arbitrary URLs', async () => {
  let calls = 0;
  const proxy = createProxyHandler({
    backendUrl: 'https://api.example.com',
    secret,
    production: false,
    transport: async () => {
      calls++;
      return new Response('{}');
    },
  });
  await using(proxy, async (url) => {
    assert.equal(
      (await fetch(url + '/api/auth/login', { method: 'POST', body: 'x'.repeat(17000) })).status,
      413,
    );
    assert.equal((await fetch(url + '/admin')).status, 404);
    assert.equal((await fetch(url + '/api/%2e%2e/admin')).status, 404);
  });
  assert.equal(calls, 0);
});
test('proxy rejects incomplete config and hides upstream connection errors', async () => {
  await using(
    createProxyHandler({ backendUrl: 'http://insecure.example', secret, production: true }),
    async (url) => {
      assert.equal((await fetch(url + '/api/auth/me')).status, 503);
    },
  );
  const proxy = createProxyHandler({
    backendUrl: 'https://api.example.com',
    secret,
    production: false,
    transport: async () => {
      throw new Error('private-secret');
    },
  });
  await using(proxy, async (url) => {
    const response = await fetch(url + '/api/auth/me');
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('private-secret'));
  });
});
