import mongoose from 'mongoose';
const { Schema } = mongoose;
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true },
    authVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, autoIndex: false },
);
sessionSchema.index({ tokenHash: 1 }, { unique: true, name: 'session_token_unique' });
sessionSchema.index({ userId: 1 }, { name: 'session_user' });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'session_expiry_ttl' });
export default mongoose.model('Session', sessionSchema);
