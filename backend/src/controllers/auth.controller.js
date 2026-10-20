import * as service from '../services/auth.service.js';
import { cookieName, cookieOptions } from '../middleware/auth.js';
import { csrfFor } from '../middleware/security.js';
function setSession(res, result, status = 200) {
  res.cookie(cookieName, result.token, { ...cookieOptions, expires: result.expiresAt });
  return res.status(status).json({ user: result.user, csrfToken: csrfFor(result.token) });
}
export const register = async (req, res) => setSession(res, await service.register(req.input), 201);
export const login = async (req, res) => setSession(res, await service.login(req.input));
export const me = (req, res) =>
  res.json({ user: service.publicUser(req.user), csrfToken: csrfFor(req.sessionToken) });
export const changePassword = async (req, res) =>
  setSession(res, await service.changePassword(req.user._id, req.input));
export async function logout(req, res) {
  await service.deleteSession(req.session._id);
  res.clearCookie(cookieName, cookieOptions).status(204).end();
}
export async function logoutAll(req, res) {
  await service.logoutEverywhere(req.user._id);
  res.clearCookie(cookieName, cookieOptions).status(204).end();
}
export async function profile(req, res) {
  res.json({ user: await service.updateProfile(req.user._id, req.input) });
}
