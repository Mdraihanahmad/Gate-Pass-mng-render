import mongoose from 'mongoose';

const overstaySchema = new mongoose.Schema(
  {
    registrationNo: { type: String, index: true, required: true },
    name: { type: String },
    branch: { type: String },
    batchYear: { type: Number },
    purpose: { type: String, default: null },
    // The checkout time that led to overstay
    checkOutTime: { type: Date, required: true },
    // When we detected the overstay
    flaggedAt: { type: Date, default: Date.now },
    // Duration in hours at time of flagging (approx)
    hoursOutsideAtFlag: { type: Number },
    // Resolution fields
    resolved: { type: Boolean, default: false },
    checkInTime: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    // Avoid duplicate notifications
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One overstay per student checkout event
overstaySchema.index({ registrationNo: 1, checkOutTime: 1 }, { unique: true });

// Helpful indexes for admin listing and filtering
overstaySchema.index({ resolved: 1, flaggedAt: -1 });
overstaySchema.index({ flaggedAt: -1 });

export default mongoose.model('Overstay', overstaySchema);
