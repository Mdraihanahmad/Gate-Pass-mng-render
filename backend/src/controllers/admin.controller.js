import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import Log from '../models/Log.js';
import Visitor from '../models/Visitor.js';
import Notification from '../models/Notification.js';
import { generateQRCodeDataUrl } from '../utils/qrcode.js';
import { purgeOldDataMonths } from '../jobs/retention.js';
import mongoose from 'mongoose';
import Overstay from '../models/Overstay.js';

export const listPendingStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student', isApproved: false, requestedApproval: true }).lean();
    const profiles = await StudentProfile.find({ user: { $in: students.map((s) => s._id) } }).lean();
    const map = new Map(profiles.map((p) => [String(p.user), p]));
    const result = students.map((s) => {
      const prof = map.get(String(s._id));
      return {
        id: s._id,
        registrationNo: s.registrationNo,
        name: prof?.name,
        branch: prof?.branch,
        batchYear: prof?.batchYear,
      };
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

// Basic flow: only students require approval; security/admins are auto-approved at signup

export const approveStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'student') return res.status(404).json({ message: 'Student not found' });
  user.isApproved = true;
    user.requestedApproval = false;
  user.approvedAt = new Date();
    if (!user.studentUid) {
      user.studentUid = `STU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }
    // Generate a unique 6-digit pin code if missing
    if (!user.pinCode) {
      for (let i = 0; i < 10; i++) {
        const candidate = Math.floor(100000 + Math.random() * 900000).toString();
        const exists = await User.exists({ pinCode: candidate });
        if (!exists) { user.pinCode = candidate; break; }
      }
    }
  // If a profile photo was uploaded during draft stage, lock it now
  if (user.profilePhotoUrl) user.profilePhotoLocked = true;
  await user.save();
  const profile = await StudentProfile.findOne({ user: user._id });
  // Use a compact payload for faster scanning: plain SID string
  const qrPayload = user.studentUid;
    profile.qrCodeDataUrl = await generateQRCodeDataUrl(qrPayload);
  await profile.save();
  res.json({ message: 'Approved', userId: user._id, pinCode: user.pinCode });
  } catch (e) {
    next(e);
  }
};

export const batchApproveStudents = async (req, res, next) => {
  try {
    const { batchYear, branch } = req.body || {};
    let pending = await User.find({ role: 'student', isApproved: false, requestedApproval: true }).lean();
    if (batchYear || branch) {
      const profileFilter = { user: { $in: pending.map(u => u._id) } };
      if (batchYear) profileFilter.batchYear = Number(batchYear);
      if (branch) profileFilter.branch = branch;
      const profiles = await StudentProfile.find(profileFilter).select('user').lean();
      const allowed = new Set(profiles.map(p => String(p.user)));
      pending = pending.filter(u => allowed.has(String(u._id)));
    }
    if (pending.length === 0) return res.json({ message: 'No pending students', approved: 0 });
    let approved = 0;
    for (const s of pending) {
      const user = await User.findById(s._id);
      if (!user) continue;
  user.isApproved = true;
      if (!user.studentUid) {
  user.approvedAt = new Date();
        user.studentUid = `STU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      }
      if (!user.pinCode) {
        for (let i = 0; i < 10; i++) {
          const candidate = Math.floor(100000 + Math.random() * 900000).toString();
          const exists = await User.exists({ pinCode: candidate });
          if (!exists) { user.pinCode = candidate; break; }
        }
      }
      await user.save();
      const profile = await StudentProfile.findOne({ user: user._id });
      if (profile) {
        // Compact payload (plain SID)
        const qrPayload = user.studentUid;
        profile.qrCodeDataUrl = await generateQRCodeDataUrl(qrPayload);
        await profile.save();
      }
      approved += 1;
    }
    res.json({ message: 'Batch approved', approved });
  } catch (e) { next(e); }
};

export const batchDeclineStudents = async (req, res, next) => {
  try {
    const { batchYear, branch } = req.body || {};
    let pending = await User.find({ role: 'student', isApproved: false, requestedApproval: true }).lean();
    if (batchYear || branch) {
      const profileFilter = { user: { $in: pending.map(u => u._id) } };
      if (batchYear) profileFilter.batchYear = Number(batchYear);
      if (branch) profileFilter.branch = branch;
      const profiles = await StudentProfile.find(profileFilter).select('user').lean();
      const allowed = new Set(profiles.map(p => String(p.user)));
      pending = pending.filter(u => allowed.has(String(u._id)));
    }
    if (pending.length === 0) return res.json({ message: 'No pending students', declined: 0 });
    const ids = pending.map(u => u._id);
    const result = await User.updateMany({ _id: { $in: ids } }, { $set: { isApproved: false, requestedApproval: false } });
    res.json({ message: 'Batch declined', declined: result.modifiedCount || 0 });
  } catch (e) { next(e); }
};

export const listPendingSecurity = async (req, res, next) => {
  try {
    const items = await User.find({ role: 'security', isApproved: false, requestedApproval: true }).lean();
    res.json(items.map((u) => ({ id: u._id, name: u.name, registrationNo: u.registrationNo })));
  } catch (e) { next(e); }
};

export const approveSecurity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'security') return res.status(404).json({ message: 'Security user not found' });
    user.isApproved = true;
    user.requestedApproval = false;
    await user.save();
    res.json({ message: 'Approved', userId: user._id });
  } catch (e) { next(e); }
};

export const declineStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'student') return res.status(404).json({ message: 'Student not found' });
    // Decline: keep account but reset approval request
    user.isApproved = false;
    user.requestedApproval = false;
    await user.save();
    res.json({ message: 'Declined', userId: user._id });
  } catch (e) {
    next(e);
  }
};

// No decline endpoints for admin/security in basic flow
export const declineSecurity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'security') return res.status(404).json({ message: 'Security user not found' });
    user.isApproved = false;
    user.requestedApproval = false;
    await user.save();
    res.json({ message: 'Declined', userId: user._id });
  } catch (e) { next(e); }
};

export const listStudents = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'student', isApproved: true }).lean();
    const profiles = await StudentProfile.find({ user: { $in: users.map((u) => u._id) } }).lean();
    const map = new Map(profiles.map((p) => [String(p.user), p]));
    const result = users.map((u) => ({
      id: u._id,
  registrationNo: u.registrationNo,
      name: map.get(String(u._id))?.name,
      branch: map.get(String(u._id))?.branch,
      batchYear: map.get(String(u._id))?.batchYear,
      qrCodeDataUrl: map.get(String(u._id))?.qrCodeDataUrl,
    }));
    res.json(result);
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

export const listVisitors = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const q = {};
    if (from || to) q.entryTime = {};
    if (from) q.entryTime.$gte = new Date(from);
    if (to) q.entryTime.$lte = new Date(to);
    const visitors = await Visitor.find(q).sort({ entryTime: -1 }).lean();
    res.json(visitors);
  } catch (e) {
    next(e);
  }
};

// Admin approval workflow
export const listPendingAdmins = async (req, res, next) => {
  try {
    const items = await User.find({ role: 'admin', isApproved: false, requestedApproval: true }).lean();
    res.json(items.map((u) => ({ id: u._id, name: u.name, registrationNo: u.registrationNo })));
  } catch (e) { next(e); }
};

export const approveAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') return res.status(404).json({ message: 'Admin user not found' });
    user.isApproved = true;
    user.requestedApproval = false;
    await user.save();
    res.json({ message: 'Approved', userId: user._id });
  } catch (e) { next(e); }
};

export const declineAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') return res.status(404).json({ message: 'Admin user not found' });
    user.isApproved = false;
    user.requestedApproval = false;
    await user.save();
    res.json({ message: 'Declined', userId: user._id });
  } catch (e) { next(e); }
};

export const deleteStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'student') return res.status(404).json({ message: 'Student not found' });
    const registrationNo = user.registrationNo;
    await Promise.all([
      StudentProfile.deleteOne({ user: user._id }),
      Log.deleteMany({ registrationNo }),
      Overstay.deleteMany({ registrationNo }),
      Notification.deleteMany({ user: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    // Deleting the user removes their pinCode and studentUid; deleting the profile removes stored QR image.
    // Existing printed/old QR or PIN will no longer work because the user no longer exists.
    res.json({ message: 'Deleted (PIN and QR invalidated)', userId });
  } catch (e) {
    next(e);
  }
};

export const deleteAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') return res.status(404).json({ message: 'Admin user not found' });
    await Notification.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Deleted', userId });
  } catch (e) {
    next(e);
  }
};

export const deleteSecurity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || user.role !== 'security') return res.status(404).json({ message: 'Security user not found' });
    // Remove all notifications for this user and any visitor logs created by this user
    await Promise.all([
      Notification.deleteMany({ user: user._id }),
      Visitor.deleteMany({ createdBy: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Deleted', userId });
  } catch (e) {
    next(e);
  }
};

export const deleteStudentsBatch = async (req, res, next) => {
  try {
    const { batchYear, branch } = req.body;
    if (!batchYear) return res.status(400).json({ message: 'batchYear required' });
    const profileQuery = { batchYear: Number(batchYear) };
    if (branch) profileQuery.branch = branch;
    const profiles = await StudentProfile.find(profileQuery).select('user');
    const userIds = profiles.map((p) => p.user);
    if (userIds.length === 0) return res.json({ message: 'No students matched', deleted: 0 });
    const users = await User.find({ _id: { $in: userIds }, role: 'student' }).select('_id registrationNo');
    const regNos = users.map((u) => u.registrationNo);
    await Promise.all([
      StudentProfile.deleteMany({ user: { $in: userIds } }),
      Log.deleteMany({ registrationNo: { $in: regNos } }),
      Overstay.deleteMany({ registrationNo: { $in: regNos } }),
      Notification.deleteMany({ user: { $in: userIds } }),
      User.deleteMany({ _id: { $in: userIds }, role: 'student' }),
    ]);
    res.json({ message: 'Batch deleted (PINs and QR invalidated)', deleted: userIds.length });
  } catch (e) {
    next(e);
  }
};

export const getUserCounts = async (req, res, next) => {
  try {
    const approvedOnly = String(req.query.approvedOnly || '').toLowerCase() === 'true';
    const base = approvedOnly ? { isApproved: true } : {};
    const [students, security, admins] = await Promise.all([
      User.countDocuments({ ...base, role: 'student' }),
      User.countDocuments({ ...base, role: 'security' }),
      User.countDocuments({ ...base, role: 'admin' }),
    ]);
    res.json({ students, security, admins, approvedOnly });
  } catch (e) { next(e); }
};

// Generic list users by role (with optional approvedOnly)
export const listUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const approvedOnly = String(req.query.approvedOnly || '').toLowerCase() === 'true';
    if (!role || !['student', 'security', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid or missing role' });
    }
    const filter = { role };
    if (approvedOnly) filter.isApproved = true;

    const users = await User.find(filter).lean();
    if (role === 'student') {
      const profiles = await StudentProfile.find({ user: { $in: users.map(u => u._id) } }).lean();
      const pmap = new Map(profiles.map(p => [String(p.user), p]));
      const result = users.map(u => ({
        id: u._id,
        registrationNo: u.registrationNo,
        name: pmap.get(String(u._id))?.name || u.name,
        branch: pmap.get(String(u._id))?.branch,
        batchYear: pmap.get(String(u._id))?.batchYear,
        isApproved: u.isApproved,
        requestedApproval: u.requestedApproval,
      }));
      return res.json(result);
    }
    // security/admin list
    const result = users.map(u => ({
      id: u._id,
      registrationNo: u.registrationNo,
      name: u.name,
      isApproved: u.isApproved,
      requestedApproval: u.requestedApproval,
    }));
    return res.json(result);
  } catch (e) { next(e); }
};

// Permanently delete logs and visitors older than 6 months (or a provided cutoff)
export const purgeOldData = async (req, res, next) => {
  try {
    const months = Number(req.body?.months || 3);
    const before = req.body?.before;
    const result = await purgeOldDataMonths(months, before);
    res.json({ message: 'Purge complete', ...result, months });
  } catch (e) { next(e); }
};

// Search approved students by registration number or name (partial, case-insensitive)
export const searchStudents = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    // Find matches by reg no
    const usersByReg = await User.find({ role: 'student', isApproved: true, registrationNo: re }).select('_id registrationNo').lean();
    const userIds = usersByReg.map(u => u._id);
    // Find matches by name in profiles
    const profilesByName = await StudentProfile.find({ name: re }).select('user name branch batchYear qrCodeDataUrl').lean();
    const allUserIds = Array.from(new Set([...userIds, ...profilesByName.map(p => p.user)]));
    if (allUserIds.length === 0) return res.json([]);
    const users = await User.find({ _id: { $in: allUserIds }, role: 'student', isApproved: true }).select('_id registrationNo').lean();
    const uMap = new Map(users.map(u => [String(u._id), u]));
    const profiles = await StudentProfile.find({ user: { $in: allUserIds } }).lean();
    const result = profiles
      .filter(p => uMap.has(String(p.user)))
      .map(p => ({
        id: String(p.user),
        registrationNo: uMap.get(String(p.user)).registrationNo,
        name: p.name,
        branch: p.branch,
        batchYear: p.batchYear,
        qrCodeDataUrl: p.qrCodeDataUrl || null,
      }))
      .filter(item => re.test(item.registrationNo) || re.test(item.name || ''))
      .sort((a, b) => (a.registrationNo || '').localeCompare(b.registrationNo || ''));
    res.json(result);
  } catch (e) { next(e); }
};

// Get full student details (profile + all logs) by registration number
export const getStudentDetails = async (req, res, next) => {
  try {
    const { registrationNo } = req.params;
    const user = await User.findOne({ role: 'student', isApproved: true, registrationNo }).lean();
    if (!user) return res.status(404).json({ message: 'Student not found' });
    const profile = await StudentProfile.findOne({ user: user._id }).lean();
    const logs = await Log.find({ registrationNo }).sort({ timestamp: -1 }).lean();
    const student = {
      id: String(user._id),
      registrationNo: user.registrationNo,
      name: profile?.name || user.name || null,
      branch: profile?.branch || null,
      batchYear: profile?.batchYear || null,
      profilePhotoUrl: user.profilePhotoUrl || null,
      qrCodeDataUrl: profile?.qrCodeDataUrl || null,
      studentUid: user.studentUid || null,
      pinCode: user.pinCode || null,
    };
    res.json({ student, logs });
  } catch (e) { next(e); }
};

// List overstay records for admins; optionally trigger a fresh detection
export const listOverstays = async (req, res, next) => {
  try {
    const refresh = String(req.query.refresh || '').toLowerCase() === 'true';
    // Enforce minimum hours threshold for display (default 6h)
    const minHours = Number.isFinite(Number(req.query.minHours)) ? Number(req.query.minHours) : 6;
    if (refresh) {
      // Full rescan across all logs to ensure all currently-open overstays are present
      await rescanAllOpenOverstays(minHours);
    }
    const resolved = req.query.resolved;
  const from = req.query.from;
  const to = req.query.to;
  const q = {};
    if (typeof resolved !== 'undefined') {
      q.resolved = String(resolved) === 'true';
    } else {
      // By default, show only currently open overstays
      q.resolved = false;
    }
    const now = new Date();
    const cutoff = new Date(now.getTime() - minHours * 3600_000);
    // Include any record that currently qualifies as overstay:
    // - Either it was flagged with >= minHours at the time, or
    // - Its checkout time is older than the cutoff (i.e., currently over minHours)
    const hoursFilter = {
      $or: [
        { hoursOutsideAtFlag: { $gte: minHours } },
        { checkOutTime: { $lte: cutoff } },
      ],
    };
  const timeFilter = {};
  if (from || to) timeFilter.flaggedAt = {};
  if (from) timeFilter.flaggedAt.$gte = new Date(from);
  if (to) timeFilter.flaggedAt.$lte = new Date(to);
  const items = await Overstay.find({ ...q, ...hoursFilter, ...timeFilter }).sort({ flaggedAt: -1 }).lean();
    // Ensure student details are present/updated
    try {
      const regNos = Array.from(new Set(items.map(i => i.registrationNo).filter(Boolean)));
      if (regNos.length) {
        const users = await User.find({ role: 'student', registrationNo: { $in: regNos } }).select('_id registrationNo').lean();
        const uMap = new Map(users.map(u => [u.registrationNo, u]));
        const profiles = await StudentProfile.find({ user: { $in: users.map(u => u._id) } }).select('user name branch batchYear').lean();
        const pMap = new Map(profiles.map(p => [String(p.user), p]));
        for (const it of items) {
          const u = uMap.get(it.registrationNo);
          if (u) {
            const p = pMap.get(String(u._id));
            if (p) {
              it.name = it.name || p.name || null;
              it.branch = it.branch || p.branch || null;
              it.batchYear = it.batchYear || p.batchYear || null;
            }
          }
        }
      }
    } catch {}

    // Compute a user-friendly duration in hours for display
    // - For open overstays: hours outside = now - checkOutTime
    // - For resolved overstays: hours outside = (checkInTime || resolvedAt || flaggedAt) - checkOutTime
    // Rounded to 1 decimal place
    const nowForCalc = new Date();
    for (const it of items) {
      try {
        const outAt = it.checkOutTime ? new Date(it.checkOutTime) : null;
        if (!outAt || isNaN(outAt)) {
          it.durationHours = typeof it.hoursOutsideAtFlag === 'number' ? it.hoursOutsideAtFlag : 0;
          continue;
        }
        const end = it.resolved
          ? (it.checkInTime ? new Date(it.checkInTime) : (it.resolvedAt ? new Date(it.resolvedAt) : (it.flaggedAt ? new Date(it.flaggedAt) : nowForCalc)))
          : nowForCalc;
        const diffMs = Math.max(0, end.getTime() - outAt.getTime());
        it.durationHours = Math.round((diffMs / 3600_000) * 10) / 10;
      } catch {
        it.durationHours = typeof it.hoursOutsideAtFlag === 'number' ? it.hoursOutsideAtFlag : 0;
      }
    }
    res.json(items);
  } catch (e) { next(e); }
};

// Optionally allow admin to mark an overstay as resolved manually
export const resolveOverstay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const o = await Overstay.findById(id);
    if (!o) return res.status(404).json({ message: 'Not found' });
    if (!o.resolved) {
      o.resolved = true;
      o.resolvedAt = new Date();
      await o.save();
    }
    res.json({ message: 'Resolved', id: o._id });
  } catch (e) { next(e); }
};

// Helper: rescan all logs to find students currently outside longer than minHours and upsert Overstay docs
async function rescanAllOpenOverstays(minHours = 6) {
  const now = new Date();
  const thresholdMs = minHours * 3600_000;
  // Get the last event per student efficiently
  const lastEvents = await Log.aggregate([
    { $sort: { registrationNo: 1, timestamp: -1 } },
    { $group: { _id: '$registrationNo', last: { $first: '$$ROOT' } } },
  ]);
  for (const e of lastEvents) {
    const last = e.last;
    if (!last || last.action !== 'check-out') continue;
    const outAt = new Date(last.checkOutTime || last.timestamp);
    if (!outAt || isNaN(outAt)) continue;
    const diff = now.getTime() - outAt.getTime();
    if (diff < thresholdMs) continue;
    // If already resolved by a later check-in, last action wouldn't be check-out. So we're safe.
    const existing = await Overstay.findOne({ registrationNo: last.registrationNo, checkOutTime: outAt });
    if (!existing) {
      await Overstay.create({
        registrationNo: last.registrationNo,
        name: last.name || null,
        branch: last.branch || null,
        batchYear: last.batchYear || null,
        purpose: last.purpose || null,
        checkOutTime: outAt,
        flaggedAt: now,
        hoursOutsideAtFlag: Math.round((diff / 3600_000) * 10) / 10,
        resolved: false,
      });
    }
  }
}
