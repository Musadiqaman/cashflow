import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { equal, sign } from '../utils/crypto.js';
export function requireTrustedMutation(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('origin') !== env.APP_ORIGIN || req.get('sec-fetch-site') === 'cross-site')
    throw new AppError(403, 'ORIGIN_REJECTED', 'This request did not come from the application.');
  if (!req.is('application/json'))
    throw new AppError(415, 'JSON_REQUIRED', 'Send an application/json request.');
  next();
}
export const csrfFor = (token) => sign(`csrf:${token}`);
export function requireCsrf(req, res, next) {
  if (!equal(req.get('x-csrf-token'), csrfFor(req.sessionToken)))
    throw new AppError(
      403,
      'CSRF_REJECTED',
      'Your security token expired. Refresh the page and try again.',
    );
  next();
}
