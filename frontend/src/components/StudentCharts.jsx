import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee', '#f87171'];

export function WeeklyActivityChart({ data }) {
  return (
    <div className="card">
      <div className="font-semibold mb-2">Weekly Activity</div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} width={28} />
            <Tooltip />
            <Legend />
            <Bar dataKey="in" stackId="a" fill="#34d399" name="Check-ins" />
            <Bar dataKey="out" stackId="a" fill="#60a5fa" name="Check-outs" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PurposeDonut({ data }) {
  return (
    <div className="card">
      <div className="font-semibold mb-2">Purpose (last 30 days)</div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={2}>
              {data.map((entry, idx) => <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HourlyDensityArea({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const best = data.reduce((b, d) => (d.count > b.count ? d : b), { hour: null, count: 0 });
  const morning = data.filter((d) => d.hour >= 5 && d.hour < 12).reduce((s, d) => s + d.count, 0);
  const evening = data.filter((d) => d.hour >= 18 || d.hour < 2).reduce((s, d) => s + d.count, 0);
  const hasData = total > 0;
  const formatHour = (h) => {
    if (h === null || h === undefined) return '-';
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = ((h + 11) % 12) + 1;
    return `${hour12}:00 ${suffix}`;
  };
  const daysCovered = 14;
  const avgPerDay = hasData ? (total / daysCovered).toFixed(1) : '0.0';
  let persona = 'Balanced';
  if (evening > morning * 1.4) persona = 'Night owl';
  else if (morning > evening * 1.4) persona = 'Early bird';

  return (
    <div className="card">
      <div className="font-semibold mb-1">Gate Insights (last 14 days)</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {hasData
          ? 'Smart summary of when you usually use the gate.'
          : 'No recent activity yet — insights will appear here once you start using the gate.'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-900/70 border border-sky-500/40 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide text-sky-300/90">Peak hour</span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 text-xs">⏱</span>
          </div>
          <div className="text-lg font-semibold text-sky-300">{hasData ? formatHour(best.hour) : '-'}</div>
          <div className="mt-1 text-[11px] text-slate-300/80">Most logs in a single hour.</div>
        </div>

        <div className="rounded-xl bg-slate-900/70 border border-emerald-500/40 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide text-emerald-300/90">Style</span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">🌙</span>
          </div>
          <div className="text-lg font-semibold text-emerald-300">{hasData ? persona : '-'}</div>
          <div className="mt-1 text-[11px] text-slate-300/80">
            Morning logs: {morning} · Late-night logs: {evening}
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/70 border border-amber-500/40 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide text-amber-300/90">Average usage</span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-xs">📊</span>
          </div>
          <div className="text-lg font-semibold text-amber-300">{avgPerDay} logs/day</div>
          <div className="mt-1 text-[11px] text-slate-300/80">Total logs analysed: {total}</div>
        </div>
      </div>
    </div>
  );
}
