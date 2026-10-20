import mongoose from 'mongoose';
import { Entry, AuditEvent } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { sha256, sign, equal } from '../utils/crypto.js';
export function publicEntry(e) {
  return {
    id: String(e._id),
    type: e.type,
    amountMinor: e.amountMinor,
    category: e.category,
    title: e.title,
    note: e.note,
    occurredOn: e.occurredOn,
    reference: e.reference,
    status: e.status,
    version: e.version,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    voidReason: e.voidReason,
    voidedAt: e.voidedAt,
  };
}

export function filterFor(userId, query) {
  const filter = { userId, status: query.status };
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.reference) filter.reference = query.reference;
  if (query.from || query.to)
    filter.occurredOn = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  return filter;
}
function scopeFor(userId, query) {
  const { cursor, ...filter } = query;
  return sha256(JSON.stringify({ userId: String(userId), ...filter }));
}
function packCursor(entry, scope) {
  const body = Buffer.from(
    JSON.stringify({ date: entry.occurredOn, id: String(entry._id), scope }),
  ).toString('base64url');
  return `${body}.${sign(`cursor:${body}`)}`;
}
export async function listEntries(userId, query) {
  const filter = filterFor(userId, query),
    scope = scopeFor(userId, query);
  if (query.cursor) {
    try {
      const [body, mac, ...extra] = query.cursor.split('.');
      if (extra.length || !equal(mac, sign(`cursor:${body}`))) throw new Error();
      const decoded = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (
        decoded.scope !== scope ||
        !/^\d{4}-\d{2}-\d{2}$/.test(decoded.date) ||
        !/^[a-f\d]{24}$/.test(decoded.id)
      )
        throw new Error();
      filter.$or = [
        { occurredOn: { $lt: decoded.date } },
        { occurredOn: decoded.date, _id: { $lt: new mongoose.Types.ObjectId(decoded.id) } },
      ];
    } catch {
      throw new AppError(
        400,
        'INVALID_CURSOR',
        'This page link is no longer valid. Reset the filters.',
      );
    }
  }
  const rows = await Entry.find(filter)
    .sort({ occurredOn: -1, _id: -1 })
    .limit(query.limit + 1)
    .maxTimeMS(5000)
    .lean();
  const hasMore = rows.length > query.limit,
    items = rows.slice(0, query.limit);
  return {
    items: items.map(publicEntry),
    nextCursor: hasMore ? packCursor(items.at(-1), scope) : null,
    hasMore,
  };
}

const MAX_EDIT_VERSION = 1000;
function replay(existing, inputHash) {
  if (existing.inputHash !== inputHash)
    throw new AppError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'This request key was already used for a different entry.',
    );
  return { entry: publicEntry(existing), replayed: true };
}
export async function createEntry(user, input, idempotencyKey) {
  const inputHash = sha256(JSON.stringify(input));
  const existing = await Entry.findOne({ userId: user._id, idempotencyKey }).lean();
  if (existing) return replay(existing, inputHash);
  const _id = new mongoose.Types.ObjectId(),
    now = new Date();
  const entry = new Entry({
    ...input,
    _id,
    userId: user._id,
    reference: `CB-${_id.toString().toUpperCase()}`,
    idempotencyKey,
    inputHash,
    status: 'posted',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  entry.history = [{ action: 'create', after: publicEntry(entry), version: 1, createdAt: now }];
  try {
    await entry.save();
  } catch (error) {
    if (error.code === 11000) {
      const found = await Entry.findOne({ userId: user._id, idempotencyKey }).lean();
      if (found) return replay(found, inputHash);
    }
    throw error;
  }
  return { entry: publicEntry(entry), replayed: false };
}
async function existingEntry(userId, id) {
  const entry = await Entry.findOne({ _id: id, userId }).lean();
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Entry not found.');
  return entry;
}
function conflict() {
  return new AppError(
    409,
    'VERSION_CONFLICT',
    'This entry changed. Refresh the list before trying again.',
  );
}
export async function editEntry(user, id, input) {
  const entry = await existingEntry(user._id, id);
  if (entry.status !== 'posted')
    throw new AppError(409, 'ENTRY_VOID', 'A voided entry cannot be changed.');
  if (entry.version !== input.version) throw conflict();
  if (entry.version >= MAX_EDIT_VERSION)
    throw new AppError(
      409,
      'HISTORY_LIMIT',
      'This entry reached its revision limit. Void it with a reason and create a replacement.',
    );
  const { version, ...changes } = input,
    now = new Date();
  const after = publicEntry({ ...entry, ...changes, version: version + 1, updatedAt: now });
  const updated = await Entry.findOneAndUpdate(
    { _id: id, userId: user._id, status: 'posted', version },
    {
      $set: { ...changes, updatedAt: now },
      $inc: { version: 1 },
      $push: {
        history: {
          action: 'edit',
          before: publicEntry(entry),
          after,
          version: version + 1,
          createdAt: now,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) throw conflict();
  return publicEntry(updated);
}
export async function voidEntry(user, id, input) {
  const entry = await existingEntry(user._id, id);
  if (entry.status !== 'posted' || entry.version !== input.version) throw conflict();
  const now = new Date(),
    changes = { status: 'void', voidReason: input.reason, voidedAt: now, updatedAt: now };
  const after = publicEntry({ ...entry, ...changes, version: entry.version + 1 });
  const updated = await Entry.findOneAndUpdate(
    { _id: id, userId: user._id, status: 'posted', version: input.version },
    {
      $set: changes,
      $inc: { version: 1 },
      $push: {
        history: {
          action: 'void',
          before: publicEntry(entry),
          after,
          reason: input.reason,
          version: entry.version + 1,
          createdAt: now,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) throw conflict();
  return publicEntry(updated);
}
export async function entryHistory(userId, id) {
  const entry = await Entry.findOne({ _id: id, userId })
    .select('+history')
    .slice('history', -50)
    .lean();
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Entry not found.');
  // Preserve read access to the first package's existing audit collection.
  const legacy = await AuditEvent.find({ userId, entryId: entry._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(50)
    .maxTimeMS(5000)
    .lean();
  const events = [...legacy, ...(entry.history || [])]
    .sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt) || (b.version || 0) - (a.version || 0),
    )
    .slice(0, 50);
  return {
    entry: publicEntry(entry),
    events: events.map((e) => ({
      id: String(e._id),
      action: e.action,
      before: e.before,
      after: e.after,
      reason: e.reason,
      createdAt: e.createdAt,
    })),
    limit: 50,
  };
}
