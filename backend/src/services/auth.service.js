import mongoose from 'mongoose';
import { User, Session } from '../models/index.js';
import { hashPassword, verifyPassword, newToken, sha256 } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    currency: user.currency,
    timezone: user.timezone,
    createdAt: user.createdAt,
  };
}
export async function makeSession(user) {
  const token = newToken(),
    expiresAt = new Date(Date.now() + 7 * 86400000);
  await Session.create({
    userId: user._id,
    tokenHash: sha256(token),
    authVersion: user.authVersion,
    expiresAt,
  });
  return { token, expiresAt };
}
async function discardPending(token) {
  await Session.deleteOne({ tokenHash: sha256(token) }).catch(() => {
    logger.warn('Unissued session cleanup deferred to expiry');
  });
}
export async function register(data) {
  const passwordHash = await hashPassword(data.password);
  const _id = new mongoose.Types.ObjectId();
  // Stage an unissued session first. A failed insert never returns its token.
  const session = await makeSession({ _id, authVersion: 0 });
  try {
    const user = await User.create({
      _id,
      name: data.name,
      email: data.email,
      passwordHash,
      currency: data.currency,
      timezone: data.timezone,
    });
    return { user: publicUser(user), ...session };
  } catch (error) {
    await discardPending(session.token);
    if (error.code === 11000)
      throw new AppError(
        409,
        'REGISTRATION_FAILED',
        'Unable to register with these details. Try signing in with your existing account.',
      );
    throw error;
  }
}
export async function login(data) {
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  const valid = await verifyPassword(data.password, user?.passwordHash);
  if (!user || !valid)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return { user: publicUser(user), ...(await makeSession(user)) };
}
export async function changePassword(userId, data) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await verifyPassword(data.currentPassword, user.passwordHash)))
    throw new AppError(400, 'WRONG_PASSWORD', 'Your current password is incorrect.', {
      currentPassword: 'Your current password is incorrect.',
    });
  const passwordHash = await hashPassword(data.newPassword);
  const nextVersion = user.authVersion + 1;
  const session = await makeSession({ _id: user._id, authVersion: nextVersion });
  let updated;
  try {
    // One atomic comparison switches the password and revokes every older session.
    updated = await User.findOneAndUpdate(
      { _id: userId, authVersion: user.authVersion, passwordHash: user.passwordHash },
      { $set: { passwordHash }, $inc: { authVersion: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updated) throw new AppError(409, 'AUTH_CHANGED', 'Your account changed. Sign in again.');
  } catch (error) {
    await discardPending(session.token);
    throw error;
  }
  await Session.deleteMany({ userId, authVersion: { $lt: nextVersion } }).catch(() =>
    logger.warn('Old session cleanup deferred to expiry'),
  );
  return { user: publicUser(updated), ...session };
}
export async function logoutEverywhere(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { authVersion: 1 } },
    { returnDocument: 'after' },
  );
  if (user)
    await Session.deleteMany({ userId, authVersion: { $lt: user.authVersion } }).catch(() =>
      logger.warn('Revoked session cleanup deferred to expiry'),
    );
}
export const deleteSession = (sessionId) => Session.deleteOne({ _id: sessionId });
export async function updateProfile(userId, data) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  return publicUser(user);
}
