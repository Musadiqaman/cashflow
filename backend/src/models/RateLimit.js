import mongoose from 'mongoose';
const { Schema } = mongoose;
const rateSchema = new Schema(
  { _id: String, count: { type: Number, default: 0 }, expiresAt: { type: Date, required: true } },
  { versionKey: false, autoIndex: false },
);
rateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_expiry_ttl' });
export default mongoose.model('RateBucket', rateSchema);
