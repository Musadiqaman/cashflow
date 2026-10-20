import { Entry } from '../models/index.js';
import { filterFor } from './entry.service.js';
import { AppError } from '../utils/errors.js';
import { toDecimal } from '../utils/money.js';
const cell = (value) => {
  let text = String(value ?? '');
  if (/^(?:\s*[=+\-@]|[\t\r\n])/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export async function exportCsv(user, { cursor, ...query }) {
  if (cursor) throw new AppError(400, 'INVALID_EXPORT', 'Remove the page cursor when exporting.');
  const rows = await Entry.find(filterFor(user._id, query))
    .sort({ occurredOn: -1, _id: -1 })
    .limit(10001)
    .maxTimeMS(10000)
    .lean();
  if (rows.length > 10000)
    throw new AppError(
      422,
      'EXPORT_LIMIT',
      'This export is over 10,000 entries. Choose a smaller date range.',
    );
  const lines = [
    [
      'Reference',
      'Date',
      'Type',
      'Description',
      'Category',
      'Amount',
      'Currency',
      'Status',
      'Note',
      'Void reason',
    ],
    ...rows.map((e) => [
      e.reference,
      e.occurredOn,
      e.type === 'in' ? 'Cash in' : 'Cash out',
      e.title,
      e.category,
      toDecimal(e.amountMinor),
      user.currency,
      e.status,
      e.note,
      e.voidReason,
    ]),
  ];
  const csv = '\ufeff' + lines.map((row) => row.map(cell).join(',')).join('\r\n');
  if (Buffer.byteLength(csv, 'utf8') > 4000000)
    throw new AppError(
      422,
      'EXPORT_SIZE_LIMIT',
      'This export exceeds the hosting size limit. Choose a smaller date range.',
    );
  return csv;
}
