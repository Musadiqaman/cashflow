import mongoose from 'mongoose';
const { Schema } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    currency: { type: String, enum: ['PKR', 'USD', 'AED', 'GBP', 'EUR', 'INR'], default: 'PKR' },
    timezone: { type: String, default: 'Asia/Karachi' },
    authVersion: { type: Number, default: 0 },
  },
  { timestamps: true, autoIndex: false },
);
userSchema.index({ email: 1 }, { unique: true, name: 'user_email_unique' });
export default mongoose.model('User', userSchema);
