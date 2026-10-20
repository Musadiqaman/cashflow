import mongoose from 'mongoose';
const { Schema } = mongoose;
const auditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    entryId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, enum: ['create', 'edit', 'void'], required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, autoIndex: false },
);
auditSchema.index({ userId: 1, entryId: 1, createdAt: -1 }, { name: 'audit_user_entry_date' });
export default mongoose.model('AuditEvent', auditSchema);
