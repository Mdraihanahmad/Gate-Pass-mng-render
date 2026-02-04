import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, QrCode as QrCodeIcon, History as HistoryIcon, LineChart as LineChartIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { offline } from '../services/offline';
import { weeklyActivity, purposeDistribution, hourlyDensity, streakAndTotals } from '../utils/studentCharts';
import { Suspense, lazy } from 'react';
const WeeklyActivityChart = lazy(() => import('../components/StudentCharts').then(m => ({ default: m.WeeklyActivityChart })));
const PurposeDonut = lazy(() => import('../components/StudentCharts').then(m => ({ default: m.PurposeDonut })));
const HourlyDensityArea = lazy(() => import('../components/StudentCharts').then(m => ({ default: m.HourlyDensityArea })));

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [photoOpen, setPhotoOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [qrBrightOpen, setQrBrightOpen] = useState(false);
  // Moved Change PIN UI to Navbar Edit Profile modal
  // const [pinForm, setPinForm] = useState({ oldPin: '', newPin: '' });
  // const [pinMsg, setPinMsg] = useState('');
  const { user } = useAuth();
  const qrSectionRef = useRef(null);
  const insightsSectionRef = useRef(null);
  const logsSectionRef = useRef(null);
  const [activeTab, setActiveTab] = useState('qr');
  const lastLogsFetchRef = useRef(0);

  const scrollToSection = (ref, tab) => {
    if (ref && ref.current) {
      setActiveTab(tab);
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/students/me');
        setProfile(data);
        setProfileError('');
        // Save offline snapshot
        offline.saveStudentProfile(data).catch(() => {});
      } catch (e) {
        // Offline fallback
        let cached = null;
        try { cached = await offline.loadStudentProfile(); } catch {}
        if (cached) {
          setProfile(cached);
          setProfileError('Online fetch failed — showing cached profile');
        } else {
          // Derive a minimal profile from current auth user so UI remains usable
          try {
            const raw = localStorage.getItem('user');
            const u = raw ? JSON.parse(raw) : null;
            if (u) {
              setProfile({
                name: u.name || 'Student',
                registrationNo: u.registrationNo || '—',
                branch: u.branch || '-',
                batchYear: u.batchYear || '-',
                isApproved: !!u.isApproved,
                pinCode: u.pinCode,
                qrCodeDataUrl: u.qrCodeDataUrl,
                profilePhotoUrl: u.profilePhotoUrl,
              });
              setProfileError('Unable to reach server — limited info shown');
            } else {
              setProfileError('Unable to load profile. Please try again.');
            }
          } catch {
            setProfileError('Unable to load profile. Please try again.');
          }
        }
      }
    };
    load();
  }, []);

  // Lock body scroll when any lightbox is open
  useEffect(() => {
    if (photoOpen || qrOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [photoOpen, qrOpen]);

  // Close lightboxes with Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (photoOpen) setPhotoOpen(false);
        if (qrOpen) setQrOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoOpen, qrOpen]);

  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      lastLogsFetchRef.current = Date.now();
      const data = (await api.get('/students/logs')).data;
      setLogs(data);
      setLastUpdated(new Date());
      offline.saveStudentLogs(data).catch(() => {});
    } catch (e) {
      // Offline fallback
      const cached = await offline.loadStudentLogs().catch(() => []);
      if (cached.length) {
        setLogs(cached);
      } else {
        setLogs([]);
      }
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const refreshLogsIfStale = useCallback(
    (minAgeMs = 2 * 60_000) => {
      // Avoid calling backend when tab is hidden/offline and prevent rapid refetch loops
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (Date.now() - (lastLogsFetchRef.current || 0) < minAgeMs) return;
      loadLogs();
    },
    [loadLogs]
  );

  useEffect(() => {
    // Initial load
    loadLogs();
    // Refresh when window regains focus
    const onFocus = () => refreshLogsIfStale(2 * 60_000);
    window.addEventListener('focus', onFocus);
    // Refresh when returning to the tab (throttled)
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshLogsIfStale(2 * 60_000);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    // Gentle background refresh: at most once per 5 minutes (only when visible)
    const id = setInterval(() => refreshLogsIfStale(5 * 60_000), 60_000);
    // Update the relative time every 30s
    const tick = setInterval(() => setNowTick(Date.now()), 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);
  // Relative time helper
  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); return `${d}d ago`;
  };

  // Daily rotating motivational quote and author
  const quotes = [
    'Small steps done consistently create big change.',
    'Progress beats perfection—show up and move forward.',
    'Discipline turns goals into daily habits.',
    'Your future self is built by today’s choices.',
    'Momentum starts when excuses stop.',
    'Dream big, act small, repeat daily.',
    'Growth lives just beyond your comfort zone.',
    'You don’t need more time, just more focus.',
    'The best way to begin is to begin.',
    'Every effort compounds—keep going.',
    'Consistency is a superpower—use it.',
    'Win the day; the week will follow.',
    'Your pace is enough if you persist.',
    'Direction matters more than speed.',
    'Tiny improvements beat sudden bursts.',
    'Make it a habit, not a hurdle.',
  ];
  const authors = ['Suraj', 'Faizan', 'Raihan', 'Tarique'];
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`; // local date key
  const hashString = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };
  const seed = hashString(dateKey);
  const dailyQuote = quotes[seed % quotes.length];
  const dailyAuthor = authors[(seed * 7 + 3) % authors.length];

  // IMPORTANT: Hooks must be called consistently. Define useMemo BEFORE any early return.
  const displayedLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      const matchesAction = actionFilter === 'all' || l.action === actionFilter;
      const matchesTerm = !term ||
        (l.action && l.action.toLowerCase().includes(term)) ||
        (l.purpose && l.purpose.toLowerCase().includes(term));
      return matchesAction && matchesTerm;
    });
  }, [logs, actionFilter, search]);

  // If profile still not available, show a friendly error with retry
  if (!profile) {
    return (
      <div className="p-6">
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-4 max-w-xl">
          <div className="font-semibold mb-1">{profileError || 'Loading your profile…'}</div>
          <button
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700"
            onClick={() => {
              // Re-run the effect
              (async () => {
                try {
                  const { data } = await api.get('/students/me');
                  setProfile(data);
                  setProfileError('');
                } catch {
                  setProfileError('Still unable to load profile. Check connection or try again later.');
                }
              })();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Derived status and stats
  const lastLog = logs && logs.length ? logs[0] : null;
  const lastTimestamp = lastLog ? (lastLog.timestamp || lastLog.checkInTime || lastLog.checkOutTime) : null;
  const lastAction = lastLog?.action;
  const isInside = lastAction === 'check-in';
  const statusLabel = lastLog ? (isInside ? 'Inside campus' : 'Outside campus') : 'No activity yet';
  const statusClass = lastLog
    ? (isInside
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/20'
        : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-400/20')
    : 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-400/20';

  // Derived stats for cards
  const totalCheckIns = logs.filter((l) => l.action === 'check-in').length;
  const totalCheckOuts = logs.filter((l) => l.action === 'check-out').length;
  const pendingRequests = !profile.isApproved && profile.requestedApproval ? 1 : 0;

  // Chart data
  const weekly = weeklyActivity(logs);
  const purposes = purposeDistribution(logs);
  const hourly = hourlyDensity(logs);
  const kpis = streakAndTotals(logs);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyPresence = (() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(now.getDate() - (6 - idx));
      const hasActivity = logs.some((l) => {
        const ts = l.checkInTime || l.timestamp || l.checkOutTime;
        if (!ts) return false;
        const dt = new Date(ts);
        return (
          dt.getFullYear() === d.getFullYear() &&
          dt.getMonth() === d.getMonth() &&
          dt.getDate() === d.getDate()
        );
      });
      const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      return {
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        label: dayNames[d.getDay()],
        active: hasActivity,
        isToday,
      };
    });
  })();
  const weeklyActiveCount = weeklyPresence.filter((d) => d.active).length;
  return (
  <>
  <div className="relative min-h-screen overflow-hidden">
    {/* Animated gradient background + soft blobs */}
  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-500 animate-gradient" />
    <div className="blob absolute bottom-10 right-6 w-72 h-72 bg-cyan-400/40 rounded-full" style={{ animationDelay: '2s' }} />
  <div className="blob absolute top-1/3 left-1/2 w-64 h-64 bg-amber-400/40 rounded-full" style={{ animationDelay: '4s' }} />

    <div className="p-4 pb-20 md:pb-6 md:p-6 max-w-5xl mx-auto space-y-6">
  {/* Profile header with photo */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => profile.profilePhotoUrl && setPhotoOpen(true)}
          className="relative group"
          aria-label="View profile photo"
          title="Click to view"
        >
          <img
            src={profile.profilePhotoUrl || 'https://placehold.co/128x128?text=Avatar'}
            alt="Profile"
            width="80"
            height="80"
            loading="lazy"
            decoding="async"
            className="w-20 h-20 rounded-full object-cover border border-white/50 shadow cursor-zoom-in group-hover:scale-[1.02] transition-transform"
          />
          {profile.profilePhotoUrl && (
            <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Click to zoom</span>
          )}
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{profile.name || 'Student'}</div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
              {statusLabel}
            </span>
            {lastTimestamp && (
              <span className="text-xs text-gray-600 dark:text-gray-400">• {timeAgo(lastTimestamp)}</span>
            )}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">{profile.registrationNo}</div>
        </div>
      </div>
  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Student Dashboard</h1>
      {profileError && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3">
          {profileError}
        </div>
      )}
      {!profile.isApproved && !profile.requestedApproval && (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 p-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mt-0.5">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm.75 6a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 1.5 0V8.25Zm-1.5 7.5a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="font-semibold">Application was rejected</div>
            <div className="text-sm mb-2">Your application was rejected by an admin. You can send the request again.</div>
            <button className="btn" onClick={async () => { await api.post('/students/request-approval'); setProfile({ ...profile, requestedApproval: true }); }}>Send request again</button>
          </div>
        </div>
      )}
      {!profile.isApproved && profile.requestedApproval && (
        <div className="rounded border border-blue-200 bg-blue-50 text-blue-800 p-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mt-0.5">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm9.75-6a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Zm0 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <div>
            <div className="font-semibold">Application submitted</div>
            <div className="text-sm">Your application has been sent to the admin. Please wait for approval. You’ll get your QR and PIN once approved.</div>
          </div>
        </div>
      )}
  <div className="card student-glass border border-white/30 dark:border-white/10 mt-4">
        <div className="font-semibold">{profile.name}</div>
        <div>Registration: {profile.registrationNo}</div>
        <div>Branch: {profile.branch}</div>
        <div>Batch Year: {profile.batchYear}</div>
        <div className="mt-2 text-sm">6-digit PIN (fallback): <span className="font-mono text-lg">{profile.pinCode || '-'}</span></div>
      </div>
      {profile.qrCodeDataUrl && (
        <div ref={qrSectionRef} className="card student-glass border border-white/30 dark:border-white/10 mt-4">
          <div className="font-semibold mb-2">Your QR Code</div>
          <div className="flex items-center gap-2 mb-2">
            <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-block group"
            aria-label="View QR code"
            title="Click to view"
          >
            <div className="p-3 rounded-md bg-white inline-block">
              <img
                alt="qr"
                loading="lazy"
                decoding="async"
                width="192"
                height="192"
                className="w-40 h-40 sm:w-48 sm:h-48 cursor-zoom-in"
                style={{ imageRendering: 'pixelated' }}
                src={profile.qrCodeDataUrl}
              />
            </div>
            </button>
            <button
              type="button"
              onClick={() => setQrBrightOpen(true)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-slate-800/60 text-gray-100 border border-white/10 hover:bg-slate-700/70"
              title="Open ultra-bright QR"
            >
              Max Brightness
            </button>
          </div>
          <div className="text-sm text-gray-500 mt-2">Show this to security for check-in/out</div>
        </div>
      )}
      {/* Change PIN moved to Edit Profile modal in Navbar */}
  <div className="card student-glass border border-white/30 dark:border-white/10 mt-4">

      {/* --- Animated Stat Cards (moved below QR/info) --- */}
      <div className="flex items-center justify-end mt-8">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {lastUpdated ? `Last updated: ${timeAgo(lastUpdated)}` : 'Loading...' }
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card student-glass flex flex-col items-center text-center py-6 shadow-lg transition-transform hover:scale-105">
          <div className="text-3xl font-bold text-blue-600 animate-bounce">{totalCheckIns}</div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">Total Check-ins</div>
        </div>
        <div className="card student-glass flex flex-col items-center text-center py-6 shadow-lg transition-transform hover:scale-105">
          <div className="text-3xl font-bold text-green-600 animate-pulse">{totalCheckOuts}</div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">Total Check-outs</div>
        </div>
        <div className="card student-glass flex flex-col items-center text-center py-6 shadow-lg transition-transform hover:scale-105">
          <div className="text-3xl font-bold text-yellow-500">{pendingRequests}</div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">Pending Requests</div>
        </div>
      </div>

      {/* KPIs: Weekly journey + totals */}
      <div ref={insightsSectionRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="card student-glass py-4 px-5 border border-white/30 dark:border-white/10">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm text-gray-200/90">This week at a glance</div>
              <div className="mt-1 text-xs text-gray-300/80">{weeklyActiveCount}/7 days with activity</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-emerald-200/80">Current streak</div>
              <div className="text-2xl font-semibold text-emerald-400">{kpis.streak || 0}d</div>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-1">
            {weeklyPresence.map((day) => (
              <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={
                    `h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold ` +
                    (day.active
                      ? 'bg-emerald-400 text-emerald-950 shadow-md shadow-emerald-500/40 border border-emerald-300'
                      : 'bg-slate-900/40 text-slate-300 border border-slate-600/60') +
                    (day.isToday ? ' ring-2 ring-cyan-300/80' : '')
                  }
                >
                  {day.label[0]}
                </div>
                <div className={
                  'text-[10px] tracking-wide ' +
                  (day.isToday ? 'text-cyan-200 font-semibold' : 'text-slate-200/80')
                }>
                  {day.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="card student-glass flex items-center justify-between py-3 px-4 border border-white/30 dark:border-white/10">
            <div>
              <div className="text-xs text-gray-300/90">This week visits</div>
              <div className="text-xl font-semibold text-sky-300">{kpis.week || 0}</div>
            </div>
            <svg className="h-8 w-8 text-sky-300" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-8 10H7v-2h4v2Zm6-4H7V8h10v2Z"/></svg>
          </div>
          <div className="card student-glass flex items-center justify-between py-3 px-4 border border-white/30 dark:border-white/10">
            <div>
              <div className="text-xs text-gray-300/90">This month visits</div>
              <div className="text-xl font-semibold text-amber-300">{kpis.month || 0}</div>
            </div>
            <svg className="h-8 w-8 text-amber-300" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4V2h2v2h6V2h2v2h4v2H3V4h4Zm14 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8h18ZM7 12h5v5H7v-5Z"/></svg>
          </div>
        </div>
      </div>

      {/* Charts: Weekly + Purpose (lazy-loaded) */}
      <Suspense fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="card h-48 animate-pulse bg-white/40 dark:bg-gray-800/40" />
          <div className="card h-48 animate-pulse bg-white/40 dark:bg-gray-800/40" />
        </div>
      }>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <WeeklyActivityChart data={weekly} />
          <PurposeDonut data={purposes} />
        </div>
      </Suspense>

      {/* Time-of-day density (lazy-loaded) */}
      <Suspense fallback={<div className="card h-48 mt-4 animate-pulse bg-white/40 dark:bg-gray-800/40" />}>
        <div className="mt-4">
          <HourlyDensityArea data={hourly} />
        </div>
      </Suspense>

      {/* --- Motivational Quote Card (daily rotating) --- */}
      <div className="card student-glass flex items-center gap-4 p-4 shadow-md border-l-4 border-blue-400 mt-4">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 12h.01M7.5 19a9 9 0 1111 0H7.5z" /></svg>
        <div className="text-gray-700 dark:text-gray-200 italic flex-1">
          “{dailyQuote}” <span className="not-italic text-sm text-gray-600 dark:text-gray-300">— {dailyAuthor}</span>
        </div>
      </div>
  <div ref={logsSectionRef} className="font-semibold mb-2">Recent Activity</div>
        {/* Filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search purpose or action..."
            className="input sm:flex-1"
            aria-label="Search logs"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input w-full sm:w-40"
            aria-label="Filter by action"
          >
            <option value="all">All actions</option>
            <option value="check-in">Check-in</option>
            <option value="check-out">Check-out</option>
          </select>
        </div>
        <div className="overflow-auto max-h-80 scroll-thin">
        <table className="min-w-full text-left text-sm text-gray-800 dark:text-gray-200">
          <thead className="bg-gray-100 dark:bg-gray-800/70"><tr><th className="px-3 py-2 text-sm">Action</th><th className="px-3 py-2 text-sm">Purpose</th><th className="px-3 py-2 text-sm">Check-in</th><th className="px-3 py-2 text-sm">Check-out</th></tr></thead>
          <tbody className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
            {displayedLogs.map((l) => (
              <tr key={l._id} className="border-t border-gray-200/60 dark:border-gray-700/60">
                <td className="px-3 py-2 text-sm">{l.action}</td>
                <td className="px-3 py-2 text-sm">{l.purpose || '-'}</td>
                <td className="px-3 py-2 text-sm">{l.checkInTime ? new Date(l.checkInTime).toLocaleString() : '-'}</td>
                <td className="px-3 py-2 text-sm">{l.checkOutTime ? new Date(l.checkOutTime).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {displayedLogs.length === 0 && (<tr><td className="px-3 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={4}>No logs</td></tr>)}
          </tbody>
        </table>
        </div>
      </div>
    </div>

        {/* Mobile bottom nav for quick actions */}
        <div className="fixed inset-x-0 bottom-2 z-40 px-4 md:hidden">
          <div className="mx-auto max-w-md rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-lg shadow-black/40 backdrop-blur flex items-center justify-around py-2">
            <button
              type="button"
              onClick={() => scrollToSection(qrSectionRef, 'qr')}
              className={
                'flex flex-col items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-xl transition-colors ' +
                (activeTab === 'qr' ? 'text-sky-300 bg-sky-500/15' : 'text-slate-200/80 hover:text-white hover:bg-slate-800/80')
              }
            >
              <QrCodeIcon className="h-5 w-5" />
              <span>QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(logsSectionRef, 'logs')}
              className={
                'flex flex-col items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-xl transition-colors ' +
                (activeTab === 'logs' ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-200/80 hover:text-white hover:bg-slate-800/80')
              }
            >
              <HistoryIcon className="h-5 w-5" />
              <span>Logs</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(insightsSectionRef, 'insights')}
              className={
                'flex flex-col items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-xl transition-colors ' +
                (activeTab === 'insights' ? 'text-amber-300 bg-amber-500/15' : 'text-slate-200/80 hover:text-white hover:bg-slate-800/80')
              }
            >
              <LineChartIcon className="h-5 w-5" />
              <span>Insights</span>
            </button>
          </div>
        </div>
  </div>

  {/* Photo Lightbox */}
  {photoOpen && createPortal(
    (
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={() => setPhotoOpen(false)} />
        <div className="absolute inset-0 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={profile.profilePhotoUrl}
              alt="Profile full view"
              loading="lazy"
              decoding="async"
              width="1024"
              height="768"
              className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl shadow-2xl animate-scale-in"
            />
            <button
              type="button"
              onClick={() => setPhotoOpen(false)}
              aria-label="Close"
              className="group absolute -top-4 -right-4"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500/40 to-fuchsia-500/40 blur-md opacity-0 group-hover:opacity-100 transition" />
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/90 text-white border border-white/10 shadow-lg ring-1 ring-white/10 hover:scale-105 transition">
                <XIcon className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    ),
    document.body
  )}

  {/* QR Lightbox */}
  {qrOpen && createPortal(
    (
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={() => setQrOpen(false)} />
        <div className="absolute inset-0 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-2xl border border-black/10 dark:border-white/10 animate-scale-in">
              <div className="p-4 rounded-lg bg-white">
                <img
                  src={profile.qrCodeDataUrl}
                  alt="Full QR code"
                  loading="lazy"
                  decoding="async"
                  width="512"
                  height="512"
                  className="w-[80vw] max-w-[520px] aspect-square object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <div className="text-center text-sm mt-3 text-gray-600 dark:text-gray-300">Present this QR at the gate</div>
            </div>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              aria-label="Close"
              className="group absolute -top-4 -right-4"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/40 to-sky-500/40 blur-md opacity-0 group-hover:opacity-100 transition" />
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/90 text-white border border-white/10 shadow-lg ring-1 ring-white/10 hover:scale-105 transition">
                <XIcon className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    ),
    document.body
  )}

  {/* Ultra-bright fullscreen QR (payment-app style) */}
  {qrBrightOpen && createPortal(
    (
      <div className="fixed inset-0 z-[10000]" style={{ background: '#ffffff' }}>
        <button
          type="button"
          onClick={() => setQrBrightOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 z-[10001] inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-black/60 text-white hover:bg-black/70"
        >
          Close
        </button>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <img
            src={profile.qrCodeDataUrl}
            alt="QR"
            width="640"
            height="640"
            style={{ imageRendering: 'pixelated' }}
            className="w-[86vw] max-w-[680px] aspect-square object-contain"
          />
        </div>
      </div>
    ),
    document.body
  )}


  </>
  );
}

    // Lightboxes rendered via portal to avoid clipping
    // Note: We append them at the end of the component render using short-circuiting
