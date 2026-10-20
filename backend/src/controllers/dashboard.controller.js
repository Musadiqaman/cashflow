import { dashboard } from '../services/dashboard.service.js';
import { parse } from '../utils/errors.js';
import { today, addDays } from '../utils/dates.js';
import { rangeSchema } from '../validators/entry.validator.js';
export async function overview(req, res) {
  const to = today(req.user.timezone);
  res.json(
    await dashboard(req.user._id, parse(rangeSchema, { from: addDays(to, -29), to, ...req.query })),
  );
}
