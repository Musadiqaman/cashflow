import mongoose from 'mongoose';
import { User, Entry } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { MAX_TOTAL } from '../utils/money.js';
import { addDays, dayCount } from '../utils/dates.js';
const moneySum = (type) => ({
  $sum: { $cond: [{ $eq: ['$type', type] }, { $toDecimal: '$amountMinor' }, { $toDecimal: 0 }] },
});
const totalGroup = () => ({
  $group: { _id: null, inMinor: moneySum('in'), outMinor: moneySum('out'), count: { $sum: 1 } },
});
function safeTotal(value = 0) {
  const result = Number(value.toString());
  if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_TOTAL)
    throw new AppError(
      422,
      'REPORT_RANGE_LIMIT',
      'These totals exceed the supported reporting range.',
    );
  return result;
}
function summary(row = {}) {
  return {
    inMinor: safeTotal(row.inMinor),
    outMinor: safeTotal(row.outMinor),
    count: safeTotal(row.count),
  };
}
export async function dashboard(userId, range) {
  const id = new mongoose.Types.ObjectId(userId),
    days = dayCount(range.from, range.to);
  const current = { $gte: range.from, $lte: range.to };
  const prior = { $gte: addDays(range.from, -days), $lt: range.from };
  // A single indexed ledger stream feeds every dashboard reducer. No mutable
  // duplicate balance or rollup documents exist, so standalone writes stay atomic.
  const [user, results] = await Promise.all([
    User.findById(id).select('currency').lean(),
    Entry.aggregate([
      { $match: { userId: id, status: 'posted' } },
      { $project: { type: 1, amountMinor: 1, category: 1, occurredOn: 1 } },
      {
        $facet: {
          lifetime: [totalGroup()],
          period: [{ $match: { occurredOn: current } }, totalGroup()],
          previous: [{ $match: { occurredOn: prior } }, totalGroup()],
          daily: [
            { $match: { occurredOn: current } },
            {
              $group: {
                _id: { date: '$occurredOn', type: '$type' },
                total: { $sum: { $toDecimal: '$amountMinor' } },
              },
            },
          ],
          expenses: [
            { $match: { occurredOn: current, type: 'out' } },
            { $group: { _id: '$category', total: { $sum: { $toDecimal: '$amountMinor' } } } },
          ],
        },
      },
    ])
      .hint('ledger_dashboard_covering')
      .option({ maxTimeMS: 10000 }),
  ]);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  const data = results[0],
    lifetime = summary(data.lifetime[0]);
  const series = new Map();
  for (let i = 0; i < days; i++) {
    const date = addDays(range.from, i);
    series.set(date, { date, inMinor: 0, outMinor: 0 });
  }
  for (const row of data.daily)
    series.get(row._id.date)[row._id.type === 'in' ? 'inMinor' : 'outMinor'] = safeTotal(row.total);
  return {
    range,
    currency: user.currency,
    balanceMinor: lifetime.inMinor - lifetime.outMinor,
    lifetime,
    period: summary(data.period[0]),
    previous: summary(data.previous[0]),
    series: [...series.values()],
    expenses: data.expenses
      .map((row) => ({ name: row._id, amountMinor: safeTotal(row.total) }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
  };
}
