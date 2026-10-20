import mongoose from 'mongoose';
const { Schema } = mongoose;
const historySchema = new Schema(
  {
    action: { type: String, enum: ['create', 'edit', 'void'], required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
    version: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false },
);
const entrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    amountMinor: { type: Number, required: true, min: 1, max: 99_999_999_999 },
    category: { type: String, required: true },
    title: { type: String, required: true, maxlength: 100 },
    note: { type: String, default: '', maxlength: 500 },
    occurredOn: { type: String, required: true },
    reference: { type: String, required: true, immutable: true },
    status: { type: String, enum: ['posted', 'void'], default: 'posted' },
    version: { type: Number, default: 1 },
    idempotencyKey: { type: String, required: true, immutable: true },
    inputHash: { type: String, required: true, immutable: true },
    history: { type: [historySchema], select: false, default: [] },
    voidReason: String,
    voidedAt: Date,
  },
  { timestamps: true, autoIndex: false },
);
entrySchema.index(
  { userId: 1, status: 1, occurredOn: -1, _id: -1 },
  { name: 'ledger_user_status_date' },
);
entrySchema.index(
  { userId: 1, status: 1, type: 1, occurredOn: -1, _id: -1 },
  { name: 'ledger_user_type_date' },
);
entrySchema.index(
  { userId: 1, status: 1, type: 1, category: 1, occurredOn: -1, _id: -1 },
  { name: 'ledger_user_category_date' },
);
entrySchema.index({ userId: 1, reference: 1 }, { unique: true, name: 'ledger_reference_unique' });
entrySchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, name: 'ledger_idempotency_unique' },
);

entrySchema.index(
  { userId: 1, status: 1, occurredOn: 1, type: 1, category: 1, amountMinor: 1 },
  { name: 'ledger_dashboard_covering' },
);
export default mongoose.model('Entry', entrySchema);
