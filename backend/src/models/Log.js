import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    registrationNo: { type: String, index: true },
    name: String,
    branch: String,
    batchYear: Number,
  purpose: { type: String },
    action: { type: String, enum: ['check-in', 'check-out'], required: true },
  timestamp: { type: Date, default: Date.now },
  // New explicit columns for check-in and check-out times
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
    recordedBy: { type: String, enum: ['security', 'system'], default: 'security' },
  },
  { timestamps: true }
);

// Indexes to speed up retention purges and date range queries
logSchema.index({ timestamp: 1 });
logSchema.index({ checkInTime: 1 });
logSchema.index({ checkOutTime: 1 });
// TTL index to auto-delete logs permanently after ~90 days (~3 months)
// Note: TTL uses createdAt; MongoDB purges in background, not exact to the second
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model('Log', logSchema);
