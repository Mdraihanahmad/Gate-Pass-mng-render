import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import Log from '../models/Log.js';
import Notification from '../models/Notification.js';
import cloudinary from '../config/cloudinary.js';
import Overstay from '../models/Overstay.js';

const getStudentByRegistration = async (sid, pinCode) => {
  const query = sid ? { studentUid: sid } : { pinCode };
  const user = await User.findOne({ ...query, role: 'student', isApproved: true });
  if (!user) return null;
  const profile = await StudentProfile.findOne({ user: user._id });
  return { user, profile };
};

export const scanQr = async (req, res, next) => {
  try {
  const { sid, action, purpose, pinCode, clientTimestamp } = req.body; // sid parsed from QR or 6-digit pin
  if ((!sid && !pinCode) || !['check-in', 'check-out'].includes(action))
      return res.status(400).json({ message: 'Invalid payload' });
  if (!sid && pinCode && !/^\d{6}$/.test(String(pinCode))) {
    return res.status(400).json({ message: 'PIN must be 6 digits' });
  }
  const usingPin = !sid && !!pinCode;
  const data = await getStudentByRegistration(sid, pinCode);
  if (!data) {
      return res.status(404).json({ message: usingPin ? 'Wrong PIN' : 'Student not found or not approved' });
  }
  const { user, profile } = data;
    // Enforce 30s cooldown for the same student
    const last = await Log.findOne({ registrationNo: user.registrationNo }).sort({ timestamp: -1 }).lean();
    const now = clientTimestamp ? new Date(clientTimestamp) : new Date();
    if (last) {
      const diffMs = now.getTime() - new Date(last.timestamp).getTime();
      const windowMs = 30 * 1000;
      if (diffMs < windowMs) {
        const remain = Math.ceil((windowMs - diffMs) / 1000);
        return res.status(429).json({ message: `This student was just processed. Try again in ${remain}s` });
      }
    }
    const log = await Log.create({
      registrationNo: user.registrationNo,
      name: profile.name,
      branch: profile.branch,
      batchYear: profile.batchYear,
      purpose: purpose || null,
      action,
      timestamp: now,
      checkInTime: action === 'check-in' ? now : undefined,
      checkOutTime: action === 'check-out' ? now : undefined,
      recordedBy: 'security',
    });
    // If this is a check-in, resolve any open overstay for this student
    if (action === 'check-in') {
      await Overstay.updateMany(
        { registrationNo: user.registrationNo, resolved: false },
        { $set: { resolved: true, checkInTime: now, resolvedAt: now } }
      );
    }
  await Notification.create({ user: user._id, message: `${action} recorded at ${new Date(log.timestamp).toLocaleString()}` });
    // Return student summary so UI can show photo and details
    const thumb = user.profilePhotoPublicId
      ? cloudinary.url(user.profilePhotoPublicId, {
          width: 256,
          height: 256,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
        })
      : (user.profilePhotoUrl || null);
    const student = {
      registrationNo: user.registrationNo,
      name: profile.name,
      branch: profile.branch,
      batchYear: profile.batchYear,
      profilePhotoUrl: user.profilePhotoUrl || null,
      profilePhotoThumbUrl: thumb,
      pinCode: user.pinCode || null,
      studentUid: user.studentUid || null,
    };
    res.json({ message: 'Logged', log, student });
  } catch (e) {
    next(e);
  }
};

export const manualEntry = async (req, res, next) => {
  try {
  const { sid, action, purpose, pinCode, clientTimestamp } = req.body; // accepts 6-digit pin as fallback
  if ((!sid && !pinCode) || !['check-in', 'check-out'].includes(action))
      return res.status(400).json({ message: 'Invalid payload' });
  if (!sid && pinCode && !/^\d{6}$/.test(String(pinCode))) {
    return res.status(400).json({ message: 'PIN must be 6 digits' });
  }
  const usingPin = !sid && !!pinCode;
  const data = await getStudentByRegistration(sid, pinCode);
  if (!data) {
      return res.status(404).json({ message: usingPin ? 'Wrong PIN' : 'Student not found or not approved' });
  }
  const { user, profile } = data;
    // Enforce 30s cooldown for the same student
    const last = await Log.findOne({ registrationNo: user.registrationNo }).sort({ timestamp: -1 }).lean();
    const now = clientTimestamp ? new Date(clientTimestamp) : new Date();
    if (last) {
      const diffMs = now.getTime() - new Date(last.timestamp).getTime();
      const windowMs = 30 * 1000;
      if (diffMs < windowMs) {
        const remain = Math.ceil((windowMs - diffMs) / 1000);
        return res.status(429).json({ message: `This student was just processed. Try again in ${remain}s` });
      }
    }
    const log = await Log.create({
      registrationNo: user.registrationNo,
      name: profile.name,
      branch: profile.branch,
      batchYear: profile.batchYear,
      purpose: purpose || null,
      action,
      timestamp: now,
      checkInTime: action === 'check-in' ? now : undefined,
      checkOutTime: action === 'check-out' ? now : undefined,
      recordedBy: 'security',
    });
    if (action === 'check-in') {
      await Overstay.updateMany(
        { registrationNo: user.registrationNo, resolved: false },
        { $set: { resolved: true, checkInTime: now, resolvedAt: now } }
      );
    }
  await Notification.create({ user: user._id, message: `${action} recorded at ${new Date(log.timestamp).toLocaleString()}` });
    const thumb2 = user.profilePhotoPublicId
      ? cloudinary.url(user.profilePhotoPublicId, {
          width: 256,
          height: 256,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
        })
      : (user.profilePhotoUrl || null);
    const student = {
      registrationNo: user.registrationNo,
      name: profile.name,
      branch: profile.branch,
      batchYear: profile.batchYear,
      profilePhotoUrl: user.profilePhotoUrl || null,
      profilePhotoThumbUrl: thumb2,
      pinCode: user.pinCode || null,
      studentUid: user.studentUid || null,
    };
    res.json({ message: 'Logged', log, student });
  } catch (e) {
    next(e);
  }
};

export const listLogs = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const q = {};
    if (from || to) q.timestamp = {};
    if (from) q.timestamp.$gte = new Date(from);
    if (to) q.timestamp.$lte = new Date(to);
    const logs = await Log.find(q).sort({ timestamp: -1 }).lean();
    res.json(logs);
  } catch (e) {
    next(e);
  }
};

export const requestApproval = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'security') return res.status(403).json({ message: 'Forbidden' });
    if (user.isApproved) return res.status(400).json({ message: 'Already approved' });
    if (user.requestedApproval) return res.json({ message: 'Already requested' });
    user.requestedApproval = true;
    await user.save();
    res.json({ message: 'Approval request sent' });
  } catch (e) {
    next(e);
  }
};
