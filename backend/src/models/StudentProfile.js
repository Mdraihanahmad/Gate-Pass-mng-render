import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true },
    branch: { type: String, required: true },
    batchYear: { type: Number, required: true },
    qrCodeDataUrl: { type: String }, // generated after approval
  },
  { timestamps: true }
);

export default mongoose.model('StudentProfile', studentProfileSchema);
