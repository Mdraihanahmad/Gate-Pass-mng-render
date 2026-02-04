import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    vehicleNo: { type: String },
    purpose: { type: String, required: true },
    entryTime: { type: Date, default: Date.now },
    exitTime: { type: Date },
    // Optional photo of the visitor (Cloudinary)
    photoUrl: { type: String, default: null },
    photoPublicId: { type: String, default: null },
    // Optional multiple photos (Cloudinary) (max 3 by API)
    photos: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
        },
      ],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // security user
  },
  { timestamps: true }
);

// Indexes for efficient retention and range queries
visitorSchema.index({ entryTime: 1 });
visitorSchema.index({ exitTime: 1 });
visitorSchema.index({ createdAt: 1 });

export default mongoose.model('Visitor', visitorSchema);
