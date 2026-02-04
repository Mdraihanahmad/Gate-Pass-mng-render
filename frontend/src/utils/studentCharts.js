// Data helpers for student charts

export function weeklyActivity(logs = []) {
  const byDay = {};
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i*86400000);
    const key = d.toISOString().slice(0,10);
    byDay[key] = { date: key.slice(5), in: 0, out: 0 };
  }
  for (const l of logs) {
    const t = new Date(l.timestamp || l.checkInTime || l.checkOutTime);
    if (isNaN(t)) continue;
    const key = t.toISOString().slice(0,10);
    if (!byDay[key]) continue;
    if (l.action === 'check-in') byDay[key].in++;
    if (l.action === 'check-out') byDay[key].out++;
  }
  return Object.values(byDay);
}

export function purposeDistribution(logs = []) {
  const cutoff = Date.now() - 30*86400000;
  const counts = {};
  for (const l of logs) {
    const t = new Date(l.timestamp || l.checkInTime || l.checkOutTime).getTime();
    if (isNaN(t) || t < cutoff) continue;
    const p = (l.purpose || 'Other').trim() || 'Other';
    counts[p] = (counts[p] || 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function hourlyDensity(logs = []) {
  const cutoff = Date.now() - 14*86400000; // past 14 days
  const bins = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const l of logs) {
    const t = new Date(l.timestamp || l.checkInTime || l.checkOutTime);
    const ms = t.getTime();
    if (isNaN(ms) || ms < cutoff) continue;
    bins[t.getHours()].count++;
  }
  return bins;
}

export function streakAndTotals(logs = []) {
  // Expect logs sorted desc by timestamp
  const days = new Set();
  for (const l of logs) {
    const t = new Date(l.timestamp || l.checkInTime || l.checkOutTime);
    if (isNaN(t)) continue;
    const key = t.toISOString().slice(0,10);
    days.add(key);
  }
  // Streak calculation
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; ; i++) {
    const d = new Date(today.getTime() - i*86400000);
    const key = d.toISOString().slice(0,10);
    if (days.has(key)) streak++; else break;
  }
  // Totals
  const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let week = 0, month = 0;
  for (const l of logs) {
    const t = new Date(l.timestamp || l.checkInTime || l.checkOutTime);
    if (isNaN(t)) continue;
    if (t >= startOfWeek) week++;
    if (t >= startOfMonth) month++;
  }
  return { streak, week, month };
}
