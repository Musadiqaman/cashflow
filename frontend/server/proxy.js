import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

// Server-only gateway. These environment values never enter the React bundle.
export function createProxyHandler({
  backendUrl = process.env.BACKEND_URL,
  secret = process.env.PROXY_SECRET,
  production = process.env.NODE_ENV === 'production',
  transport = fetch,
} = {}) {
  return async function proxy(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const fail = (status, code, message) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code, message } }));
    };
    let origin;
    try {
      const target = new URL(backendUrl);
      if (
        target.origin !== backendUrl ||
        target.username ||
        target.password ||
        !['https:', 'http:'].includes(target.protocol)
      )
        throw new Error();
      if (production && target.protocol !== 'https:') throw new Error();
      if (typeof secret !== 'string' || secret.length < 48) throw new Error();
      origin = target.origin;
    } catch {
      return fail(
        503,
        'BACKEND_NOT_CONFIGURED',
        'Cashbook is not configured yet. Please contact the administrator.',
      );
    }
    const path = req.url;
    if (typeof path !== 'string' || !/^\/(?:api|health)\//.test(path) || /[\r\n\\#]/.test(path))
      return fail(404, 'NOT_FOUND', 'Endpoint not found.');
    const destination = new URL(origin + path);
    if (destination.origin !== origin || !/^\/(?:api|health)\//.test(destination.pathname))
      return fail(400, 'INVALID_PATH', 'Invalid request path.');
    if (!['GET', 'POST', 'PATCH', 'HEAD', 'OPTIONS'].includes(req.method))
      return fail(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    const rawIp = production ? req.headers['x-forwarded-for'] : req.socket?.remoteAddress;
    const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
    if (!isIP(ip)) return fail(400, 'INVALID_CLIENT', 'Could not verify the request.');
    const timestamp = String(Date.now()),
      nonce = randomUUID();
    const signature = createHmac('sha256', secret)
      .update(JSON.stringify([req.method, path, ip, timestamp, nonce]))
      .digest('base64url');
    const headers = {
      'x-cashbook-client-ip': ip,
      'x-cashbook-proxy-time': timestamp,
      'x-cashbook-proxy-nonce': nonce,
      'x-cashbook-proxy-signature': signature,
    };
    // Never accept a caller's forwarding identity, upstream URL, or Authorization.
    for (const name of [
      'origin',
      'content-type',
      'cookie',
      'x-csrf-token',
      'idempotency-key',
      'sec-fetch-site',
    ]) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) return fail(413, 'BODY_TOO_LARGE', 'The request is too large.');
        chunks.push(chunk);
      }
      const upstream = await transport(destination, {
        method: req.method,
        headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      if (body.length > 4200000)
        return fail(
          502,
          'UPSTREAM_SIZE_LIMIT',
          'The response is too large. Choose a smaller date range.',
        );
      res.statusCode = upstream.status;
      for (const name of ['content-type', 'content-disposition', 'retry-after', 'x-request-id']) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      if (!res.writableEnded)
        fail(
          502,
          'BACKEND_UNAVAILABLE',
          'Cannot reach Cashbook right now. Please try again shortly.',
        );
    }
  };
}
