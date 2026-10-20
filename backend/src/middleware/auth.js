import { Session, User } from '../models/index.js';
import { sha256 } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
export const cookieName = env.NODE_ENV === 'production' ? '__Host-cb_session' : 'cb_session';
export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
export async function requireAuth(req, res, next) {
  const token = req.cookies[cookieName];
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  const session = await Session.findOne({
    tokenHash: sha256(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session)
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session expired. Please sign in again.');
  const user = await User.findById(session.userId).lean();
  if (!user || user.authVersion !== session.authVersion)
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  req.user = user;
  req.session = session;
  req.sessionToken = token;
  next();
}
