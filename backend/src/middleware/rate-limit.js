import { RateBucket } from '../models/index.js';
import { sign } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';
// Shared MongoDB counters work across API replicas; fail closed on store failure.
export function limit(scope, max, windowMs, key = (req) => req.clientIp || req.ip) {
  return async (req, res, next) => {
    const now = Date.now(),
      window = Math.floor(now / windowMs),
      _id = sign(`${scope}:${key(req)}:${window}`),
      expiresAt = new Date((window + 2) * windowMs);
    let bucket;
    try {
      bucket = await RateBucket.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, returnDocument: 'after' },
      ).lean();
    } catch (error) {
      if (error.code !== 11000) throw error;
      bucket = await RateBucket.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      ).lean();
    }
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil(((window + 1) * windowMs - now) / 1000)));
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Too many requests. Please wait before trying again.',
      );
    }
    next();
  };
}
