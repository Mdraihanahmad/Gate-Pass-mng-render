import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gatepass';
  try {
  const uriType = uri.startsWith('mongodb+srv://') ? 'atlas' : uri;
  console.log('Connecting to MongoDB:', uriType === 'atlas' ? 'atlas-cluster' : uriType);
    const explicitDbName = (process.env.MONGODB_DBNAME || '').trim();
    let dbName = explicitDbName;
    if (!dbName) {
      // Extract db name from URI path; ignore query string. If none, fall back.
      const afterSlash = uri.split('/').slice(3).join('/');
      const pathPart = (afterSlash || '').split('?')[0];
      const firstSegment = (pathPart || '').split('/')[0];
      dbName = firstSegment || 'gatepass';
    }
    await mongoose.connect(uri, { dbName });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err.message);
    process.exit(1);
  }
};
