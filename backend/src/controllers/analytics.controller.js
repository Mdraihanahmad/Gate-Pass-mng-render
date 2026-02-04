import Log from '../models/Log.js';
import Overstay from '../models/Overstay.js';
import User from '../models/User.js';

// Helper to parse date range
function parseRange(req) {
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  return { from, to };
}

export const exitsByHour = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = { action: 'check-out' };
    if (from || to) match.timestamp = {};
    if (from) match.timestamp.$gte = from;
    if (to) match.timestamp.$lte = to;
    const data = await Log.aggregate([
      { $match: match },
      { $project: { hour: { $hour: '$timestamp' } } },
      { $group: { _id: '$hour', count: { $sum: 1 } } },
      { $project: { hour: '$_id', count: 1, _id: 0 } },
      { $sort: { hour: 1 } },
    ]);
    res.json(data);
  } catch (e) { next(e); }
};

export const exitsByDay = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = { action: 'check-out' };
    if (from || to) match.timestamp = {};
    if (from) match.timestamp.$gte = from;
    if (to) match.timestamp.$lte = to;
    const data = await Log.aggregate([
      { $match: match },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } } } },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $project: { day: '$_id', count: 1, _id: 0 } },
      { $sort: { day: 1 } },
    ]);
    res.json(data);
  } catch (e) { next(e); }
};

export const avgOutsideDuration = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = {};
    if (from || to) match.checkOutTime = {};
    if (from) match.checkOutTime.$gte = from;
    if (to) match.checkOutTime.$lte = to;
    const data = await Log.aggregate([
      { $match: match },
      { $match: { checkInTime: { $ne: null }, checkOutTime: { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ['$checkInTime', '$checkOutTime'] }, 3600000] } } },
      { $group: { _id: null, avgHours: { $avg: '$hours' } } },
    ]);
    res.json({ avgHours: data[0]?.avgHours ?? 0 });
  } catch (e) { next(e); }
};

export const topPurposes = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = {};
    if (from || to) match.timestamp = {};
    if (from) match.timestamp.$gte = from;
    if (to) match.timestamp.$lte = to;
    const data = await Log.aggregate([
      { $match: match },
      { $group: { _id: '$purpose', count: { $sum: 1 } } },
      { $project: { purpose: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    res.json(data);
  } catch (e) { next(e); }
};

export const overstayTrend = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = {};
    if (from || to) match.flaggedAt = {};
    if (from) match.flaggedAt.$gte = from;
    if (to) match.flaggedAt.$lte = to;
    const data = await Overstay.aggregate([
      { $match: match },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$flaggedAt' } } } },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $project: { day: '$_id', count: 1, _id: 0 } },
      { $sort: { day: 1 } },
    ]);
    res.json(data);
  } catch (e) { next(e); }
};

export const approvalCycle = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = { role: 'student', approvedAt: { $ne: null }, approvalRequestedAt: { $ne: null } };
    if (from || to) match.approvedAt = { ...match.approvedAt };
    if (from) match.approvedAt.$gte = from;
    if (to) match.approvedAt.$lte = to;
    const data = await User.aggregate([
      { $match: match },
      { $project: { days: { $divide: [{ $subtract: ['$approvedAt', '$approvalRequestedAt'] }, 86400000] } } },
      { $group: { _id: null, avgDays: { $avg: '$days' }, p50: { $percentile: { input: '$days', p: [0.5] } }, p90: { $percentile: { input: '$days', p: [0.9] } } } },
    ]).catch(async () => {
      // Fallback if $percentile not supported
      const all = await User.find(match).select('approvedAt approvalRequestedAt').lean();
      const arr = all.map(u => (u.approvedAt - u.approvalRequestedAt) / 86400000).sort((a,b) => a-b);
      const avgDays = arr.reduce((s,v) => s+v, 0) / (arr.length || 1);
      const pick = (p) => arr.length ? arr[Math.floor((arr.length-1)*p)] : 0;
      return [{ _id: null, avgDays, p50: [pick(0.5)], p90: [pick(0.9)] }];
    });
    const row = data[0] || { avgDays: 0, p50: [0], p90: [0] };
    res.json({ avgDays: row.avgDays, p50: row.p50?.[0] ?? 0, p90: row.p90?.[0] ?? 0 });
  } catch (e) { next(e); }
};

// --- New, actionable analytics for admins ---

// Summary of students currently outside (based on latest log in lookback window)
export const currentOutsideSummary = async (req, res, next) => {
  try {
    const lookbackHours = Number.isFinite(Number(req.query.lookbackHours)) ? Number(req.query.lookbackHours) : 24 * 7; // default 7 days
    const since = new Date(Date.now() - lookbackHours * 3600_000);
    const logs = await Log.find({ timestamp: { $gte: since } }).sort({ registrationNo: 1, timestamp: 1 }).lean();
    if (!logs.length) return res.json({ count: 0, avgHours: 0, maxHours: 0, top: [] });

    const lastMap = new Map();
    for (const log of logs) {
      const prev = lastMap.get(log.registrationNo);
      if (!prev || new Date(log.timestamp) > new Date(prev.timestamp)) lastMap.set(log.registrationNo, log);
    }
    const now = Date.now();
    const current = [];
    for (const [reg, last] of lastMap.entries()) {
      if (last.action !== 'check-out') continue;
      const outAt = new Date(last.checkOutTime || last.timestamp);
      const hours = Math.round(((now - outAt.getTime()) / 3600_000) * 10) / 10;
      current.push({ registrationNo: reg, name: last.name || null, branch: last.branch || null, batchYear: last.batchYear || null, hours });
    }
    const count = current.length;
    const sum = current.reduce((s, v) => s + v.hours, 0);
    const avgHours = count ? Math.round((sum / count) * 10) / 10 : 0;
    const maxHours = current.reduce((m, v) => Math.max(m, v.hours), 0);
    const top = current.sort((a, b) => b.hours - a.hours).slice(0, 5);
    res.json({ count, avgHours, maxHours, top });
  } catch (e) { next(e); }
};

// Open vs resolved overstay counts in range
export const overstaysOpenResolved = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = {};
    if (from || to) match.flaggedAt = {};
    if (from) match.flaggedAt.$gte = from;
    if (to) match.flaggedAt.$lte = to;
    const [open, resolved] = await Promise.all([
      Overstay.countDocuments({ ...match, resolved: false }),
      Overstay.countDocuments({ ...match, resolved: true }),
    ]);
    res.json({ open, resolved });
  } catch (e) { next(e); }
};

// Overstays by branch for simple breakdown
export const overstaysByBranch = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = {};
    if (from || to) match.flaggedAt = {};
    if (from) match.flaggedAt.$gte = from;
    if (to) match.flaggedAt.$lte = to;
    const data = await Overstay.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$branch', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { branch: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);
    res.json(data);
  } catch (e) { next(e); }
};

// Most frequent overstayers (top 5)
export const frequentOverstayers = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const match = {};
    if (from || to) match.flaggedAt = {};
    if (from) match.flaggedAt.$gte = from;
    if (to) match.flaggedAt.$lte = to;
    const data = await Overstay.aggregate([
      { $match: match },
      { $group: { _id: '$registrationNo', name: { $first: '$name' }, branch: { $first: '$branch' }, batchYear: { $first: '$batchYear' }, count: { $sum: 1 } } },
      { $project: { registrationNo: '$_id', name: 1, branch: 1, batchYear: 1, count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    res.json(data);
  } catch (e) { next(e); }
};
