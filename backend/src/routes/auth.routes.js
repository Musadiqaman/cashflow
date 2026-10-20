import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import {
  registerSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
} from '../validators/auth.validator.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/security.js';
import { limit } from '../middleware/rate-limit.js';
const router = Router(),
  authLimit = limit('auth-ip', 20, 15 * 60000);
router.post('/register', authLimit, validate(registerSchema), controller.register);
router.post(
  '/login',
  authLimit,
  validate(loginSchema),
  limit('auth-account', 10, 15 * 60000, (req) => req.input.email),
  controller.login,
);
router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, requireCsrf, controller.logout);
router.post('/logout-all', requireAuth, requireCsrf, controller.logoutAll);
router.patch('/profile', requireAuth, requireCsrf, validate(profileSchema), controller.profile);
router.post(
  '/password',
  requireAuth,
  requireCsrf,
  limit('password', 5, 15 * 60000, (req) => String(req.user._id)),
  validate(passwordSchema),
  controller.changePassword,
);
export default router;
