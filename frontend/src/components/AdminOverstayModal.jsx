import React from 'react';
import DataTable from './DataTable';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export default function AdminOverstayModal({
  charts,
  overstays,
  overstaysFilter,
  setOverstaysFilter,
  overstayOpen,
  setOverstayOpen,
  exportOverstays,
  loadOverstaysAndCharts,
  overstaysLoading,
  resolveOverstay,
}) {
  if (!overstayOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setOverstayOpen(false)} />
      <div className="relative glass rounded shadow-xl w-[96vw] max-w-6xl max-h-[88vh] p-4 overflow-auto animate-scale-in text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Overstay Alerts</div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => exportOverstays('pdf')}>PDF</button>
            <button className="btn" onClick={() => exportOverstays('docx')}>DOCX</button>
            <button className="btn" onClick={() => setOverstayOpen(false)}>Close</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="space-y-2 md:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div>
                <label className="text-sm">From</label>
                <input type="datetime-local" className="input" value={overstaysFilter.from} onChange={(e) => setOverstaysFilter({ ...overstaysFilter, from: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">To</label>
                <input type="datetime-local" className="input" value={overstaysFilter.to} onChange={(e) => setOverstaysFilter({ ...overstaysFilter, to: e.target.value })} />
              </div>
              <button className="btn" onClick={loadOverstaysAndCharts} disabled={overstaysLoading}>{overstaysLoading ? 'Loading…' : 'Filter'}</button>
            </div>
          </div>
          {/* Current Outside Summary */}
          <div className="bg-white/60 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-white/10 p-2">
            <div className="text-sm font-medium mb-1">Currently Outside</div>
            <div className="text-2xl font-semibold">{charts.currentOutside.count}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Avg hours: {charts.currentOutside.avgHours?.toFixed ? charts.currentOutside.avgHours.toFixed(1) : charts.currentOutside.avgHours} • Max: {charts.currentOutside.maxHours}</div>
            <div className="mt-2 max-h-28 overflow-y-auto text-xs scroll-thin pr-1">
              {charts.currentOutside.top.length === 0 ? <div className="text-gray-500">No one currently outside (in range)</div> : (
                <ul className="space-y-1">
                  {charts.currentOutside.top.map((t) => (
                    <li key={t.registrationNo} className="flex justify-between"><span>{t.name || t.registrationNo}</span><span>{t.hours}h</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Open vs Resolved */}
          <div className="bg-white/60 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-white/10 p-2">
            <div className="text-sm font-medium mb-1">Overstays — Open vs Resolved</div>
            <div className="flex items-end gap-2 h-28">
              {['Open','Resolved'].map((k, i) => {
                const val = k === 'Open' ? charts.openResolved.open : charts.openResolved.resolved;
                const max = Math.max(1, charts.openResolved.open, charts.openResolved.resolved);
                const h = Math.round((val / max) * 100);
                return (
                  <div key={k} className="flex-1 flex flex-col items-center justify-end">
                    <div className={`w-8 rounded-t ${i===0 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ height: `${h}%` }} />
                    <div className="text-xs mt-1">{k}</div>
                    <div className="text-xs font-medium">{val}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Busiest Exit Hours */}
          <div className="bg-white/60 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-white/10 p-2">
            <div className="text-sm font-medium mb-1">Busiest Exit Hours</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byHour} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} width={30} />
                  <Tooltip formatter={(v) => [`${v}`, 'Exits']} labelFormatter={(l) => `Hour ${l}:00`} />
                  <Legend />
                  <Bar dataKey="count" fill="#06b6d4" name="Exits" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {(() => {
                const arr = charts.byHour || [];
                if (!arr.length) return 'No data';
                const peak = arr.reduce((m, v) => (v.count > (m?.count || 0) ? v : m), null);
                return peak ? `Peak: ${String(peak.hour).padStart(2,'0')}:00 — ${peak.count} exits` : 'No data';
              })()}
            </div>
          </div>
        </div>
        <div className="mt-2">
          <DataTable
            maxHeight={"38vh"}
            containerClassName="scroll-thin"
            columns={[
              { key: 'registrationNo', title: 'Reg No' },
              { key: 'name', title: 'Name' },
              { key: 'branch', title: 'Branch' },
              { key: 'batchYear', title: 'Batch' },
              { key: 'purpose', title: 'Purpose' },
              { key: 'checkOutTime', title: 'Checked-out', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
              { key: 'flaggedAt', title: 'Flagged', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
              { key: 'durationHours', title: 'Hours', render: (v, r) => (
                <span title={typeof r.hoursOutsideAtFlag === 'number' ? `At flag: ${r.hoursOutsideAtFlag}h` : ''}>
                  {typeof v === 'number' ? v : (typeof r.hoursOutsideAtFlag === 'number' ? r.hoursOutsideAtFlag : '-')}
                </span>
              ) },
              { key: 'resolved', title: 'Status', render: (v, r) => (v ? `Resolved${r.checkInTime ? ' at ' + new Date(r.checkInTime).toLocaleString() : ''}` : 'Open') },
              { key: 'action', title: 'Action', render: (_, r) => (
                r.resolved ? <span className="text-green-500">—</span> : (
                  <button className="btn" onClick={() => resolveOverstay(r._id)}>Mark Resolved</button>
                )
              ) },
            ]}
            data={overstays}
          />
        </div>
      </div>
    </div>
  );
}
