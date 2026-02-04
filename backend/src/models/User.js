import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    registrationNo: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  // Optional name for non-student accounts (e.g., admin, security)
  name: { type: String },
  // Unique student id used in QR codes
  studentUid: { type: String, unique: true, sparse: true, index: true },
  // 6-digit fallback PIN for check-in/out
  pinCode: { type: String, unique: true, sparse: true },
  // Profile photo (Cloudinary)
  profilePhotoUrl: { type: String, default: null },
  profilePhotoPublicId: { type: String, default: null },
  // Once a student sets their profile photo the first time, lock further changes
  profilePhotoLocked: { type: Boolean, default: false },
  // Password reset fields
  resetToken: { type: String, index: true, sparse: true },
  resetTokenExp: { type: Date },
  // Approval lifecycle timestamps (for students)
  approvalRequestedAt: { type: Date, default: null, index: true },
  approvedAt: { type: Date, default: null, index: true },
  role: { type: String, enum: ['admin', 'student', 'security'], required: true },
  isApproved: { type: Boolean, default: false }, // for students
  requestedApproval: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
