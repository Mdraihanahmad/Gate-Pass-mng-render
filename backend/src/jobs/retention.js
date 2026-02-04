import Log from '../models/Log.js';
import Visitor from '../models/Visitor.js';
import Overstay from '../models/Overstay.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import cloudinary from '../config/cloudinary.js';

// Purge logs and visitors older than given months (default 3)
// Also deletes ONLY visitor photos from Cloudinary for those purged visitors.
// Student photos are NOT touched.
export async function purgeOldDataMonths(months = 3, beforeDate) {
  const now = new Date();
  const cutoff = beforeDate ? new Date(beforeDate) : new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const logQuery = {
    $or: [
      { timestamp: { $lte: cutoff } },
      { checkInTime: { $lte: cutoff } },
      { createdAt: { $lte: cutoff } },
    ],
  };
  const visitorQuery = {
    $or: [
      { entryTime: { $lte: cutoff } },
      { createdAt: { $lte: cutoff } },
    ],
  };
  // Collect visitor photo public IDs BEFORE deletion
  const visitorsToDelete = await Visitor.find(visitorQuery).select('_id photoPublicId photos').lean();
  const toDeletePublicIds = visitorsToDelete.flatMap(v => {
    const ids = [];
    if (v?.photoPublicId) ids.push(v.photoPublicId);
    if (Array.isArray(v?.photos)) ids.push(...v.photos.map(p => p?.publicId).filter(Boolean));
    return ids;
  }).filter(Boolean);
  const [logsResult, visitorsResult] = await Promise.all([
    Log.deleteMany(logQuery),
    Visitor.deleteMany({ _id: { $in: visitorsToDelete.map(v => v._id) } }),
  ]);
  // Best-effort Cloudinary deletions for visitor photos only
  let deletedVisitorPhotos = 0;
  if (toDeletePublicIds.length) {
    try {
      const results = await Promise.allSettled(
        toDeletePublicIds.map(id => cloudinary.uploader.destroy(id).then(r => r?.result))
      );
      deletedVisitorPhotos = results.reduce((acc, r) => acc + (r.status === 'fulfilled' && r.value === 'ok' ? 1 : 0), 0);
    } catch (e) {
      console.error('[retention] Cloudinary deletion failed', e);
    }
  }
  return {
    cutoff,
    deletedLogs: logsResult.deletedCount || 0,
    deletedVisitors: visitorsResult.deletedCount || 0,
    deletedVisitorPhotos,
  };
}

// Simple daily scheduler without external deps. Runs at ~03:10 server local time
export function startDailyRetentionJob() {
  try {
    const months = Number(process.env.RETENTION_MONTHS || 3);
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setDate(now.getDate() + 1);
      next.setHours(3, 10, 0, 0);
      const delay = next.getTime() - now.getTime();
      setTimeout(async () => {
        try {
          const res = await purgeOldDataMonths(months);
          console.log('[retention] Purge done', { cutoff: res.cutoff.toISOString(), logs: res.deletedLogs, visitors: res.deletedVisitors, photos: res.deletedVisitorPhotos });
        } catch (e) {
          console.error('[retention] Purge failed', e);
        } finally {
          scheduleNext();
        }
      }, Math.max(10_000, delay));
    };
    // Kick off first run a minute after server start
    setTimeout(async () => {
      try {
        const res = await purgeOldDataMonths(months);
        console.log('[retention] Initial purge done', { cutoff: res.cutoff.toISOString(), logs: res.deletedLogs, visitors: res.deletedVisitors, photos: res.deletedVisitorPhotos });
      } catch (e) {
        console.error('[retention] Initial purge failed', e);
      } finally {
        scheduleNext();
      }
    }, 60_000);
  } catch (e) {
    console.error('[retention] Scheduler setup failed', e);
  }
}

// --- Overstay detection (students outside > 6 hours) ---
// Strategy:
// - Find the latest event per registrationNo within a lookback window.
// - If latest is a check-out and more than threshold hours ago and no newer check-in, flag as overstay.
// - Create Overstay document if not exists and notify approved admins (once).
export async function detectAndNotifyOverstays({ hours = 6, lookbackHours = 24 } = {}) {
  const now = new Date();
  const since = new Date(now.getTime() - lookbackHours * 3600_000);
  const thresholdMs = hours * 3600_000;

  // Get logs in lookback window
  const logs = await Log.find({ timestamp: { $gte: since } }).sort({ registrationNo: 1, timestamp: 1 }).lean();
  if (!logs.length) return { checked: 0, flagged: 0, notified: 0 };

  // Reduce to last event per registrationNo
  const lastMap = new Map();
  for (const log of logs) {
    const key = log.registrationNo;
    const prev = lastMap.get(key);
    if (!prev || new Date(log.timestamp) > new Date(prev.timestamp)) lastMap.set(key, log);
  }

  const admins = await User.find({ role: 'admin', isApproved: true }).select('_id').lean();
  const adminIds = admins.map(a => a._id);
  let flagged = 0, notified = 0;

  for (const [registrationNo, last] of lastMap.entries()) {
    if (last.action !== 'check-out') continue;
    const outAt = new Date(last.checkOutTime || last.timestamp);
    const diff = now.getTime() - outAt.getTime();
    if (diff < thresholdMs) continue;

    // Ensure there is no newer check-in after this checkout (within lookback)
    const post = logs.find(l => l.registrationNo === registrationNo && new Date(l.timestamp) > outAt);
    if (post && post.action === 'check-in') continue;

    // Upsert Overstay record
    const hoursOutside = Math.round((diff / 3600_000) * 10) / 10;
    const update = {
      registrationNo,
      name: last.name,
      branch: last.branch,
      batchYear: last.batchYear,
      purpose: last.purpose || null,
      checkOutTime: outAt,
      hoursOutsideAtFlag: hoursOutside,
      flaggedAt: now,
    };
    let overstay = await Overstay.findOne({ registrationNo, checkOutTime: outAt });
    if (!overstay) {
      overstay = await Overstay.create(update);
      flagged += 1;
    }

    // Notify admins once per overstay
    if (!overstay.notifiedAt && adminIds.length) {
      const msg = `Overstay: ${last.name} (${registrationNo}) from batch ${last.batchYear} stayed outside for ${hoursOutside}h (purpose: ${last.purpose || 'N/A'})`;
      await Promise.all(adminIds.map(uid => Notification.create({ user: uid, message: msg })));
      overstay.notifiedAt = now;
      await overstay.save();
      notified += adminIds.length;
    }
  }
  return { checked: lastMap.size, flagged, notified };
}

// Lightweight scheduler to run overstay detection periodically (every 30 minutes)
export function startOverstayMonitor() {
  // Configurable via environment variables for easy testing
  const hours = Number(process.env.OVERSTAY_HOURS || 6);
  const lookbackHours = Number(process.env.OVERSTAY_LOOKBACK_HR || 72);
  const initialDelayMs = Number(process.env.OVERSTAY_INITIAL_DELAY_MS || 30_000);
  const intervalMs = Number(process.env.OVERSTAY_INTERVAL_MS || (30 * 60_000));

  const run = async () => {
    try {
      const res = await detectAndNotifyOverstays({ hours, lookbackHours });
      if (res.flagged > 0) {
        console.log('[overstay] flagged:', res.flagged, 'checked:', res.checked, 'notified entries:', res.notified);
      }
    } catch (e) {
      console.error('[overstay] detection failed', e);
    }
  };
  // initial delay to let DB warm up
  setTimeout(run, initialDelayMs);
  setInterval(run, intervalMs);
  console.log('[overstay] monitor started', { hours, lookbackHours, initialDelayMs, intervalMs });
}

