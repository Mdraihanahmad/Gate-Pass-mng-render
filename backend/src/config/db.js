import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gatepass';
  try {
  const uriType = uri.startsWith('mongodb+srv://') ? 'atlas' : uri;
  console.log('Connecting to MongoDB:', uriType === 'atlas' ? 'atlas-cluster' : uriType);
    await mongoose.connect(uri, { dbName: uri.split('/').pop() });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err.message);
    process.exit(1);
  }
};
