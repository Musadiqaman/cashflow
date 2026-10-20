import { Router } from 'express';
import * as entries from '../controllers/entry.controller.js';
import { overview } from '../controllers/dashboard.controller.js';
import { download } from '../controllers/export.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/security.js';
import { limit } from '../middleware/rate-limit.js';
const router = Router();
router.use(requireAuth);
router.get('/categories', entries.categoryList);
router.get('/dashboard', overview);
router.get('/entries', entries.list);
router.post(
  '/entries',
  requireCsrf,
  limit('write', 60, 60000, (req) => String(req.user._id)),
  entries.create,
);
router.patch('/entries/:id', requireCsrf, entries.edit);
router.post('/entries/:id/void', requireCsrf, entries.voidEntry);
router.get('/entries/:id/history', entries.history);
router.get(
  '/export',
  limit('export', 5, 60000, (req) => String(req.user._id)),
  download,
);
export default router;
