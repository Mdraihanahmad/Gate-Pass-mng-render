import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';

await connectDB();

const ensureUser = async (registrationNo, role, password = 'password123') => {
  let user = await User.findOne({ registrationNo });
  if (!user) {
    user = await User.create({ registrationNo, role, passwordHash: await hashPassword(password), isApproved: true });
    console.log(`Created ${role}: ${registrationNo} / ${password}`);
  } else {
    console.log(`${role} exists: ${registrationNo}`);
  }
};

await ensureUser('admin001', 'admin');
await ensureUser('sec001', 'security');

process.exit(0);
