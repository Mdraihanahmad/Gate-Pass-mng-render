import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Settings as SettingsIcon, LogIn as LogInIcon, LogOut as LogOutIcon, UtensilsCrossed, ShoppingCart, Pill, Home as HomeIcon, MoreHorizontal, Download as DownloadIcon, Filter as FilterIcon, RefreshCw as RefreshIcon, Camera as CameraIcon, UserPlus2 as UserPlusIcon, LogOut as ExitIcon, List as ListIcon, Users as UsersIcon, Edit3 as EditIcon, Package as PackageIcon, ChevronDown } from 'lucide-react';
import DataTable from '../components/DataTable';
import { offline } from '../services/offline';
import { api } from '../services/api';
import { authDownload } from '../services/download';
// Some versions of react-qr-barcode-scanner export the component as default, not a named export
import BarcodeScannerComponent from 'react-qr-barcode-scanner';

// Reusable gradient button (mirrors AdminDashboard styling for consistency)
const COLOR_MAP = {
  teal: {
    solid: 'from-cyan-500 via-teal-500 to-emerald-500 text-white shadow-cyan-500/30',
    outline: 'text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/10'
  },
  indigo: {
    solid: 'from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-indigo-500/30',
    outline: 'text-violet-300 border border-violet-400/30 hover:bg-violet-500/10'
  },
  amber: {
    solid: 'from-amber-500 via-orange-500 to-yellow-500 text-white shadow-amber-500/30',
    outline: 'text-amber-300 border border-amber-400/30 hover:bg-amber-500/10'
  },
  rose: {
    solid: 'from-rose-500 via-fuchsia-500 to-pink-500 text-white shadow-rose-500/30',
    outline: 'text-rose-300 border border-rose-400/30 hover:bg-rose-500/10'
  }
};

function GradientButton({ children, color='teal', variant='solid', size='sm', icon, className='', ...rest }) {
  const sizes = { xs: 'text-xs px-2.5 py-1.5', sm: 'text-sm px-3 py-1.5', md: 'text-sm px-4 py-2', lg: 'text-base px-5 py-2.5' };
  const base = 'relative inline-flex items-center gap-1.5 rounded-lg font-medium tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const palette = COLOR_MAP[color] || COLOR_MAP.teal;
  const style = variant === 'solid'
    ? `bg-gradient-to-r ${palette.solid} hover:brightness-110 shadow-sm`
    : `bg-slate-800/40 hover:bg-slate-700/50 backdrop-blur border ${palette.outline}`;
  return (
    <button type="button" className={`${base} ${sizes[size]} ${style} ${className}`} {...rest}>
      {icon && <span className="relative z-10">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export default function SecurityDashboard() {
  const [logs, setLogs] = useState([]);
  const [date, setDate] = useState({ from: '', to: '' });
  const [manual, setManual] = useState({ pinCode: '', sid: '', action: 'check-in', purpose: 'fooding', otherPurpose: '' });
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('success');
  const [noticeDuration, setNoticeDuration] = useState(2000);
  const [noticeVariant, setNoticeVariant] = useState('default'); // default | fancy
  const [scanAction, setScanAction] = useState('');
  const [scanPurpose, setScanPurpose] = useState('fooding');
  const [scanOtherPurpose, setScanOtherPurpose] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [visitor, setVisitor] = useState({ name: '', vehicleNo: '', purpose: '' });
  const [visitorPhotos, setVisitorPhotos] = useState([]); // File[] (max 3)
  const [visitorPhotoPreviews, setVisitorPhotoPreviews] = useState([]); // string[] object URLs (max 3)
  const [visitorCamOn, setVisitorCamOn] = useState(false);
  const visitorVideoRef = useRef(null);
  const visitorStreamRef = useRef(null);
  const visitorCameraWrapRef = useRef(null);
  const [visitorPurposeOpen, setVisitorPurposeOpen] = useState(false);
  const visitorPurposeRef = useRef(null);
  const [visitorCustomPurpose, setVisitorCustomPurpose] = useState('');
  const [me, setMe] = useState(null);
  const [blocked, setBlocked] = useState('');
  const [lastStudent, setLastStudent] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMeta, setPreviewMeta] = useState({ action: '', time: '', purpose: '', registrationNo: '', prevAction: '', prevTime: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false); // toggle for showing more than 50
  const [logActionFilter, setLogActionFilter] = useState('all'); // all | check-in | check-out
  const [banOpen, setBanOpen] = useState(false); // show banned/deleted ID popup
  const [banMeta, setBanMeta] = useState({ reason: '', sid: '', pin: '' });
  const [activeTab, setActiveTab] = useState('students'); // students | visitors | manual | visitorEntry
  const audioCtxRef = useRef(null);
  const settingsRef = useRef(null);
  const [hapticsMode, setHapticsMode] = useState(() => {
    try {
      const v = localStorage.getItem('security:haptics');
      if (!v) return 'both';
      if (v === 'on') return 'both';
      if (v === 'off') return 'off';
      return ['both', 'sound', 'vibration', 'off'].includes(v) ? v : 'both';
    } catch { return 'both'; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Camera enhancements
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const lastScanRef = useRef({ text: '', t: 0 });
  const [scanToast, setScanToast] = useState(null); // { action, name, registrationNo, time, queued?: boolean }

  const ManualEntryForm = ({ showHeading = true, heading = 'Manual Entry', className = '' } = {}) => (
    <div className={`space-y-2 ${className}`}>
      {showHeading && <div className="font-semibold">{heading}</div>}
      <form className="flex flex-col lg:flex-row gap-2 lg:items-end" onSubmit={submitManual}>
        <input className="input" placeholder="QR sid (optional)" value={manual.sid} onChange={(e) => setManual({ ...manual, sid: e.target.value })} />
        <input className="input" placeholder="6-digit PIN (optional)" value={manual.pinCode} onChange={(e) => setManual({ ...manual, pinCode: e.target.value })} />
        <div className="flex flex-col min-w-[200px] lg:min-w-[230px]">
          <span className="text-[11px] uppercase tracking-wide text-gray-400 mb-1 hidden lg:inline">Action</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManual({ ...manual, action: 'check-in' })}
              aria-pressed={manual.action==='check-in'}
              className={`relative inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] lg:text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-gray-900 transition-colors ${manual.action==='check-in'
                ? 'text-white bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 border border-transparent shadow-sm'
                : 'text-cyan-300 bg-slate-800/40 hover:bg-slate-700/50 border border-cyan-500/30'} `}
            >
              {manual.action==='check-in' && <span className="absolute inset-0 rounded-lg bg-white/10" />}
              <LogInIcon className="h-4 w-4 relative" />
              <span className="relative">Check&nbsp;In</span>
            </button>
            <button
              type="button"
              onClick={() => setManual({ ...manual, action: 'check-out' })}
              aria-pressed={manual.action==='check-out'}
              className={`relative inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] lg:text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-gray-900 transition-colors ${manual.action==='check-out'
                ? 'text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 border border-transparent shadow-sm'
                : 'text-violet-300 bg-slate-800/40 hover:bg-slate-700/50 border border-violet-500/30'} `}
            >
              {manual.action==='check-out' && <span className="absolute inset-0 rounded-lg bg-white/10" />}
              <LogOutIcon className="h-4 w-4 relative" />
              <span className="relative">Check&nbsp;Out</span>
            </button>
          </div>
        </div>
        {manual.action === 'check-out' && (
          <div className="min-w-[260px]">
            <PurposeSelector
              label="Purpose"
              value={manual.purpose}
              onChange={(v) => setManual({ ...manual, purpose: v })}
              otherValue={manual.otherPurpose}
              onOtherChange={(v) => setManual({ ...manual, otherPurpose: v })}
              layout="column"
            />
          </div>
        )}
        <GradientButton color="teal" type="submit" icon={<LogInIcon className="h-4 w-4" />}>Log</GradientButton>
      </form>
    </div>
  );

  // Auto-hide scan toast
  useEffect(() => {
    if (!scanToast) return;
    const t = setTimeout(() => setScanToast(null), 3000);
    return () => clearTimeout(t);
  }, [scanToast]);

  // Close settings on outside click or Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e) => {
      if (!settingsRef.current) return;
      if (!settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const playSuccessHaptics = async () => {
    if (hapticsMode === 'off') return;
    // Light vibration pattern (ignored on unsupported devices)
    if (hapticsMode === 'both' || hapticsMode === 'vibration') {
      try { if (navigator?.vibrate) navigator.vibrate([10, 30, 10]); } catch {}
    }
    // Tiny beep using Web Audio API
    if (hapticsMode === 'both' || hapticsMode === 'sound') {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        let ctx = audioCtxRef.current;
        if (!ctx) {
          ctx = new Ctx();
          audioCtxRef.current = ctx;
        }
        if (ctx.state === 'suspended') {
          try { await ctx.resume(); } catch {}
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      } catch {}
    }
  };

  const playErrorHaptics = async () => {
    if (hapticsMode === 'off') return;
    // Stronger vibration pattern
    if (hapticsMode === 'both' || hapticsMode === 'vibration') {
      try { if (navigator?.vibrate) navigator.vibrate([40, 60, 40]); } catch {}
    }
    // Descending beep
    if (hapticsMode === 'both' || hapticsMode === 'sound') {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        let ctx = audioCtxRef.current;
        if (!ctx) {
          ctx = new Ctx();
          audioCtxRef.current = ctx;
        }
        if (ctx.state === 'suspended') {
          try { await ctx.resume(); } catch {}
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      } catch {}
    }
  };

  // Persist haptics mode
  useEffect(() => {
    try { localStorage.setItem('security:haptics', hapticsMode); } catch {}
  }, [hapticsMode]);
  // Keep student preview open until the user closes it via the close button

  const load = async () => {
    try {
      const { data } = await api.get('/security/logs', { params: date.from || date.to ? { ...date } : {} });
      // Keep only latest 1000 logs locally for Security Dashboard performance
      const pruned = (() => {
        if (!Array.isArray(data)) return [];
        const getTime = (l) => new Date(l.timestamp || l.checkOutTime || l.checkInTime || l.createdAt || 0).getTime();
        const sorted = [...data].sort((a, b) => getTime(b) - getTime(a)); // newest first
        if (sorted.length > 200) return sorted.slice(0, 200);
        return sorted;
      })();
      setLogs(pruned);
      // Persist only the pruned subset so device storage stays light; admin API still retains full history.
      offline.saveLogs(pruned).catch(() => {});
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        setBlocked(e?.response?.data?.message || 'You are not security anymore.');
        return;
      }
      const cached = await offline.loadLogs().catch(() => []);
      if (cached.length) {
        // Ensure cached also respects 1000 limit
        const getTime = (l) => new Date(l.timestamp || l.checkOutTime || l.checkInTime || l.createdAt || 0).getTime();
        const sorted = [...cached].sort((a, b) => getTime(b) - getTime(a));
        setLogs(sorted.slice(0, 200));
      }
    }
  };
  useEffect(() => {
    // Ensure API token is set even if AuthProvider effect hasn't run yet
    try { const t = localStorage.getItem('token'); if (t) { import('../services/api').then(m => m.api.setToken(t)); } } catch {}
    load();
    // Prune cached students older than 60 days on mount
    offline.pruneStudentCache(60).catch(() => {});
    (async () => {
      try {
        // Bootstrap from cached user for offline/PWA refresh
        try {
          const cached = localStorage.getItem('user');
          if (cached) {
            const u = JSON.parse(cached);
            if (u && u.role === 'security') setMe(u);
          }
        } catch {}

        // If offline, skip remote validation and keep cached user
        if (!navigator.onLine) return;

        const { data } = await api.get('/auth/me');
        setMe(data);
      } catch (err) {
        const status = err?.response?.status;
        // Only block on actual auth failures; ignore network/offline errors
        if (status === 401 || status === 403) {
          setBlocked(err?.response?.data?.message || 'You are not security anymore.');
        }
      }
    })();
    // Online/offline listeners
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Auto-hide success/info notice after 2 seconds
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), noticeDuration || 2000);
    return () => clearTimeout(t);
  }, [notice, noticeDuration]);

  const stopScannerCamera = () => {
    try {
      const stream = mediaStreamRef.current;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
      }
    } catch {}
    mediaStreamRef.current = null;
    setTorchOn(false);
    setCameraOn(false);
  };

  const onScanResult = async (text) => {
    // expecting payload with registrationNo
    try {
      if (!scanAction) return; // require an action to be selected
      // Accept both legacy JSON { sid: "..." } and new compact plain SID
      let sid = '';
      try {
        const parsed = JSON.parse(text);
        sid = parsed && typeof parsed === 'object' ? parsed.sid : '';
      } catch {
        sid = text; // plain SID
      }
      if (!sid) return; // ignore old codes without sid
      // Only include purpose when performing a check-out
      const purpose = scanAction === 'check-out'
        ? ((scanPurpose === 'other' ? (scanOtherPurpose || 'Other') : scanPurpose) || undefined)
        : undefined;
      const clientTimestamp = new Date().toISOString();
      // If offline, queue the action and show a notice
      if (!navigator.onLine) {
        await offline.queueAction({ type: 'scan', payload: { sid, action: scanAction, purpose, clientTimestamp } });
        setNotice(`Queued scan for ${sid} (${scanAction}) — will sync when online`);
        setNoticeType('success');
        // Try to load cached student by SID for offline preview
        try {
          const cached = await offline.getStudentBySid(sid);
          if (cached) {
            const p = scanAction === 'check-out'
              ? (scanPurpose === 'other' ? (scanOtherPurpose || 'Other') : scanPurpose)
              : '';
            setLastStudent({
              name: cached.name,
              registrationNo: cached.registrationNo,
              branch: cached.branch,
              batchYear: cached.batchYear,
              studentUid: cached.sid,
              profilePhotoUrl: cached.profilePhotoUrl,
              profilePhotoThumbUrl: cached.profilePhotoThumbUrl,
            });
            const prev = logs.find((l) => l.registrationNo === cached.registrationNo);
            setPreviewMeta({ action: scanAction, time: clientTimestamp, purpose: p, registrationNo: cached.registrationNo, prevAction: prev?.action || '', prevTime: prev?.timestamp || '' });
            setPreviewOpen(true);
            setCameraOn(false);
          }
        } catch {}
        // Show toast feedback even when queued
        setScanToast({ action: scanAction, name: 'Queued', registrationNo: sid, time: clientTimestamp, queued: true });
        return;
      }
    const res = await api
  .post('/security/scan', { sid, action: scanAction, purpose, clientTimestamp })
        .catch((e) => e?.response || { status: 0, data: { message: e?.message } });
      if (res && res.status === 403) {
        setBlocked(res.data?.message || 'You are not security anymore.');
        playErrorHaptics();
        return;
      }
      // Handle errors
      if (!res || res.status === 0) {
        // Network/offline case: queue for later
        await offline.queueAction({ type: 'scan', payload: { sid, action: scanAction, purpose, clientTimestamp } });
        setNotice(`Queued scan for ${sid} (${scanAction}) — will sync when online`);
        setNoticeType('success');
        setScanToast({ action: scanAction, name: 'Queued', registrationNo: sid, time: clientTimestamp, queued: true });
        return;
      }
      if (res.status === 404) {
        // Likely deleted/banned or not approved — show explicit popup and do not queue
        setBanMeta({ reason: 'Deleted/Banned ID', sid, pin: '' });
        setBanOpen(true);
        setNotice('Scan blocked: deleted/banned ID');
        setNoticeType('error');
        playErrorHaptics();
        return;
      }
      if (res.status === 400 || res.status === 429) {
        setNotice(res?.data?.message || 'Scan not allowed');
        setNoticeType('error');
        playErrorHaptics();
        return;
      }
      if (res.status >= 400) {
        setNotice(res?.data?.message || 'Scan failed');
        setNoticeType('error');
        playErrorHaptics();
        return;
      }
      if (res?.data?.student) {
    const p = scanAction === 'check-out'
      ? (scanPurpose === 'other' ? (scanOtherPurpose || 'Other') : scanPurpose)
      : '';
    setLastStudent(res.data.student);
    const prev = logs.find((l) => l.registrationNo === res.data.student.registrationNo);
    setPreviewMeta({ action: scanAction, time: clientTimestamp, purpose: p, registrationNo: res.data.student.registrationNo, prevAction: prev?.action || '', prevTime: prev?.timestamp || '' });
    setPreviewOpen(true);
    setCameraOn(false); // auto turn off camera while preview is open
    playSuccessHaptics();
        // Show scan toast with concise info
        setScanToast({ action: scanAction, name: res.data.student.name || '', registrationNo: res.data.student.registrationNo, time: clientTimestamp });
        // Save to offline cache for future offline previews
        try { await offline.saveStudentBySid(res.data.student); } catch {}
  }
      setNotice(`Scanned ${sid} (${scanAction})`);
      setNoticeType('success');
      await load();
    } catch {
      setNotice('Scan failed');
      setNoticeType('error');
      playErrorHaptics();
    }
  };

  // Auto-refresh when connection comes back
  useEffect(() => {
    if (online) {
      // slight delay to allow network to stabilize
      const t = setTimeout(async () => {
        // Drain any queued actions first
        try {
          const pending = await offline.listPendingActions();
          let ok = 0, fail = 0;
          for (const action of pending) {
            try {
              if (action.type === 'scan') {
                await api.post('/security/scan', action.payload);
              } else if (action.type === 'manual') {
                await api.post('/security/manual', action.payload);
              } else if (action.type === 'visitor:create') {
                await api.post('/visitors', action.payload);
              } else if (action.type === 'visitor:exit') {
                await api.patch(`/visitors/${action.payload.id}/exit`, { exitTime: action.payload.exitTime });
              }
              await offline.removePendingAction(action.id);
              ok++;
            } catch (e) {
              // Keep it in the queue; continue with others
              fail++;
            }
          }
          if (ok > 0) {
            setNotice(`Synced ${ok} action${ok>1?'s':''}${fail?`, ${fail} pending`:''}`);
            setNoticeType('success');
          }
        } catch {}
        // Refresh data afterwards
        await load().catch(() => {});
        // Prune cache after sync
        try { await offline.pruneStudentCache(60); } catch {}
        try { window.dispatchEvent(new CustomEvent('refresh-visitors')); } catch {}
      }, 800);
      return () => clearTimeout(t);
    }
  }, [online]);

  const submitManual = async (e) => {
    e.preventDefault();
    const payload = { ...manual };
    if (manual.action === 'check-out') {
      payload.purpose = manual.purpose === 'other' ? manual.otherPurpose : manual.purpose;
    } else {
      delete payload.purpose; // no purpose for check-in
    }
    delete payload.otherPurpose;
    try {
      const clientTimestamp = new Date().toISOString();
      // OFFLINE: queue and show preview from cache by SID or PIN
      if (!navigator.onLine) {
        await offline.queueAction({ type: 'manual', payload: { ...payload, clientTimestamp } });
        setNotice('Queued manual log — will sync when online');
        setNoticeType('success');
        try {
          const sid = (manual.sid || '').trim();
          const pin = (manual.pinCode || '').trim();
          let cached = null;
          if (sid) {
            cached = await offline.getStudentBySid(sid);
          } else if (/^\d{6}$/.test(pin)) {
            cached = await offline.getStudentByPin(pin);
          }
          if (cached) {
            const p = manual.action === 'check-out'
              ? (manual.purpose === 'other' ? (manual.otherPurpose || 'Other') : manual.purpose)
              : '';
            setLastStudent({
              name: cached.name,
              registrationNo: cached.registrationNo,
              branch: cached.branch,
              batchYear: cached.batchYear,
              studentUid: cached.sid,
              profilePhotoUrl: cached.profilePhotoUrl,
              profilePhotoThumbUrl: cached.profilePhotoThumbUrl,
            });
            const prev = logs.find((l) => l.registrationNo === cached.registrationNo);
            setPreviewMeta({ action: manual.action, time: clientTimestamp, purpose: p, registrationNo: cached.registrationNo, prevAction: prev?.action || '', prevTime: prev?.timestamp || '' });
            setPreviewOpen(true);
            setCameraOn(false);
            playSuccessHaptics();
          }
        } catch {}
        setManual({ pinCode: '', sid: '', action: 'check-in', purpose: 'fooding', otherPurpose: '' });
        return;
      }

      // ONLINE: post to API and handle result
      const res = await api.post('/security/manual', { ...payload, clientTimestamp }).catch((e) => e?.response || { status: 0, data: { message: e?.message } });
      if (!res || res.status === 0) {
        // Network failure -> queue and exit
        await offline.queueAction({ type: 'manual', payload: { ...payload, clientTimestamp } });
        setNotice('Queued manual log — will sync when online');
        setNoticeType('success');
        setManual({ pinCode: '', sid: '', action: 'check-in', purpose: 'fooding', otherPurpose: '' });
        return;
      }
      if (res && res.status === 403) {
        setBlocked(res.data?.message || 'You are not security anymore.');
        playErrorHaptics();
        return;
      }
      if (res.status === 404) {
        const sid = payload.sid || '';
        const pin = payload.pinCode || '';
        setBanMeta({ reason: 'Deleted/Banned ID', sid, pin });
        setBanOpen(true);
        setNotice('Log blocked: deleted/banned ID');
        setNoticeType('error');
        playErrorHaptics();
        return;
      }
      if (res.status === 400 || res.status === 429 || res.status >= 400) {
        setNotice(res?.data?.message || 'Failed to log');
        setNoticeType('error');
        playErrorHaptics();
        return;
      }
      if (res?.data?.student) {
        const p = manual.action === 'check-out'
          ? (manual.purpose === 'other' ? (manual.otherPurpose || 'Other') : manual.purpose)
          : '';
        setLastStudent(res.data.student);
        const prev = logs.find((l) => l.registrationNo === res.data.student.registrationNo);
        setPreviewMeta({ action: manual.action, time: clientTimestamp, purpose: p, registrationNo: res.data.student.registrationNo, prevAction: prev?.action || '', prevTime: prev?.timestamp || '' });
        setPreviewOpen(true);
        setCameraOn(false);
        playSuccessHaptics();
        // Cache for offline
        try { await offline.saveStudentBySid(res.data.student); } catch {}
        try {
          const pin = (manual.pinCode || '').trim();
          if (/^\d{6}$/.test(pin)) {
            await offline.saveStudentByPin(pin, res.data.student);
          }
        } catch {}
      }
      setNotice(`Logged (${manual.action})`);
      setNoticeType('success');
      setManual({ pinCode: '', sid: '', action: 'check-in', purpose: 'fooding', otherPurpose: '' });
      await load();
    } catch (err) {
      setNotice(err?.response?.data?.message || 'Failed to log');
      setNoticeType('error');
      playErrorHaptics();
    }
  };

  const createVisitor = async (e) => {
    e.preventDefault();
    const entryTime = new Date().toISOString();
    const selectedPurpose = (visitor.purpose === 'Other' ? visitorCustomPurpose : visitor.purpose)?.trim();
    if (!selectedPurpose) {
      setNotice('Please select a purpose');
      setNoticeType('error');
      return;
    }
    // Photo is optional unless camera mode is currently active
    if (visitorCamOn && (!visitorPhotos || visitorPhotos.length === 0)) {
      setNotice('Please capture a photo');
      setNoticeType('error');
      setNoticeDuration(2500);
      setNoticeVariant('default');
      return;
    }
    if (!navigator.onLine) {
      // Photo cannot be queued offline; save metadata only and inform user
      await offline.queueAction({ type: 'visitor:create', payload: { ...visitor, purpose: selectedPurpose, entryTime } });
      setVisitor({ name: '', vehicleNo: '', purpose: '' });
      setVisitorPhotos([]);
      setVisitorPhotoPreviews([]);
      setVisitorCustomPurpose('');
      setNotice('Queued visitor (photo not saved offline) — will sync when online');
      setNoticeType('success');
      setNoticeDuration(2500);
      setNoticeVariant('default');
      return;
    }
    const form = new FormData();
    form.append('name', visitor.name);
    form.append('vehicleNo', visitor.vehicleNo);
    form.append('purpose', selectedPurpose);
    form.append('entryTime', entryTime);
    if (Array.isArray(visitorPhotos) && visitorPhotos.length) {
      visitorPhotos.slice(0, 3).forEach((f) => {
        if (f) form.append('photos', f);
      });
    }
    const res = await api.post('/visitors', form, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((e) => e?.response || { status: 0 });
    if (!res || res.status === 0 || res.status >= 400) {
      await offline.queueAction({ type: 'visitor:create', payload: { ...visitor, purpose: selectedPurpose, entryTime } });
      setNotice('Queued visitor (photo not saved) — will sync when online');
      setNoticeType('success');
      setNoticeDuration(2500);
      setNoticeVariant('default');
    } else {
      // Success path — show attractive 5s popup
      setNotice('Visitor registered');
      setNoticeType('success');
      setNoticeDuration(5000);
      setNoticeVariant('fancy');
    }
    setVisitor({ name: '', vehicleNo: '', purpose: '' });
    setVisitorPhotos([]);
    setVisitorPhotoPreviews([]);
    setVisitorCustomPurpose('');
  };

  // Build/revoke visitor photo previews (object URLs)
  useEffect(() => {
    const urls = (Array.isArray(visitorPhotos) ? visitorPhotos : []).slice(0, 3).map((f) => {
      try { return URL.createObjectURL(f); } catch { return ''; }
    }).filter(Boolean);
    setVisitorPhotoPreviews(urls);
    return () => {
      try { urls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    };
  }, [visitorPhotos]);

  // --- Visitor camera controls ---
  const startVisitorCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setNotice('Camera not supported on this device');
        setNoticeType('error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      visitorStreamRef.current = stream;
      setVisitorCamOn(true);
      requestAnimationFrame(() => {
        if (visitorVideoRef.current) {
          visitorVideoRef.current.srcObject = stream;
          visitorVideoRef.current.play().catch(() => {});
        }
      });
      // Bring camera preview into view (centered) for fast use on mobile
      setTimeout(() => {
        try {
          visitorCameraWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
      }, 150);
    } catch (e) {
      setNotice('Failed to open camera');
      setNoticeType('error');
    }
  };

  const stopVisitorCamera = () => {
    try {
      const stream = visitorStreamRef.current;
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
      }
    } catch {}
    visitorStreamRef.current = null;
    setVisitorCamOn(false);
  };

  const captureVisitorPhoto = async () => {
    try {
      const video = visitorVideoRef.current;
      if (!video) return;
      // Draw to canvas and compress
      const maxDim = 1024; // clamp max width/height
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, cw, ch);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      if (!blob) return;
      const file = new File([blob], 'visitor.jpg', { type: 'image/jpeg' });
      const already = Array.isArray(visitorPhotos) ? visitorPhotos.length : 0;
      if (already >= 3) {
        setNotice('Maximum 3 photos allowed');
        setNoticeType('error');
        setNoticeDuration(2500);
        setNoticeVariant('default');
      } else {
        setVisitorPhotos((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          if (next.length >= 3) return next;
          next.push(file);
          return next;
        });
      }
      stopVisitorCamera();
      setNotice('Photo captured');
      setNoticeType('success');
    } catch (e) {
      setNotice('Failed to capture photo');
      setNoticeType('error');
    }
  };

  const onVisitorPhotosPicked = (e) => {
    const files = Array.from(e?.target?.files || []).filter(Boolean);
    if (!files.length) return;
    if (files.length > 3) {
      setNotice('You can upload maximum 3 photos');
      setNoticeType('error');
      setNoticeDuration(2500);
      setNoticeVariant('default');
    }
    setVisitorPhotos(files.slice(0, 3));
    // allow selecting same file again
    try { e.target.value = ''; } catch {}
  };

  const removeVisitorPhotoAt = (idx) => {
    setVisitorPhotos((prev) => (Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []));
  };

  // Stop camera when leaving Visitor Entry tab
  useEffect(() => {
    if (activeTab !== 'visitorEntry' && visitorCamOn) stopVisitorCamera();
  }, [activeTab]);

  // Close visitor purpose dropdown on outside click or Escape
  useEffect(() => {
    if (!visitorPurposeOpen) return;
    const onDown = (e) => {
      if (!visitorPurposeRef.current) return;
      if (!visitorPurposeRef.current.contains(e.target)) setVisitorPurposeOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setVisitorPurposeOpen(false); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [visitorPurposeOpen]);

  const exportFile = async (fmt, type) => {
    try {
      const params = { type, from: date.from || undefined, to: date.to || undefined };
      if (type === 'students' && logActionFilter !== 'all') {
        params.action = logActionFilter;
      }
      await authDownload(`/api/export/${fmt}`, params, `${type}-logs.${fmt}`);
    } catch (e) {
      setNotice(e.message || 'Export failed');
      setNoticeType('error');
    }
  };

  

  // Compute sorted logs (latest first), apply action filter, and slice if necessary
  const displayedLogs = React.useMemo(() => {
    if (!Array.isArray(logs)) return [];
    const getTime = (l) => new Date(l.timestamp || l.checkOutTime || l.checkInTime || l.createdAt || 0).getTime();
    const sorted = [...logs].sort((a, b) => getTime(b) - getTime(a));
    const filtered = logActionFilter === 'all'
      ? sorted
      : sorted.filter((l) => l.action === logActionFilter);
    if (showAllLogs) return filtered;
    return filtered.slice(0, 50);
  }, [logs, showAllLogs, logActionFilter]);

  return (
  <>
  <div className="p-4 md:p-6 space-y-6 pb-28 sm:pb-6">{/* extra pb for taller mobile sticky footer */}
  <div className="flex items-center justify-between">
    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Security Dashboard</h1>
    <div className="relative" ref={settingsRef}>
      <button
        type="button"
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md ${settingsOpen ? 'text-emerald-300 bg-emerald-400/10' : 'text-sky-200'} hover:text-white hover:bg-sky-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition`}
        onClick={() => setSettingsOpen((v) => !v)}
        aria-expanded={settingsOpen}
        title="Settings"
      >
        <SettingsIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Settings</span>
      </button>
      {settingsOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded shadow-xl p-2 text-sm animate-scale-in bg-gray-900/95 text-gray-100 border border-white/10 z-50">
          <div className="font-semibold mb-1 text-gray-200">Feedback</div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 rounded px-2 py-1">
              <input type="radio" name="haptics-mode" value="both" checked={hapticsMode==='both'} onChange={() => setHapticsMode('both')} /> Both (sound + vibration)
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 rounded px-2 py-1">
              <input type="radio" name="haptics-mode" value="sound" checked={hapticsMode==='sound'} onChange={() => setHapticsMode('sound')} /> Sound only
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 rounded px-2 py-1">
              <input type="radio" name="haptics-mode" value="vibration" checked={hapticsMode==='vibration'} onChange={() => setHapticsMode('vibration')} /> Vibration only
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 rounded px-2 py-1">
              <input type="radio" name="haptics-mode" value="off" checked={hapticsMode==='off'} onChange={() => setHapticsMode('off')} /> Off
            </label>
          </div>
        </div>
      )}
    </div>
  </div>
      {!online && (
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-600/20 text-amber-200 px-3 py-1 text-xs border border-amber-400/30">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
          Offline — showing cached data
        </div>
      )}
      {blocked && (
        <div className="rounded border border-amber-200 bg-amber-50 text-amber-800 p-4">
          {blocked || 'You are not security anymore.'}
        </div>
      )}
      {me && !me.isApproved && !me.requestedApproval && (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 p-4 flex items-start gap-3">
          <div className="font-semibold">Application was rejected</div>
          <div className="ml-auto">
            <button className="btn" onClick={async () => { await api.post('/security/request-approval'); setMe({ ...me, requestedApproval: true }); setNotice('Request sent'); }}>Send request again</button>
          </div>
        </div>
      )}
      {me && !me.isApproved && me.requestedApproval && (
        <div className="rounded border border-blue-200 bg-blue-50 text-blue-800 p-3">Application submitted — please wait for admin approval.</div>
      )}
      {notice && noticeVariant === 'default' && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 shadow-lg rounded px-4 py-3 transition-opacity duration-300 ${
            noticeType === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}
        >
          {notice}
        </div>
      )}
      {notice && noticeVariant === 'fancy' && (
        <div className="fixed inset-x-0 bottom-6 z-[9999] flex justify-center px-4">
          <div className="relative inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 shadow-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 backdrop-blur-md text-white">
            <span className="absolute -inset-2 -z-10 blur-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20" aria-hidden="true" />
            <svg className="h-5 w-5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="font-semibold tracking-wide">{notice}</span>
          </div>
        </div>
      )}

      {/* Scan Toast (bottom center, above preview) */}
      {scanToast && createPortal(
        (
          <div className="fixed inset-x-0 bottom-6 z-[10050] flex justify-center px-4 pointer-events-none">
            <div className={`relative inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md text-white pointer-events-auto ${scanToast.action==='check-in' ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20' : 'bg-gradient-to-r from-sky-500/20 via-violet-500/20 to-fuchsia-500/20'}`}>
              <span className="absolute -inset-2 -z-10 blur-2xl" aria-hidden="true" />
              {scanToast.action==='check-in' ? <LogInIcon className="h-5 w-5 text-emerald-300" /> : <LogOutIcon className="h-5 w-5 text-fuchsia-300" />}
              <div className="flex flex-col leading-tight">
                <span className="font-semibold tracking-wide capitalize">{scanToast.queued ? 'Queued' : scanToast.action.replace('-', ' ')}</span>
                <span className="text-sm text-gray-200">{scanToast.name || 'Student'}{scanToast.registrationNo ? ` • ${scanToast.registrationNo}` : ''}</span>
              </div>
              <span className="text-[11px] text-gray-300 ml-2">{new Date(scanToast.time).toLocaleTimeString()}</span>
            </div>
          </div>
        ),
        document.body
      )}

  {/* Inline preview removed; using full-screen lightbox below */}

  {!blocked && activeTab === 'students' && (
  <div className="card">
        <div className="font-semibold mb-2">Scan Student QR</div>
        <div className="mb-2">
          <label className="text-sm mr-2 block">Action</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setScanAction('check-in'); setCameraOn(true); }}
              aria-pressed={scanAction==='check-in'}
              className={`relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-gray-900 group ${scanAction==='check-in'
                ? 'text-white bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 shadow-sm border border-transparent'
                : 'text-cyan-300 bg-slate-800/40 hover:bg-slate-700/50 border border-cyan-500/30'} `}
            >
              {scanAction==='check-in' && <span className="absolute inset-0 rounded-lg bg-white/10 group-hover:bg-white/15 transition" aria-hidden="true" />}
              <LogInIcon className="relative h-4 w-4" />
              <span className="relative tracking-wide">Check In</span>
            </button>
            <button
              type="button"
              onClick={() => { setScanAction('check-out'); setCameraOn(true); }}
              aria-pressed={scanAction==='check-out'}
              className={`relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-gray-900 group ${scanAction==='check-out'
                ? 'text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm border border-transparent'
                : 'text-violet-300 bg-slate-800/40 hover:bg-slate-700/50 border border-violet-500/30'} `}
            >
              {scanAction==='check-out' && <span className="absolute inset-0 rounded-lg bg-white/10 group-hover:bg-white/15 transition" aria-hidden="true" />}
              <LogOutIcon className="relative h-4 w-4" />
              <span className="relative tracking-wide">Check Out</span>
            </button>
          </div>
        </div>
        {scanAction === 'check-out' && (
          <div className="mb-3">
            <PurposeSelector
              label="Purpose"
              value={scanPurpose}
              onChange={setScanPurpose}
              otherValue={scanOtherPurpose}
              onOtherChange={setScanOtherPurpose}
              layout="row"
            />
          </div>
        )}
        {/* Camera toggles removed — camera auto starts when an action is chosen */}
  {cameraOn ? (
          <div className="max-w-full sm:max-w-sm space-y-2">
            <div className="flex items-center gap-2">
              {torchSupported && (
                <GradientButton
                  color={torchOn ? 'amber' : 'indigo'}
                  size="xs"
                  variant={torchOn ? 'solid' : 'outline'}
                  onClick={async () => {
                    try {
                      const track = mediaStreamRef.current?.getVideoTracks?.()[0];
                      if (!track) return;
                      const capabilities = track.getCapabilities?.();
                      if (capabilities && 'torch' in capabilities) {
                        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
                        setTorchOn(!torchOn);
                      }
                    } catch {}
                  }}
                >
                  {torchOn ? 'Torch: ON' : 'Torch: OFF'}
                </GradientButton>
              )}
              <GradientButton
                color="rose"
                size="xs"
                variant="outline"
                onClick={stopScannerCamera}
              >
                Camera Off
              </GradientButton>
              <div className="text-xs text-gray-400">Aim camera steady; the scanner auto-focuses.</div>
            </div>
            <div className="relative inline-block rounded-xl overflow-hidden border border-white/10 bg-black/40">
              <BarcodeScannerComponent
                key={cameraOn ? 'on' : 'off'}
                width={360}
                height={270}
                // Prefer rear camera, higher frame rate and continuous focus
                videoConstraints={{
                  facingMode: { ideal: 'environment' },
                  frameRate: { ideal: 30, max: 60 },
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }}
                onUpdate={(err, result) => {
                  if (previewOpen) return; // ignore scans while preview is open
                  const txt = result?.text;
                  if (!txt) return;
                  // Debounce duplicate frames within 600ms
                  const now = performance.now();
                  if (lastScanRef.current.text === txt && now - lastScanRef.current.t < 600) return;
                  lastScanRef.current = { text: txt, t: now };
                  onScanResult(txt);
                }}
                // Forward video element ref when available
                videoRef={(node) => {
                  if (!node) return;
                  try {
                    // Access the underlying <video> element used by the component
                    const v = node;
                    videoRef.current = v;
                    const stream = v.srcObject;
                    if (stream) {
                      mediaStreamRef.current = stream;
                      const track = stream.getVideoTracks?.()[0];
                      try {
                        // Boost resolution and request continuous autofocus
                        track.applyConstraints({
                          advanced: [
                            { focusMode: 'continuous' }
                          ],
                          width: { ideal: 1280 },
                          height: { ideal: 720 },
                          aspectRatio: { ideal: 16/9 },
                          facingMode: { ideal: 'environment' }
                        }).catch(() => {});
                      } catch {}
                      try {
                        const caps = track.getCapabilities?.() || {};
                        if ('torch' in caps) setTorchSupported(true);
                      } catch {}
                    }
                  } catch {}
                }}
              />
              {/* Center scanning indicator overlay */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="pulse-ring flex items-center justify-center text-cyan-300">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/70 bg-black/40">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  </span>
                </div>
                <div className="mt-3 text-xs font-semibold tracking-[0.25em] uppercase text-cyan-50 drop-shadow-sm">
                  Scanning
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {!scanAction ? 'Select Check In or Check Out to start scanning.' : 'Select the action again to start scanning.'}
          </div>
        )}
    </div>
  )}
  {/* Tabs container */}
  {!blocked && (
    <div className="card">
      {/* Desktop tab bar */}
      <div className="hidden sm:flex items-center gap-2 mb-3" role="tablist" aria-label="Security dashboard sections">
        {[
          { key: 'students', label: 'Student Logs', icon: <ListIcon className="h-4 w-4" /> },
          { key: 'visitors', label: 'Visitor Logs', icon: <UsersIcon className="h-4 w-4" /> },
          { key: 'manual', label: 'Manual Entry', icon: <EditIcon className="h-4 w-4" /> },
          { key: 'visitorEntry', label: 'Visitor Entry', icon: <UserPlusIcon className="h-4 w-4" /> },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${activeTab===t.key ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border-cyan-400/40' : 'bg-slate-800/40 text-gray-300 border-white/10 hover:bg-slate-700/50'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'manual' && (
        <div role="tabpanel" aria-label="Manual Entry" className="space-y-2">
          <ManualEntryForm showHeading={true} />
        </div>
      )}

      {activeTab === 'visitorEntry' && (
        <div role="tabpanel" aria-label="Visitor Entry" className="space-y-2">
          <div className="font-semibold">Visitor Registration</div>
          <form className="grid grid-cols-1 md:grid-cols-5 gap-2" onSubmit={createVisitor}>
            <input className="input" placeholder="Name" value={visitor.name} onChange={(e) => setVisitor({ ...visitor, name: e.target.value })} required />
            <input className="input" placeholder="Vehicle No" value={visitor.vehicleNo} onChange={(e) => setVisitor({ ...visitor, vehicleNo: e.target.value })} />
            {/* Purpose dropdown with icons */}
            <div className="relative" ref={visitorPurposeRef}>
              <button
                type="button"
                className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-sm ${visitor.purpose ? 'text-gray-100' : 'text-gray-400'} hover:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50`}
                onClick={() => setVisitorPurposeOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={visitorPurposeOpen}
              >
                <span className="inline-flex items-center gap-2">
                  {visitor.purpose === 'Food Delivery' && <UtensilsCrossed className="h-4 w-4" />}
                  {visitor.purpose === 'Courier' && <PackageIcon className="h-4 w-4" />}
                  {visitor.purpose === 'Guest' && <UsersIcon className="h-4 w-4" />}
                  {visitor.purpose === 'Other' && <MoreHorizontal className="h-4 w-4" />}
                  <span>{visitor.purpose === 'Other' ? (visitorCustomPurpose || 'Other') : (visitor.purpose || 'Purpose')}</span>
                </span>
                <svg className={`h-4 w-4 transition ${visitorPurposeOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"/></svg>
              </button>
              {visitorPurposeOpen && (
                <div role="menu" className="absolute z-50 mt-1 w-full rounded-lg bg-gray-900/95 border border-white/10 shadow-xl overflow-hidden">
                  {[
                    { label: 'Food Delivery', icon: UtensilsCrossed },
                    { label: 'Courier', icon: PackageIcon },
                    { label: 'Guest', icon: UsersIcon },
                    { label: 'Other', icon: MoreHorizontal },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = visitor.purpose === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        className={`w-full text-left px-3 py-2 text-sm inline-flex items-center gap-2 hover:bg-white/10 ${active ? 'bg-white/5 text-white' : 'text-gray-200'}`}
                        onClick={() => { setVisitor({ ...visitor, purpose: opt.label }); setVisitorPurposeOpen(false); }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {visitor.purpose === 'Other' && (
              <input
                className="input md:col-span-2"
                placeholder="Type custom purpose"
                value={visitorCustomPurpose}
                onChange={(e) => setVisitorCustomPurpose(e.target.value)}
              />
            )}
            <div className="md:col-span-5 flex items-center justify-center">
              {!visitorCamOn ? (
                <GradientButton
                  color="teal"
                  size="md"
                  type="button"
                  onClick={startVisitorCamera}
                  icon={<CameraIcon className="h-5 w-5" />}
                  className="w-full max-w-sm justify-center"
                >
                  Open Camera
                </GradientButton>
              ) : (
                <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-200 text-sm w-full max-w-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Camera active
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="visitor-photos"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onVisitorPhotosPicked}
              />
              <GradientButton
                color="indigo"
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => {
                  try { document.getElementById('visitor-photos')?.click(); } catch {}
                }}
              >
                Upload Photos (max 3)
              </GradientButton>
            </div>
            {(!visitorCamOn || (Array.isArray(visitorPhotos) && visitorPhotos.length > 0)) ? (
              <GradientButton color="teal" type="submit" icon={<UserPlusIcon className="h-4 w-4" />}>Add Visitor</GradientButton>
            ) : (
              <div className="text-xs text-gray-400 self-center">Capture a photo to enable</div>
            )}
            {Array.isArray(visitorPhotoPreviews) && visitorPhotoPreviews.length > 0 && (
              <div className="col-span-1 md:col-span-5 flex flex-wrap items-start gap-3">
                {visitorPhotoPreviews.map((src, idx) => (
                  <div key={src} className="flex flex-col items-center gap-2">
                    <img src={src} alt={`Visitor preview ${idx + 1}`} className="h-24 w-24 rounded-lg border border-white/10 object-cover" />
                    <div className="text-[11px] text-gray-400">~{visitorPhotos?.[idx] ? Math.ceil(visitorPhotos[idx].size / 1024) : '?'} KB</div>
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded bg-slate-800/60 border border-white/10 text-gray-200 hover:bg-slate-700/60"
                      onClick={() => removeVisitorPhotoAt(idx)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex-1 min-w-[180px]">
                  <div className="text-xs text-gray-400 mt-1">Selected {visitorPhotoPreviews.length}/3 photos</div>
                  <div className="mt-2">
                    <GradientButton color="rose" type="button" variant="outline" onClick={() => setVisitorPhotos([])}>
                      Clear Photos
                    </GradientButton>
                  </div>
                </div>
              </div>
            )}
          </form>
          {visitorCamOn && (
            <div className="mt-3" ref={visitorCameraWrapRef}>
              <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
                <video
                  ref={visitorVideoRef}
                  className="w-full aspect-[3/4] sm:aspect-[4/5] object-cover rounded-2xl border border-white/10 shadow-lg shadow-black/30 bg-black/20"
                  playsInline
                  muted
                />
                {/* Bottom control bar (centered + easy to tap) */}
                <div className="absolute inset-x-0 bottom-0 p-3 pt-10 rounded-b-2xl bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                  <div className="flex items-center justify-center gap-3">
                    <GradientButton
                      color="teal"
                      size="lg"
                      type="button"
                      onClick={captureVisitorPhoto}
                      icon={<CameraIcon className="h-5 w-5" />}
                      className="min-w-[180px] justify-center"
                    >
                      Capture Photo
                    </GradientButton>
                    <GradientButton
                      color="rose"
                      size="lg"
                      type="button"
                      variant="outline"
                      onClick={stopVisitorCamera}
                      className="min-w-[110px] justify-center"
                    >
                      Close
                    </GradientButton>
                  </div>
                  <div className="mt-2 text-center text-[11px] text-gray-200/80">
                    Keep face/ID clearly visible • Tap Capture
                  </div>
                </div>
              </div>
            </div>
          )}
          <RecentVisitors limit={3} />
        </div>
      )}

      {activeTab === 'students' && (
        <div role="tabpanel" aria-label="Student Logs" className="space-y-3">
          <details className="group rounded-xl border border-white/10 bg-slate-800/30 backdrop-blur">
            <summary className="cursor-pointer list-none select-none px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20 border border-violet-400/20 text-violet-200">
                  <EditIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-100">Manual Entry</div>
                  <div className="text-xs text-gray-400 truncate">Check in/out using SID or PIN when QR isn’t available</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-gray-300 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 sm:px-4 pb-4">
              <ManualEntryForm showHeading={false} className="pt-1" />
            </div>
          </details>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div>
              <label className="text-sm">From</label>
              <input type="datetime-local" className="input" value={date.from} onChange={(e) => setDate({ ...date, from: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">To</label>
              <input type="datetime-local" className="input" value={date.to} onChange={(e) => setDate({ ...date, to: e.target.value })} />
            </div>
              <div className="flex flex-wrap gap-2">
              <GradientButton color="teal" onClick={load} title="Filter logs" icon={<FilterIcon className="h-4 w-4" />}>Filter</GradientButton>
              <GradientButton color="amber" variant="outline" onClick={() => load()} title="Refresh now" icon={<RefreshIcon className="h-4 w-4" />}>Refresh</GradientButton>
              <GradientButton color="indigo" onClick={() => exportFile('pdf', 'students')} icon={<DownloadIcon className="h-4 w-4" />}>PDF</GradientButton>
              <GradientButton color="indigo" variant="outline" onClick={() => exportFile('docx', 'students')} icon={<DownloadIcon className="h-4 w-4" />}>DOCX</GradientButton>
            </div>
          </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">Show:</span>
              {[
                { key: 'all', label: 'All' },
                { key: 'check-in', label: 'Check In' },
                { key: 'check-out', label: 'Check Out' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLogActionFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    logActionFilter === opt.key
                      ? 'bg-cyan-500/80 border-cyan-300 text-white shadow-sm'
                      : 'bg-slate-800/60 border-white/10 text-gray-300 hover:bg-slate-700/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
            <div className="text-xs sm:text-sm text-gray-400">
              Showing <span className="font-medium text-gray-200">{displayedLogs.length}</span>
              {logs.length > 50 && !showAllLogs && <> of <span className="font-medium">{logs.length}</span></>}
              {logs.length > 50 && !showAllLogs && <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest</span>}
              {showAllLogs && logs.length > 50 && <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>}
            </div>
            {logs.length > 50 && (
              <div className="flex gap-2">
                {!showAllLogs && (
                  <button
                    type="button"
                    onClick={() => setShowAllLogs(true)}
                    className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
                  >
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
                    Show More
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{logs.length - 50}</span>
                  </button>
                )}
                {showAllLogs && (
                  <button
                    type="button"
                    onClick={() => setShowAllLogs(false)}
                    className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-violet-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                  >
                    Show Less
                  </button>
                )}
              </div>
            )}
          </div>
          <DataTable maxHeight={"60vh"} columns={[
            { key: 'registrationNo', title: 'Reg No' },
            { key: 'name', title: 'Name' },
            { key: 'branch', title: 'Branch' },
            { key: 'batchYear', title: 'Batch' },
            { key: 'action', title: 'Action' },
            { key: 'purpose', title: 'Purpose' },
            { key: 'checkInTime', title: 'Check-in', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
            { key: 'checkOutTime', title: 'Check-out', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
          ]} data={displayedLogs} />
        </div>
      )}

      {activeTab === 'visitors' && (
        <div role="tabpanel" aria-label="Visitor Logs" className="overflow-auto">
          <VisitorList />
        </div>
      )}
    </div>
  )}

  {/* Mobile sticky footer tabs */}
  {!blocked && (
    <div
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-900/85 backdrop-blur-md border-t border-white/10 shadow-[0_-8px_16px_rgba(0,0,0,0.35)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4 h-16">
        {[
          { key: 'students', label: 'Students', icon: <ListIcon className="h-5 w-5" /> },
          { key: 'visitors', label: 'Visitors', icon: <UsersIcon className="h-5 w-5" /> },
          { key: 'manual', label: 'Manual', icon: <EditIcon className="h-5 w-5" /> },
          { key: 'visitorEntry', label: 'Add Visitor', icon: <UserPlusIcon className="h-5 w-5" /> },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            aria-label={t.label}
            onClick={() => setActiveTab(t.key)}
            className={`relative flex flex-col items-center justify-center gap-1 h-16 text-sm font-medium ${activeTab===t.key ? 'text-white' : 'text-gray-300'} focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50`}
          >
            <span className={`absolute inset-x-8 top-0 h-1 rounded-full ${activeTab===t.key ? 'bg-gradient-to-r from-cyan-400 to-violet-400' : 'bg-transparent'}`} />
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )}
    </div>
  
  {previewOpen && lastStudent && createPortal(
    (
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
        <div className="absolute inset-0 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="relative w-[88vw] max-w-xl rounded-2xl shadow-2xl border border-white/10 bg-gray-900/95 text-gray-100 animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setPreviewOpen(false); setCameraOn(false); }}
              aria-label="Close"
              className="group absolute top-2 right-2"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/40 to-sky-500/40 blur-md opacity-0 group-hover:opacity-100 transition" />
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/90 text-white border border-white/10 shadow-lg ring-1 ring-white/10 hover:scale-105 transition">
                <XIcon className="h-5 w-5" />
              </span>
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
              <div className="p-3 sm:p-4 flex items-center justify-center bg-gray-800/60">
                <img
                  src={lastStudent.profilePhotoUrl || lastStudent.profilePhotoThumbUrl || 'https://placehold.co/512x512?text=No+Photo'}
                  alt="Student"
                  className="w-full max-w-[360px] aspect-square object-cover rounded-xl border border-white/10"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <div className="p-3 sm:p-4 space-y-1.5 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-lg font-semibold">Student Details</div>
                  {previewMeta?.action && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${previewMeta.action === 'check-in' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-sky-500/15 text-sky-300 border border-sky-400/20'}`}>
                      {previewMeta.action === 'check-in' ? 'Checked in' : 'Checked out'}
                    </span>
                  )}
                </div>
                {previewMeta?.time && (
                  <div className="text-[12px] text-gray-400 -mt-1">{new Date(previewMeta.time).toLocaleString()}</div>
                )}
                {previewMeta?.purpose && (
                  <div className="text-[12px] text-gray-300">Purpose: <span className="font-medium">{previewMeta.purpose}</span></div>
                )}
                <div className="text-[12px] text-gray-300">
                  Current status: <span className="font-medium">{previewMeta.action === 'check-in' ? 'Inside campus' : 'Outside campus'}</span>
                </div>
                {(previewMeta?.action === 'check-out' && previewMeta?.prevAction === 'check-out') && (
                  <div className="mt-1 text-[12px] text-amber-200 bg-amber-500/10 border border-amber-400/40 rounded px-2 py-1">
                    Warning: This student was checked out twice in a row without a check in between. Please verify.
                  </div>
                )}
                {(previewMeta?.action === 'check-in' && previewMeta?.prevAction === 'check-in') && (
                  <div className="mt-1 text-[12px] text-amber-200 bg-amber-500/10 border border-amber-400/40 rounded px-2 py-1">
                    Warning: This student was checked in twice in a row without a check out in between. Please verify.
                  </div>
                )}
                {previewMeta?.prevAction && previewMeta?.prevTime && (
                  <div className="text-[12px] text-gray-400">Previous: {previewMeta.prevAction} at {new Date(previewMeta.prevTime).toLocaleString()}</div>
                )}
                <div><span className="text-gray-400">Name:</span> <span className="font-medium">{lastStudent.name || '-'}</span></div>
                <div><span className="text-gray-400">Reg No:</span> <span className="font-medium">{lastStudent.registrationNo}</span></div>
                <div><span className="text-gray-400">Branch:</span> <span className="font-medium">{lastStudent.branch || '-'}</span></div>
                <div><span className="text-gray-400">Batch:</span> <span className="font-medium">{lastStudent.batchYear || '-'}</span></div>
                <div><span className="text-gray-400">SID:</span> <span className="font-medium">{lastStudent.studentUid || '-'}</span></div>

                {/* Recent history toggle */}
                <div className="pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md bg-gray-700/60 px-3 py-1.5 text-xs text-gray-100 border border-white/10 hover:bg-gray-700/80"
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? 'Hide history' : 'View recent history'}
                  </button>
                </div>
                {showHistory && (
                  <div className="mt-2 max-h-48 overflow-auto border border-white/10 rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-800/60">
                        <tr>
                          <th className="text-left px-2 py-1">Action</th>
                          <th className="text-left px-2 py-1">Purpose</th>
                          <th className="text-left px-2 py-1">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.filter((l) => l.registrationNo === previewMeta.registrationNo).slice(0, 8).map((l) => {
                          const t = l.timestamp || l.checkInTime || l.checkOutTime;
                          return (
                            <tr key={l._id} className="border-t border-white/10">
                              <td className="px-2 py-1 capitalize">{l.action}</td>
                              <td className="px-2 py-1">{l.purpose || '-'}</td>
                              <td className="px-2 py-1">{t ? new Date(t).toLocaleString() : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    document.body
  )}
  {/* Banned/Deleted ID popup */}
  {banOpen && createPortal(
    (
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setBanOpen(false)} />
        <div className="absolute inset-0 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="relative w-[88vw] max-w-md rounded-2xl shadow-2xl border border-rose-400/30 bg-gray-900/95 text-gray-100 animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setBanOpen(false)} aria-label="Close" className="group absolute top-2 right-2">
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/90 text-white border border-white/10 shadow-lg ring-1 ring-white/10 hover:scale-105 transition">
                <XIcon className="h-5 w-5" />
              </span>
            </button>
            <div className="p-5">
              <div className="flex items-center gap-2 text-rose-300">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5zM10 14.5a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                <div className="text-lg font-semibold">Deleted/Banned ID</div>
              </div>
              <div className="mt-2 text-sm text-gray-300">This QR/PIN is not valid. The student may have been deleted or is not approved.</div>
              {(banMeta.sid || banMeta.pin) && (
                <div className="mt-3 text-sm">
                  {banMeta.sid && (<div><span className="text-gray-400">SID:</span> <span className="font-mono">{banMeta.sid}</span></div>)}
                  {banMeta.pin && (<div><span className="text-gray-400">PIN:</span> <span className="font-mono">{banMeta.pin}</span></div>)}
                </div>
              )}
              <div className="mt-4">
                <button type="button" onClick={() => setBanOpen(false)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-rose-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    document.body
  )}
  </>
  );
}

function sortVisitorsByTime(list) {
  if (!Array.isArray(list)) return [];
  const getTime = (v) => new Date(v.exitTime || v.entryTime || v.createdAt || 0).getTime();
  return [...list].sort((a, b) => getTime(b) - getTime(a));
}

function RecentVisitors({ limit = 3 }) {
  const [items, setItems] = useState([]);

  const loadVisitors = async () => {
    try {
      const res = await api.get('/visitors');
      const sorted = sortVisitorsByTime(res.data);
      setItems(sorted.slice(0, limit));
    } catch {
      const cached = await offline.loadVisitors().catch(() => []);
      const sorted = sortVisitorsByTime(cached);
      setItems(sorted.slice(0, limit));
    }
  };

  useEffect(() => { loadVisitors(); }, []);
  useEffect(() => {
    const on = () => setTimeout(() => { loadVisitors().catch(() => {}); }, 600);
    window.addEventListener('online', on);
    window.addEventListener('refresh-visitors', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('refresh-visitors', on);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm text-gray-200">Recent Visitors</div>
        <div className="text-[11px] text-gray-400">Last {Math.min(limit, items.length)} entries</div>
      </div>
      <DataTable
        maxHeight={"26vh"}
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'vehicleNo', title: 'Vehicle' },
          { key: 'purpose', title: 'Purpose' },
          { key: 'entryTime', title: 'Entry', render: (v) => (v ? new Date(v).toLocaleTimeString() : '-') },
        ]}
        data={items}
      />
    </div>
  );
}

function VisitorList() {
  const [items, setItems] = useState([]);
  const [showAllVisitors, setShowAllVisitors] = useState(false);
  const loadVisitors = async () => {
    try {
      const res = await api.get('/visitors');
      // Keep only latest 200 for security dashboard view performance
      const pruned = (() => {
        const sorted = sortVisitorsByTime(res.data);
        return sorted.slice(0, 200);
      })();
      setItems(pruned);
      offline.saveVisitors(pruned).catch(() => {}); // store only pruned subset locally
    } catch {
      const cached = await offline.loadVisitors().catch(() => []);
      if (cached.length) {
        const sorted = sortVisitorsByTime(cached);
        setItems(sorted.slice(0, 200));
      } else {
        setItems([]);
      }
    }
  };
  useEffect(() => { loadVisitors(); }, []);
  // Auto-refresh visitors when back online
  useEffect(() => {
    const on = () => setTimeout(() => { loadVisitors().catch(() => {}); }, 600);
    window.addEventListener('online', on);
    window.addEventListener('refresh-visitors', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('refresh-visitors', on);
    };
  }, []);
  const markExit = async (id) => {
    const exitTime = new Date().toISOString();
    if (!navigator.onLine) {
      await offline.queueAction({ type: 'visitor:exit', payload: { id, exitTime } });
      // Optimistic update for better UX
      setItems((prev) => prev.map((v) => (v._id === id ? { ...v, exitTime } : v)));
      return;
    }
    await api.patch(`/visitors/${id}/exit`, { exitTime });
    try {
      await loadVisitors();
    } catch {
      // keep existing list
    }
  };
  const displayedVisitors = React.useMemo(() => {
    if (showAllVisitors) return items; // items already pruned to 200; if full list is ever desired beyond 200 we'd fetch differently
    return items.slice(0, 50); // show latest 50 first similar to student logs
  }, [items, showAllVisitors]);
  return (
    <div>
      <div className="font-semibold mb-2">Visitor Logs</div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div className="text-xs sm:text-sm text-gray-400">
          Showing <span className="font-medium text-gray-200">{displayedVisitors.length}</span>
          {items.length > 50 && !showAllVisitors && <> of <span className="font-medium">{items.length}</span></>}
          {items.length === 200 && <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest 200</span>}
          {showAllVisitors && items.length > 50 && <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>}
        </div>
        {items.length > 50 && (
          <div className="flex gap-2">
            {!showAllVisitors && (
              <button
                type="button"
                onClick={() => setShowAllVisitors(true)}
                className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
                Show More
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{items.length - 50}</span>
              </button>
            )}
            {showAllVisitors && (
              <button
                type="button"
                onClick={() => setShowAllVisitors(false)}
                className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-violet-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
              >
                Show Less
              </button>
            )}
          </div>
        )}
      </div>
  <DataTable maxHeight={"50vh"} columns={[
        { key: 'name', title: 'Name' },
        { key: 'vehicleNo', title: 'Vehicle' },
        { key: 'purpose', title: 'Purpose' },
        { key: 'entryTime', title: 'Entry', render: (v) => new Date(v).toLocaleString() },
        { key: 'exitTime', title: 'Exit', render: (v, row) => row.exitTime ? new Date(row.exitTime).toLocaleString() : (<GradientButton size="xs" color="rose" onClick={() => markExit(row._id)} icon={<ExitIcon className="h-3 w-3" />}>Mark Exit</GradientButton>) },
      ]} data={displayedVisitors} />
    </div>
  );
}

// Reusable purpose selector replacing traditional dropdown for check-out
function PurposeSelector({ label = 'Purpose', value, onChange, otherValue, onOtherChange, layout = 'row' }) {
  const purposes = [
    { key: 'fooding', label: 'Fooding', color: 'emerald', icon: UtensilsCrossed, description: 'Meal outside campus' },
    { key: 'marketing', label: 'Marketing', color: 'sky', icon: ShoppingCart, description: 'Purchase / market visit' },
    { key: 'medicine', label: 'Medicine', color: 'rose', icon: Pill, description: 'Medical / pharmacy' },
    { key: 'home', label: 'Home', color: 'amber', icon: HomeIcon, description: 'Going home' },
    { key: 'other', label: 'Other', color: 'violet', icon: MoreHorizontal, description: 'Custom reason' },
  ];
  const colorMap = {
    emerald: { base: 'bg-emerald-600/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/25', active: 'bg-emerald-500/90 text-white shadow-inner border-emerald-300/60' },
    sky: { base: 'bg-sky-600/15 text-sky-300 border-sky-500/30 hover:bg-sky-600/25', active: 'bg-sky-500/90 text-white shadow-inner border-sky-300/60' },
    rose: { base: 'bg-rose-600/15 text-rose-300 border-rose-500/30 hover:bg-rose-600/25', active: 'bg-rose-500/90 text-white shadow-inner border-rose-300/60' },
    amber: { base: 'bg-amber-600/15 text-amber-300 border-amber-500/30 hover:bg-amber-600/25', active: 'bg-amber-500/90 text-white shadow-inner border-amber-300/60' },
    violet: { base: 'bg-violet-600/15 text-violet-300 border-violet-500/30 hover:bg-violet-600/25', active: 'bg-violet-500/90 text-white shadow-inner border-violet-300/60' },
  };
  return (
    <div>
      {label && <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</div>}
      <div className={`flex ${layout==='row' ? 'flex-row flex-wrap gap-2' : 'flex-col gap-2'} max-w-xl`} role="radiogroup" aria-label={label}>
        {purposes.map(p => {
          const Icon = p.icon;
          const active = value === p.key;
          const colors = colorMap[p.color];
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(p.key)}
              className={`group relative px-3 py-2 rounded-lg border text-[12px] font-medium flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition ${active ? colors.active : colors.base}`}
              title={p.description}
            >
              {active && <span className="absolute inset-0 animate-pulse bg-white/10 rounded-lg pointer-events-none" />}
              <Icon className={`h-4 w-4 ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-90'}`} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
      {value === 'other' && (
        <input
          className="input mt-2"
          placeholder="Type custom purpose"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      )}
    </div>
  );
}
