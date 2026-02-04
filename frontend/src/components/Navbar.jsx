import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  Sun,
  Moon,
  Menu as MenuIcon,
  X as XIcon,
  User as UserIcon,
  Bell as BellIcon,
  LogOut as LogOutIcon,
  Lock as LockIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  KeyRound as KeyIcon,
  Upload as UploadIcon,
  ImagePlus as ImagePlusIcon,
  Check as CheckIcon,
  Camera as CameraIcon,
  LayoutDashboard as DashboardIcon,
  Info as InfoIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import DataTable from './DataTable';
import { authDownload } from '../services/download';
const AdminOverstayModal = lazy(() => import('./AdminOverstayModal'));

export default function Navbar() {
  const { user, logout, refreshUser } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const [countsOpen, setCountsOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [userListOpen, setUserListOpen] = useState(false);
  const [userListRole, setUserListRole] = useState('student');
  const [userList, setUserList] = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', p1: '', p2: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  // Student PIN change state (shown only for students in Edit Profile)
  const [pinForm, setPinForm] = useState({ oldPin: '', newPin: '' });
  const [pinMsg, setPinMsg] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);
  const [idForm, setIdForm] = useState({ name: '', registrationNo: '' });
  const [idMsg, setIdMsg] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoMsg, setPhotoMsg] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  // Camera capture state (for first-time profile photo)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedPreview, setCapturedPreview] = useState(null); // data URL
  const [pwdShow, setPwdShow] = useState({ current: false, p1: false, p2: false });
  const [pinShow, setPinShow] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Overstay Alerts modal state
  const [overstayOpen, setOverstayOpen] = useState(false);
  const [overstays, setOverstays] = useState([]);
  const [overstaysLoading, setOverstaysLoading] = useState(false);
  const [overstaysFilter, setOverstaysFilter] = useState({ from: '', to: '' });
  const [charts, setCharts] = useState({
    currentOutside: { count: 0, avgHours: 0, maxHours: 0, top: [] },
    openResolved: { open: 0, resolved: 0 },
    byHour: [],
    frequent: [],
  });
  const location = useLocation();
  const currentPath = location.pathname;

  const handleLogout = async () => {
    // Ensure no menu/dialog stays visible after auth state changes
    setMenuOpen(false);
    setOpen(false);
    setCountsOpen(false);
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  // Shadow on scroll for stronger separation
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Theme apply
  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.setAttribute('data-theme', theme);
    };
    try {
      apply();
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  // Admin stats polling
  useEffect(() => {
    if (!user || user.role !== 'admin' || !countsOpen) return;
    let stop = false;
    const fetchCounts = async () => {
      try {
        const { data } = await api.get(`/admin/counts`, { params: { approvedOnly } });
        if (!stop) setCounts(data);
      } catch {}
    };
    fetchCounts();
    const id = setInterval(fetchCounts, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [user, countsOpen, approvedOnly]);

  // Notifications
  useEffect(() => {
    if (!user) return;
    (async () => setNotifs((await api.get('/notifications')).data))();
  }, [user]);
  const unread = notifs.filter((n) => !n.read).length;
  const markRead = async () => {
    await api.post('/notifications/read');
    setNotifs((await api.get('/notifications')).data);
  };

  // Student profile (for PIN/profile photo)
  useEffect(() => {
    const load = async () => {
      if (!editOpen || !user || user.role !== 'student') return;
      try {
        const { data } = await api.get('/students/me');
        setStudentProfile(data);
        setIdForm({ name: data?.name || '', registrationNo: data?.registrationNo || '' });
      } catch {
        setStudentProfile(null);
      }
    };
    load();
  }, [editOpen, user]);

  // Keep identity form in sync when profile changes while modal open
  useEffect(() => {
    if (studentProfile) {
      setIdForm({ name: studentProfile.name || '', registrationNo: studentProfile.registrationNo || '' });
    }
  }, [studentProfile]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (editOpen || userListOpen || overstayOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [editOpen, userListOpen, overstayOpen]);

  // Close modals with Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (editOpen) setEditOpen(false);
        if (userListOpen) setUserListOpen(false);
        if (overstayOpen) setOverstayOpen(false);
        if (cameraOpen) closeCamera();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editOpen, userListOpen, overstayOpen, cameraOpen]);

  // Stop camera when component unmounts or camera closed
  useEffect(() => () => { if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); } }, [cameraStream]);

  const startCamera = async () => {
    setCameraError('');
    setCapturedPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 640, facingMode: 'user' } });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (err) {
      setCameraError(err?.message || 'Unable to access camera');
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!cameraStream) return;
    const videoTrack = cameraStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const w = settings.width || 640;
    const h = settings.height || 640;
    const size = Math.min(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('camera-video');
    if (!video) return;
    // Draw center square region scaled into 512x512
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPreview(dataUrl);
  };

  const useCaptured = () => {
    if (!capturedPreview) return;
    fetch(capturedPreview)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        setPhotoFile(file);
        setPhotoMsg('Captured photo ready to upload');
        closeCamera();
      })
      .catch(() => setPhotoMsg('Failed to process captured image'));
  };

  // Admin: fetch users list helper
  const openUsers = async (role) => {
    setCountsOpen(false);
    setMenuOpen(false);
    setUserListRole(role);
    setUserListOpen(true);
    setUserListLoading(true);
    try {
      const { data } = await api.get('/admin/users', { params: { role, approvedOnly } });
      setUserList(data);
    } catch {
      setUserList([]);
    } finally {
      setUserListLoading(false);
    }
  };

  // Refresh users list when filter flips
  useEffect(() => {
    if (user && user.role === 'admin' && userListOpen) {
      openUsers(userListRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedOnly]);

  // Overstay: data loader
  const loadOverstaysAndCharts = async () => {
    if (!user || user.role !== 'admin') return;
    setOverstaysLoading(true);
    try {
      const params = {};
      if (overstaysFilter.from) params.from = overstaysFilter.from;
      if (overstaysFilter.to) params.to = overstaysFilter.to;
      const [os, current, openRes, byHour, frequent] = await Promise.all([
        api.get('/admin/overstays', { params }),
        api.get('/admin/analytics/current-outside-summary', { params }),
        api.get('/admin/analytics/overstays-open-resolved', { params }),
        api.get('/admin/analytics/exits-by-hour', { params }),
        api.get('/admin/analytics/frequent-overstayers', { params }),
      ]);
      setOverstays(os.data || []);
      setCharts({
        currentOutside: current.data || { count: 0, avgHours: 0, maxHours: 0, top: [] },
        openResolved: openRes.data || { open: 0, resolved: 0 },
        byHour: byHour.data || [],
        frequent: frequent.data || [],
      });
    } catch {
      setOverstays([]);
  setCharts({ currentOutside: { count: 0, avgHours: 0, maxHours: 0, top: [] }, openResolved: { open: 0, resolved: 0 }, byHour: [], frequent: [] });
    } finally {
      setOverstaysLoading(false);
    }
  };

  const resolveOverstay = async (id) => {
    try {
      await api.post(`/admin/overstays/${id}/resolve`);
      await loadOverstaysAndCharts();
    } catch {}
  };

  const exportOverstays = async (fmt) => {
    try {
      const params = { type: 'overstays' };
      if (overstaysFilter.from) params.from = overstaysFilter.from;
      if (overstaysFilter.to) params.to = overstaysFilter.to;
      await authDownload(`/api/export/${fmt}`, params, `overstays.${fmt}`);
    } catch {}
  };

  return (
    <nav className={`sticky top-0 z-50 p-3 border-b bg-white/80 text-gray-900 border-gray-200 supports-[backdrop-filter]:bg-white/70 backdrop-blur dark:bg-gray-900/60 dark:text-gray-100 dark:border-white/10 transition-shadow ${scrolled ? 'shadow-md shadow-black/10 dark:shadow-black/20' : ''}`}>
      <div className="flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg">GatePass</Link>
        {/* Mobile actions */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            className="p-2 rounded-md text-sky-700 hover:text-sky-900 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition dark:text-sky-200 dark:hover:text-white dark:hover:bg-sky-400/10"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            className={`p-2 rounded-md ${menuOpen ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-400/10' : 'text-sky-700 dark:text-sky-200'} hover:text-sky-900 hover:bg-sky-100 dark:hover:text-white dark:hover:bg-sky-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            title="Menu"
          >
            {menuOpen ? <XIcon className="h-6 w-6 transition-transform duration-200" /> : <MenuIcon className="h-6 w-6 transition-transform duration-200" />}
          </button>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex gap-3 items-center">
          {user ? (
            <>
              <span className="text-sm hidden md:inline">{user.registrationNo} ({user.role})</span>
              {user.role === 'student' && (
                <div className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-slate-900/80 px-1 py-0.5 shadow-sm shadow-sky-900/40 text-xs">
                  <Link
                    to="/student"
                    className={
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ' +
                      (currentPath === '/student'
                        ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/50'
                        : 'text-slate-200 hover:bg-slate-800/80 hover:text-white')
                    }
                  >
                    <DashboardIcon className="h-3.5 w-3.5" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    to="/about"
                    className={
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ' +
                      (currentPath === '/about'
                        ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/50'
                        : 'text-slate-200 hover:bg-slate-800/80 hover:text-white')
                    }
                  >
                    <InfoIcon className="h-3.5 w-3.5" />
                    <span>About</span>
                  </Link>
                </div>
              )}
              <button
                className="p-2 rounded-md text-sky-700 hover:text-sky-900 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition dark:text-sky-200 dark:hover:text-white dark:hover:bg-sky-400/10"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-sky-700 hover:text-sky-900 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition dark:text-sky-200 dark:hover:text-white dark:hover:bg-sky-400/10"
                onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                title="Edit profile"
              >
                <UserIcon className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
              {canInstall && (
                <button
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30 transition dark:text-emerald-200 dark:hover:text-white dark:hover:bg-emerald-400/10"
                  onClick={async () => {
                    if (!deferredPrompt) return;
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome) setCanInstall(false);
                    setDeferredPrompt(null);
                  }}
                >
                  Install App
                </button>
              )}
              {user.role === 'admin' && (
                <div className="relative">
                  <button
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-md ${countsOpen ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-400/10' : 'text-sky-700 dark:text-sky-200'} hover:text-sky-900 hover:bg-sky-100 dark:hover:text-white dark:hover:bg-sky-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition`}
                    onClick={async () => {
                      setCountsOpen(!countsOpen);
                    }}
                    aria-expanded={countsOpen}
                  >
                    Stats
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-amber-700 hover:text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 transition dark:text-amber-200 dark:hover:text-white dark:hover:bg-amber-400/10 ml-2"
                    onClick={async () => { setOverstayOpen(true); setMenuOpen(false); await loadOverstaysAndCharts(); }}
                    title="Overstay Alerts"
                  >
                    Overstay Alerts
                  </button>
                  {countsOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded shadow-xl p-2 text-sm animate-scale-in bg-white text-gray-900 border border-gray-200 dark:bg-gray-900/95 dark:text-gray-100 dark:border-white/10 z-50">
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                          <input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />
                          Approved only
                        </label>
                        {counts && <span className="text-xs text-gray-500">auto</span>}
                      </div>
                      {!counts ? (
                        <div className="text-gray-500 dark:text-gray-400">Loading…</div>
                      ) : (
                        <ul className="space-y-1">
                          <li>
                            <button className="w-full flex justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1" onClick={() => openUsers('student')}>
                              <span>Total Students</span>
                              <span className="font-semibold">{counts.students}</span>
                            </button>
                          </li>
                          <li>
                            <button className="w-full flex justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1" onClick={() => openUsers('security')}>
                              <span>Total Security</span>
                              <span className="font-semibold">{counts.security}</span>
                            </button>
                          </li>
                          <li>
                            <button className="w-full flex justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1" onClick={() => openUsers('admin')}>
                              <span>Total Admins</span>
                              <span className="font-semibold">{counts.admins}</span>
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="relative">
                <button
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-md ${open ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-400/10' : 'text-sky-700 dark:text-sky-200'} hover:text-sky-900 hover:bg-sky-100 dark:hover:text-white dark:hover:bg-sky-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 transition`}
                  onClick={() => {
                    setOpen(!open);
                    if (open === false) markRead();
                  }}
                  aria-expanded={open}
                  aria-haspopup="menu"
                >
                  <BellIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Notifications</span>
                  {unread > 0 && <span className="ml-1 bg-red-600 text-white rounded px-1 text-xs">{unread}</span>}
                </button>
                {open && (
                  <div className="absolute right-0 mt-2 w-72 rounded shadow-xl p-2 max-h-64 overflow-auto animate-scale-in bg-white text-gray-900 border border-gray-200 dark:bg-gray-900/95 dark:text-gray-100 dark:border-white/10 z-50">
                    {notifs.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">No notifications</div>}
                    {notifs.map((n) => (
                      <div key={n._id} className="text-sm border-b py-1">
                        {n.message}
                        <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-rose-700 hover:text-rose-900 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30 transition dark:text-rose-200 dark:hover:text-white dark:hover:bg-rose-400/10"
                onClick={handleLogout}
              >
                <LogOutIcon className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Signup</Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 dark:bg-gradient-to-b dark:from-gray-900/70 dark:to-black/70 backdrop-blur-sm animate-fade-in md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="md:hidden mt-2 space-y-3 rounded-lg p-4 shadow-2xl border border-gray-200 bg-white text-gray-900 animate-scale-in dark:border-white/10 dark:bg-gray-800/95 dark:text-gray-100">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sky-700 dark:text-sky-300">Menu</div>
              <button
                className="p-2 rounded-md text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30 transition dark:text-emerald-300 dark:hover:text-white dark:hover:bg-emerald-400/10"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                title="Close"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            {user ? (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-300 -mt-1">{user.registrationNo} ({user.role})</div>
                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                  onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                  style={{ animationDelay: '60ms' }}
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Edit Profile</span>
                </button>
                {user.role === 'student' && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Link
                      className={
                        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm border transition-colors ' +
                        (currentPath === '/student'
                          ? 'bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-500/40'
                          : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80')
                      }
                      to="/student"
                      onClick={() => setMenuOpen(false)}
                      style={{ animationDelay: '80ms' }}
                    >
                      <DashboardIcon className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      className={
                        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm border transition-colors ' +
                        (currentPath === '/about'
                          ? 'bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-500/40'
                          : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80')
                      }
                      to="/about"
                      onClick={() => setMenuOpen(false)}
                      style={{ animationDelay: '100ms' }}
                    >
                      <InfoIcon className="h-4 w-4" />
                      <span>About</span>
                    </Link>
                  </div>
                )}
                {user.role === 'admin' && (
                  <div>
                    <button
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                      onClick={() => setCountsOpen((v) => !v)}
                      style={{ animationDelay: '100ms' }}
                    >
                      Stats
                    </button>
                    <button
                      className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                      onClick={async () => { setMenuOpen(false); setOverstayOpen(true); await loadOverstaysAndCharts(); }}
                      style={{ animationDelay: '120ms' }}
                    >
                      Overstay Alerts
                    </button>
                    {countsOpen && (
                      <div className="mt-2 w-full bg-white rounded shadow-lg p-2 text-sm animate-scale-in text-gray-900 border border-gray-200 dark:bg-gray-900/90 dark:text-gray-100 dark:border-white/10 z-50">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                            <input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />
                            Approved only
                          </label>
                          {counts && <span className="text-xs text-gray-500">auto</span>}
                        </div>
                        {!counts ? (
                          <div className="text-gray-500 dark:text-gray-400">Loading…</div>
                        ) : (
                          <ul className="space-y-1">
                            <li>
                              <button className="w-full flex justify-between hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1" onClick={() => openUsers('student')}>
                                <span>Total Students</span>
                                <span className="font-semibold">{counts.students}</span>
                              </button>
                            </li>
                            <li>
                              <button className="w-full flex justify-between hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1" onClick={() => openUsers('security')}>
                                <span>Total Security</span>
                                <span className="font-semibold">{counts.security}</span>
                              </button>
                            </li>
                            <li>
                              <button className="w-full flex justify-between hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1" onClick={() => openUsers('admin')}>
                                <span>Total Admins</span>
                                <span className="font-semibold">{counts.admins}</span>
                              </button>
                            </li>
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                  onClick={() => {
                    setOpen((v) => !v);
                    if (!open) markRead();
                  }}
                  style={{ animationDelay: '140ms' }}
                >
                  <BellIcon className="h-4 w-4" />
                  <span>Notifications</span>
                  {unread > 0 && <span className="ml-1 bg-red-600 text-white rounded px-1 text-xs">{unread}</span>}
                </button>
                {open && (
                  <div className="w-full bg-white rounded shadow-lg p-2 max-h-64 overflow-auto animate-scale-in text-gray-900 border border-gray-200 dark:bg-gray-900/90 dark:text-gray-100 dark:border-white/10 z-50">
                    {notifs.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">No notifications</div>}
                    {notifs.map((n) => (
                      <div key={n._id} className="text-sm border-b py-1">
                        {n.message}
                        <div className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                  onClick={handleLogout}
                  style={{ animationDelay: '180ms' }}
                >
                  <LogOutIcon className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div className="flex gap-3">
                <Link
                  className="flex-1 text-center rounded-md px-3 py-2 bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  className="flex-1 text-center rounded-md px-3 py-2 bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 transition dark:bg-gray-700/60 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/80"
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                >
                  Signup
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* Users modal */}
      {user && user.role === 'admin' && userListOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setUserListOpen(false)} />
            <div className="relative glass rounded shadow-xl w-[90vw] max-w-3xl max-h-[80vh] p-4 overflow-auto animate-scale-in text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold capitalize">{userListRole} list {approvedOnly ? '(approved)' : ''}</div>
                <button className="btn" onClick={() => setUserListOpen(false)}>
                  Close
                </button>
              </div>
              {userListLoading ? (
                <div className="text-gray-500">Loading…</div>
              ) : (
                <DataTable
                  columns={
                    userListRole === 'student'
                      ? [
                          { key: 'registrationNo', title: 'Reg No' },
                          { key: 'name', title: 'Name' },
                          { key: 'branch', title: 'Branch' },
                          { key: 'batchYear', title: 'Batch' },
                          { key: 'isApproved', title: 'Approved', render: (v) => (v ? 'Yes' : 'No') },
                        ]
                      : [
                          { key: 'registrationNo', title: 'Identifier' },
                          { key: 'name', title: 'Name' },
                          { key: 'isApproved', title: 'Approved', render: (v) => (v ? 'Yes' : 'No') },
                        ]
                  }
                  data={userList}
                />
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Overstay Alerts modal */}
      {user && user.role === 'admin' && overstayOpen && createPortal(
        <Suspense fallback={<div className="fixed inset-0 z-[9999] flex items-center justify-center"><div className="p-3 rounded bg-gray-900/80 text-white border border-white/10">Loading…</div></div>}>
          <AdminOverstayModal
            charts={charts}
            overstays={overstays}
            overstaysFilter={overstaysFilter}
            setOverstaysFilter={setOverstaysFilter}
            overstayOpen={overstayOpen}
            setOverstayOpen={setOverstayOpen}
            exportOverstays={exportOverstays}
            loadOverstaysAndCharts={loadOverstaysAndCharts}
            overstaysLoading={overstaysLoading}
            resolveOverstay={resolveOverstay}
          />
        </Suspense>,
        document.body
      )}

      {/* Edit Profile modal */}
      {user && editOpen &&
        createPortal(
          (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setEditOpen(false)} />
              <div className="relative w-[92vw] max-w-md max-h-[85vh] overflow-y-auto overscroll-contain scrollbar-thin p-4 sm:p-5 rounded-lg shadow-2xl border border-white/10 bg-gray-800/95 text-gray-100 animate-scale-in text-[14px] sm:text-[15px] md:text-base transform-gpu origin-top max-[400px]:scale-[.94] max-[360px]:scale-[.9]">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <UserIcon className="h-5 w-5 text-sky-300" />
                    Edit Profile
                  </div>
                  <button
                    className="p-2 rounded-md text-emerald-300 hover:text-white hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30 transition"
                    onClick={() => setEditOpen(false)}
                    aria-label="Close"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 sm:space-y-5">
                  {/* Change password */}
                  <div>
                    <div className="font-semibold mb-1">Change Password</div>
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setPwdMsg('');
                        try {
                          if (!pwdForm.current || !pwdForm.p1 || !pwdForm.p2) throw new Error('All fields are required');
                          if (pwdForm.p1.length < 6) throw new Error('Password must be at least 6 characters');
                          if (pwdForm.p1 !== pwdForm.p2) throw new Error('Passwords do not match');
                          await api.post('/auth/change-password', {
                            currentPassword: pwdForm.current,
                            newPassword: pwdForm.p1,
                          });
                          setPwdForm({ current: '', p1: '', p2: '' });
                          setPwdMsg('Password changed successfully');
                        } catch (err) {
                          setPwdMsg(err?.response?.data?.message || err.message || 'Failed to change password');
                        }
                      }}
                    >
                      <div className="relative">
                        <LockIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-300/90 drop-shadow-sm" />
                        <input
                          className="input !pl-12 !pr-12 text-sm placeholder:text-gray-400"
                          type={pwdShow.current ? 'text' : 'password'}
                          placeholder="Current password"
                          value={pwdForm.current}
                          onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300/90 hover:text-white"
                          onClick={() => setPwdShow((s) => ({ ...s, current: !s.current }))}
                          aria-label="Toggle password visibility"
                        >
                          {pwdShow.current ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      <div className="relative">
                        <LockIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-300/90 drop-shadow-sm" />
                        <input
                          className="input !pl-12 !pr-12 text-sm placeholder:text-gray-400"
                          type={pwdShow.p1 ? 'text' : 'password'}
                          placeholder="New password"
                          value={pwdForm.p1}
                          onChange={(e) => setPwdForm({ ...pwdForm, p1: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300/90 hover:text-white"
                          onClick={() => setPwdShow((s) => ({ ...s, p1: !s.p1 }))}
                          aria-label="Toggle password visibility"
                        >
                          {pwdShow.p1 ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      <div className="relative">
                        <LockIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-300/90 drop-shadow-sm" />
                        <input
                          className="input !pl-12 !pr-12 text-sm placeholder:text-gray-400"
                          type={pwdShow.p2 ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          value={pwdForm.p2}
                          onChange={(e) => setPwdForm({ ...pwdForm, p2: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300/90 hover:text-white"
                          onClick={() => setPwdShow((s) => ({ ...s, p2: !s.p2 }))}
                          aria-label="Toggle password visibility"
                        >
                          {pwdShow.p2 ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      <button className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 w-fit">
                        <CheckIcon className="h-4 w-4" />
                        Save
                      </button>
                      {pwdMsg && (
                        <div className={`text-sm ${pwdMsg.includes('success') ? 'text-green-400' : 'text-rose-400'}`}>{pwdMsg}</div>
                      )}
                    </form>
                  </div>

                  {/* Student-only sections */}
                  {user && user.role === 'student' && (
                    <div>
                      <div className="font-semibold mb-1">Identity (pre-approval)</div>
                      {studentProfile?.isApproved ? (
                        <div className="text-sm text-emerald-400 mb-2">Identity is locked after approval. Contact admin for changes.</div>
                      ) : (
                        <div className="text-sm text-gray-400 mb-2">You can edit your name and registration number until your account is approved.</div>
                      )}
                      <form
                        className="flex flex-col gap-3 mb-4"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setIdMsg('');
                          try {
                            if (studentProfile?.isApproved) throw new Error('Already approved');
                            const payload = {};
                            if (idForm.name && idForm.name !== studentProfile?.name) payload.name = idForm.name;
                            if (idForm.registrationNo && idForm.registrationNo !== studentProfile?.registrationNo) payload.registrationNo = idForm.registrationNo;
                            if (Object.keys(payload).length === 0) {
                              setIdMsg('No changes to save');
                              return;
                            }
                            await api.patch('/students/draft', payload);
                            const { data } = await api.get('/students/me');
                            setStudentProfile(data);
                            // Refresh topbar user (registrationNo) as well
                            try { await refreshUser?.(); } catch {}
                            setIdMsg('Saved');
                          } catch (err) {
                            setIdMsg(err?.response?.data?.message || err.message || 'Failed to save');
                          }
                        }}
                      >
                        <input
                          className="input"
                          placeholder="Full name"
                          value={idForm.name}
                          disabled={!!studentProfile?.isApproved}
                          onChange={(e) => setIdForm({ ...idForm, name: e.target.value })}
                        />
                        <input
                          className="input"
                          placeholder="Registration number"
                          value={idForm.registrationNo}
                          disabled={!!studentProfile?.isApproved}
                          onChange={(e) => setIdForm({ ...idForm, registrationNo: e.target.value })}
                        />
                        {!studentProfile?.isApproved && (
                          <button className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 w-fit">
                            <CheckIcon className="h-4 w-4" />
                            Save identity
                          </button>
                        )}
                        {idMsg && (
                          <div className={`text-sm ${idMsg === 'Saved' ? 'text-green-400' : 'text-rose-400'}`}>{idMsg}</div>
                        )}
                      </form>
                      <div className="font-semibold mb-1">Profile Photo</div>
                      <div className="text-sm text-gray-400 mb-2">PNG/JPG up to 2 MB. You can update your photo until approval; after approval it is locked.</div>
                      <div className="flex items-center gap-3">
                        <img
                          src={studentProfile?.profilePhotoUrl || 'https://placehold.co/64x64?text=Avatar'}
                          alt="Current"
                          width="48"
                          height="48"
                          loading="lazy"
                          decoding="async"
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-white/10"
                        />
                        {!studentProfile?.isApproved && (
                          <div className="flex items-center gap-2">
                            <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                            <label htmlFor="photo-input" className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-gray-700/60 text-gray-100 border border-white/10 hover:bg-gray-700/80 cursor-pointer">
                              <ImagePlusIcon className="h-4 w-4" /> Choose file
                            </label>
                            <span className="text-xs text-gray-400 truncate max-w-[140px]">{photoFile?.name || 'No file chosen'}</span>
                            <button
                              type="button"
                              onClick={() => startCamera()}
                              className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-gray-700/60 text-gray-100 border border-white/10 hover:bg-gray-700/80"
                            >
                              <CameraIcon className="h-4 w-4" /> Capture
                            </button>
                          </div>
                        )}
                      </div>
                      {!studentProfile?.isApproved && (
                        <>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              className={`btn inline-flex items-center gap-2 ${photoLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                              disabled={photoLoading}
                              onClick={async () => {
                                setPhotoMsg('');
                                setPhotoProgress(0);
                                setPhotoLoading(true);
                                try {
                                  if (!photoFile) throw new Error('Select an image first');
                                  if (photoFile.size > 2 * 1024 * 1024) throw new Error('Max size 2 MB');
                                  const fd = new FormData();
                                  fd.append('photo', photoFile);
                                  await api.post('/students/profile-photo', fd, {
                                    headers: { 'Content-Type': 'multipart/form-data' },
                                    onUploadProgress: (e) => {
                                      if (!e.total) return;
                                      const p = Math.round((e.loaded * 100) / e.total);
                                      setPhotoProgress(p);
                                    },
                                  });
                                  const { data } = await api.get('/students/me');
                                  setStudentProfile(data);
                                  setPhotoFile(null);
                                  setPhotoMsg('Profile photo set');
                                } catch (err) {
                                  setPhotoMsg(err?.response?.data?.message || err.message || 'Upload failed');
                                } finally {
                                  setPhotoLoading(false);
                                  setTimeout(() => setPhotoProgress(0), 600);
                                }
                              }}
                            >
                              {photoLoading ? (
                                <>
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 3v3" strokeLinecap="round" />
                                  </svg>
                                  Uploading…
                                </>
                              ) : (
                                <>
                                  <UploadIcon className="h-4 w-4" />
                                  Upload
                                </>
                              )}
                            </button>
      {cameraOpen && createPortal(
        <div className="fixed inset-0 z-[10000]">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closeCamera} />
          <div className="absolute inset-0 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-md bg-gray-900 text-gray-100 rounded-xl p-4 border border-white/10 shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-2 font-semibold"><CameraIcon className="h-5 w-5" /> Capture Photo</div>
                <button onClick={closeCamera} className="p-2 rounded-md hover:bg-white/10" aria-label="Close camera"><XIcon className="h-5 w-5" /></button>
              </div>
              {cameraError && <div className="text-sm text-rose-400 mb-2">{cameraError}</div>}
              {!capturedPreview && !cameraError && (
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black">
                  <video id="camera-video" autoPlay playsInline muted className="w-full h-full object-cover" ref={(el) => { if (el && cameraStream && el.srcObject !== cameraStream) el.srcObject = cameraStream; }} />
                </div>
              )}
              {capturedPreview && (
                <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                  <img src={capturedPreview} alt="Captured preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2 justify-between">
                {!capturedPreview ? (
                  <>
                    <button onClick={capturePhoto} className="btn flex-1 inline-flex items-center justify-center gap-2"><CameraIcon className="h-4 w-4" /> Capture</button>
                    <button onClick={closeCamera} className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setCapturedPreview(null)} className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-sm">Retake</button>
                    <button onClick={useCaptured} className="btn inline-flex items-center gap-2"><CheckIcon className="h-4 w-4" /> Use Photo</button>
                    <button onClick={closeCamera} className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-sm">Close</button>
                  </>
                )}
              </div>
              <div className="mt-3 text-[11px] text-gray-400 leading-snug">
                We capture a centered square and resize to 512x512 (compressed JPEG). Lighting and clarity help security identify you.
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
                            {photoLoading && (
                              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-600 via-sky-600 to-emerald-500 transition-[width] duration-200"
                                  style={{ width: `${photoProgress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {studentProfile?.isApproved && (
                        <div className="mt-2 text-xs text-emerald-400">Photo locked after approval.</div>
                      )}
                      {photoMsg && (
                        <div className={`text-sm mt-1 ${photoMsg.includes('set') ? 'text-green-400' : 'text-rose-400'}`}>
                          {photoMsg}
                        </div>
                      )}
                    </div>
                  )}

                  {user && user.role === 'student' && (
                    <div>
                      <div className="font-semibold mb-1">Change PIN</div>
                      <div className="text-sm text-gray-400 mb-2">This 6-digit PIN is used at the gate when your mobile is unavailable.</div>
                      <form
                        className="flex flex-col gap-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setPinMsg('');
                          try {
                            if (!/^\d{6}$/.test(pinForm.newPin)) throw new Error('PIN must be exactly 6 digits');
                            await api.patch('/students/pin', { oldPin: pinForm.oldPin || undefined, newPin: pinForm.newPin });
                            try {
                              const { data } = await api.get('/students/me');
                              setStudentProfile(data);
                            } catch {}
                            setPinForm({ oldPin: '', newPin: '' });
                            setPinMsg('PIN updated successfully');
                          } catch (err) {
                            setPinMsg(err?.response?.data?.message || err.message || 'Failed to update PIN');
                          }
                        }}
                      >
                        {studentProfile?.pinCode && (
                          <div className="relative">
                            <KeyIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-300/90 drop-shadow-sm" />
                            <input
                              value={pinForm.oldPin}
                              onChange={(e) => setPinForm({ ...pinForm, oldPin: e.target.value })}
                              placeholder="Current 6-digit PIN"
                              className="input !pl-12 !pr-12 text-sm placeholder:text-gray-400"
                              maxLength={6}
                              inputMode="numeric"
                              type={pinShow ? 'text' : 'password'}
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300/90 hover:text-white"
                              onClick={() => setPinShow((v) => !v)}
                              aria-label="Toggle PIN visibility"
                            >
                              {pinShow ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                          </div>
                        )}
                        <div className="relative">
                          <KeyIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-300/90 drop-shadow-sm" />
                          <input
                            value={pinForm.newPin}
                            onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                            placeholder="New 6-digit PIN"
                            className="input !pl-12 !pr-12 text-sm placeholder:text-gray-400"
                            maxLength={6}
                            inputMode="numeric"
                            type={pinShow ? 'text' : 'password'}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300/90 hover:text-white"
                            onClick={() => setPinShow((v) => !v)}
                            aria-label="Toggle PIN visibility"
                          >
                            {pinShow ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                          </button>
                        </div>
                        <button className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 w-fit" type="submit">
                          <CheckIcon className="h-4 w-4" />
                          Save PIN
                        </button>
                        {pinMsg && <div className={`text-sm ${pinMsg.includes('success') ? 'text-green-400' : 'text-rose-400'}`}>{pinMsg}</div>}
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
          document.body
        )}
    </nav>
  );
}
