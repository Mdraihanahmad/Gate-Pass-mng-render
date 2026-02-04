import User from '../models/User.js';
import Notification from '../models/Notification.js';
import StudentProfile from '../models/StudentProfile.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import crypto from 'crypto';
import { signToken } from '../utils/jwt.js';

// Contract: registrationNo, password, role
export const signup = async (req, res, next) => {
  try {
    const { registrationNo, password, role, name, branch, batchYear } = req.body;
    if (!password || !role) return res.status(400).json({ message: 'Missing fields' });
    // For students, key is registrationNo; for admin/security allow name instead
    let key;
    if (role === 'student') {
      if (!registrationNo) return res.status(400).json({ message: 'registrationNo required' });
      key = { registrationNo };
    } else {
      if (!name) return res.status(400).json({ message: 'name required' });
      key = { registrationNo: registrationNo || name };
    }

    const exists = await User.findOne(key);
    if (exists) return res.status(409).json({ message: 'User already exists' });
    const passwordHash = await hashPassword(password);
  // Admins now require approval as well
  const isApproved = false;
    const payload = {
      registrationNo: key.registrationNo,
      name: role === 'student' ? undefined : name,
      passwordHash,
      role,
      isApproved,
  requestedApproval: role === 'student' || role === 'security' || role === 'admin',
    };
    // Students will get studentUid/pin/QR upon approval
    const user = await User.create(payload);
    let studentProfile = null;
    if (role === 'student') {
      if (!name || !branch || !batchYear) return res.status(400).json({ message: 'Student details required' });
      studentProfile = await StudentProfile.create({ user: user._id, name, branch, batchYear });
      // Notify all approved admins about new student pending approval including name
      try {
        const admins = await User.find({ role: 'admin' });
        const msg = `New student signup awaiting approval: ${name} (${registrationNo})`;
        await Notification.insertMany(admins.map(a => ({ user: a._id, message: msg })));
        // Notify student (self) confirmation with their name
        await Notification.create({ user: user._id, message: `Signup received, ${name}. Awaiting approval.` });
      } catch {}
    }
    const token = signToken({ id: user._id, registrationNo: user.registrationNo, role: user.role });
    res.status(201).json({ token, user: { id: user._id, registrationNo: user.registrationNo, studentUid: user.studentUid, role: user.role, isApproved: user.isApproved, name: studentProfile?.name || user.name } });
  } catch (e) {
    next(e);
  }
};

export const login = async (req, res, next) => {
  try {
    const { registrationNo, name, password } = req.body;
    // Accept either registrationNo or name (for admin/security)
    const query = registrationNo ? { registrationNo } : { name };
    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  // Basic flow: allow login; admins/security are auto-approved, students may be pending
    const token = signToken({ id: user._id, registrationNo: user.registrationNo, role: user.role });
    let studentName = null;
    if (user.role === 'student') {
      try { const prof = await StudentProfile.findOne({ user: user._id }); studentName = prof?.name || null; } catch {}
    }
    res.json({ token, user: { id: user._id, registrationNo: user.registrationNo, role: user.role, isApproved: user.isApproved, name: studentName || user.name } });
  } catch (e) {
    next(e);
  }
};

export const requestSecurityApproval = async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // identifier is name for security
    if (!identifier || !password) return res.status(400).json({ message: 'Missing credentials' });
    const user = await User.findOne({ $or: [{ name: identifier }, { registrationNo: identifier }], role: 'security' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  // Basic flow: auto-approved at signup; keep endpoint for compatibility
  res.json({ message: 'Not required in basic mode' });
  } catch (e) {
    next(e);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json(user);
  } catch (e) {
    next(e);
  }
};

// Allow admins to re-send approval request after decline
export const requestAdminApproval = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    user.requestedApproval = true;
    await user.save();
    res.json({ message: 'Request sent' });
  } catch (e) { next(e); }
};

// Forgot password: generate a short-lived reset token after verifying identity
export const forgotPassword = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role || !['student', 'security'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    let user;
    if (role === 'student') {
      const { registrationNo, pinCode } = req.body || {};
      if (!registrationNo || !pinCode) return res.status(400).json({ message: 'registrationNo and pinCode required' });
      if (!/^\d{6}$/.test(String(pinCode))) return res.status(400).json({ message: 'PIN must be 6 digits' });
      user = await User.findOne({ registrationNo, role: 'student', isApproved: true });
      if (!user) return res.status(404).json({ message: 'User not found or not approved' });
      if (user.pinCode !== pinCode) return res.status(401).json({ message: 'Invalid PIN' });
    } else if (role === 'security') {
      const { registrationNo, name } = req.body || {};
      if (!registrationNo || !name) return res.status(400).json({ message: 'registrationNo and name required' });
      user = await User.findOne({ registrationNo, name, role: 'security', isApproved: true });
      if (!user) return res.status(404).json({ message: 'User not found or not approved' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const exp = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.resetToken = token;
    user.resetTokenExp = exp;
    await user.save();
    // In a real app, send via email/SMS. Here we return token so the UI can proceed.
    res.json({ message: 'Reset token issued', token, expiresAt: exp });
  } catch (e) { next(e); }
};

// Reset password using token
export const resetPassword = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role || !['student', 'security'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const { newPassword, token } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!token) return res.status(400).json({ message: 'Reset token required' });
    let user;
    if (role === 'student') {
      const { registrationNo } = req.body || {};
      if (!registrationNo) return res.status(400).json({ message: 'registrationNo required' });
      user = await User.findOne({ registrationNo, role: 'student' });
    } else if (role === 'security') {
      const { registrationNo, name } = req.body || {};
      if (!registrationNo || !name) return res.status(400).json({ message: 'registrationNo and name required' });
      user = await User.findOne({ registrationNo, name, role: 'security' });
    }
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.resetToken || !user.resetTokenExp) return res.status(400).json({ message: 'No reset requested' });
    if (user.resetToken !== token) return res.status(400).json({ message: 'Invalid token' });
    if (new Date() > new Date(user.resetTokenExp)) return res.status(400).json({ message: 'Token expired' });
    user.passwordHash = await hashPassword(newPassword);
    user.resetToken = undefined;
    user.resetTokenExp = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (e) { next(e); }
};

// Change password for logged-in users (all roles)
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    if (typeof newPassword !== 'string' || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (e) { next(e); }
};
