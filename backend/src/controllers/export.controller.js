import { exportCsv } from '../services/export.service.js';
import { parse } from '../utils/errors.js';
import { querySchema } from '../validators/entry.validator.js';
export async function download(req, res) {
  const csv = await exportCsv(req.user, parse(querySchema, req.query));
  res
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cashbook-transactions.csv"',
    })
    .send(csv);
}
