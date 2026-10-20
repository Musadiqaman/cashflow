import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { equal } from '../utils/crypto.js';
export function requireProxy(req, res, next) {
  if (!env.PROXY_SECRET) return next();
  const ip = req.get('x-cashbook-client-ip'),
    timestamp = req.get('x-cashbook-proxy-time'),
    nonce = req.get('x-cashbook-proxy-nonce');
  const invalid = () =>
    new AppError(403, 'PROXY_REJECTED', 'Open Cashbook using the frontend website.');
  if (
    !isIP(ip || '') ||
    !/^\d{13}$/.test(timestamp || '') ||
    Math.abs(Date.now() - Number(timestamp)) > 90000 ||
    !/^[a-f\d-]{36}$/i.test(nonce || '')
  )
    throw invalid();
  const payload = JSON.stringify([req.method, req.originalUrl, ip, timestamp, nonce]);
  const expected = createHmac('sha256', env.PROXY_SECRET).update(payload).digest('base64url');
  if (!equal(req.get('x-cashbook-proxy-signature'), expected)) throw invalid();
  req.clientIp = ip;
  next();
}
