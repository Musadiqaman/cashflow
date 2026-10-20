import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { AppError } from './errors.js';
const scrypt = promisify(scryptCallback);
let hashing = 0;
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const sign = (value) =>
  createHmac('sha256', env.APP_SECRET).update(value).digest('base64url');
export const newToken = () => randomBytes(32).toString('base64url');
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
async function derive(password, salt) {
  if (hashing >= 4)
    throw new AppError(503, 'AUTH_BUSY', 'Sign-in is busy. Please try again shortly.');
  hashing++;
  try {
    return await scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 128 * 1024 * 1024 });
  } finally {
    hashing--;
  }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$32768$8$3$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const parts = (encoded || '').split('$');
  const salt = parts.length === 6 ? parts[4] : '00000000000000000000000000000000';
  const derived = (await derive(password, salt)).toString('hex');
  return parts.length === 6 && equal(derived, parts[5]);
}
