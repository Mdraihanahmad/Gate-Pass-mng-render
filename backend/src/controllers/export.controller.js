import Log from '../models/Log.js';
import Visitor from '../models/Visitor.js';
import Overstay from '../models/Overstay.js';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import { buildPdfStream, buildDocxBuffer } from '../utils/exporter.js';

// Ensure server-side exports use a consistent local timezone instead of UTC (Vercel default)
const TIMEZONE = process.env.TIMEZONE || process.env.TZ || 'Asia/Kolkata';
const LOCALE = process.env.LOCALE || 'en-IN';
const formatDT = (value) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
      timeZone: TIMEZONE,
    }).format(new Date(value));
  } catch {
    // Fallback if Intl or timezone not available
    return new Date(value).toLocaleString(LOCALE);
  }
};

const fetchData = async (type, from, to, extra = {}) => {
  const q = {};
  if (from || to) q.timestamp = {};
  if (from) q.timestamp.$gte = new Date(from);
  if (to) q.timestamp.$lte = new Date(to);
  if (type === 'overstays') {
    const oq = {};
    // Filter by flaggedAt window (when the overstay was detected)
    if (from || to) oq.flaggedAt = {};
    if (from) oq.flaggedAt.$gte = new Date(from);
    if (to) oq.flaggedAt.$lte = new Date(to);
    const items = await Overstay.find(oq).sort({ flaggedAt: -1 }).lean();
    const headers = ['Reg No', 'Name', 'Branch', 'Batch', 'Purpose', 'Checked-out', 'Flagged', 'Hours at flag', 'Status'];
    const rows = items.map((i) => [
      i.registrationNo,
      i.name,
      i.branch || '-',
      i.batchYear || '-',
      i.purpose || '-',
      i.checkOutTime ? formatDT(i.checkOutTime) : '-',
      i.flaggedAt ? formatDT(i.flaggedAt) : '-',
      typeof i.hoursOutsideAtFlag === 'number' ? i.hoursOutsideAtFlag : '-',
      i.resolved ? (i.checkInTime ? `Resolved at ${formatDT(i.checkInTime)}` : 'Resolved') : 'Open',
    ]);
    return { headers, rows, title: 'Overstay Alerts' };
  }
  if (type === 'visitors') {
    const vq = {};
    if (from || to) vq.entryTime = {};
    if (from) vq.entryTime.$gte = new Date(from);
    if (to) vq.entryTime.$lte = new Date(to);
    const items = await Visitor.find(vq).sort({ entryTime: -1 }).lean();
    const headers = ['Name', 'Vehicle', 'Purpose', 'Entry', 'Exit'];
    const rows = items.map((i) => [
      i.name,
      i.vehicleNo || '-',
      i.purpose,
      formatDT(i.entryTime),
      i.exitTime ? formatDT(i.exitTime) : '-',
    ]);
    return { headers, rows, title: 'Visitor Logs' };
  }
  if (type === 'student-details') {
    const { batchYear, branch } = extra;
    const users = await User.find({ role: 'student', isApproved: true }).lean();
    const userIds = users.map(u => u._id);
    const profileQuery = { user: { $in: userIds } };
    if (batchYear) profileQuery.batchYear = Number(batchYear);
    if (branch) profileQuery.branch = branch;
    const profiles = await StudentProfile.find(profileQuery).lean();
    const uMap = new Map(users.map(u => [String(u._id), u]));
    const rows = profiles.map(p => {
      const u = uMap.get(String(p.user));
      return [
        u?.registrationNo || '',
        p.name || '',
        p.branch || '',
        p.batchYear || '',
        u?.pinCode || '',
        u?.studentUid || '',
      ];
    });
    const headers = ['Reg No', 'Name', 'Branch', 'Batch', 'PIN', 'SID'];
    return { headers, rows, title: 'Student Details' };
  }
  const logQuery = { ...q };
  if (extra.action && ['check-in', 'check-out'].includes(extra.action)) {
    logQuery.action = extra.action;
  }
  const items = await Log.find(logQuery).sort({ timestamp: -1 }).lean();
  const headers = ['Reg No', 'Name', 'Branch', 'Batch', 'Action', 'Purpose', 'Check-in', 'Check-out'];
  const rows = items.map((i) => [
    i.registrationNo,
    i.name,
    i.branch,
    i.batchYear,
    i.action,
    i.purpose || '-',
    i.checkInTime ? formatDT(i.checkInTime) : '-',
    i.checkOutTime ? formatDT(i.checkOutTime) : '-',
  ]);
  return { headers, rows, title: 'Student Logs' };
};

export const exportPdf = async (req, res, next) => {
  try {
  const { type = 'students', from, to, batchYear, branch, action } = req.query;
  const { headers, rows, title } = await fetchData(type, from, to, { batchYear, branch, action });
    const pdfStream = buildPdfStream(title, headers, rows);
    res.setHeader('Content-Type', 'application/pdf');
  const filename = type === 'student-details' ? 'student-details.pdf' : `${type}-logs.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    pdfStream.pipe(res);
  } catch (e) {
    next(e);
  }
};

export const exportDocx = async (req, res, next) => {
  try {
  const { type = 'students', from, to, batchYear, branch, action } = req.query;
  const { headers, rows, title } = await fetchData(type, from, to, { batchYear, branch, action });
    const buffer = await buildDocxBuffer(title, headers, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const filename = type === 'student-details' ? 'student-details.docx' : `${type}-logs.docx`;
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.end(buffer);
  } catch (e) {
    next(e);
  }
};
