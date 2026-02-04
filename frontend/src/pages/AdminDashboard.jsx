import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataTable from '../components/DataTable';
import { offline } from '../services/offline';
import { authDownload } from '../services/download';
import { api } from '../services/api';
import { Users, Shield, Clock, ClipboardList, UserCheck, FileText, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const [pending, setPending] = useState([]);
  const [pendingSec, setPendingSec] = useState([]);
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [students, setStudents] = useState([]);
  const [securityUsers, setSecurityUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [date, setDate] = useState({ from: '', to: '' });
  const [batchDelete, setBatchDelete] = useState({ year: '', branch: '' });
  const [me, setMe] = useState(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('success');
  const [purgeDate, setPurgeDate] = useState('');
  const [pendingFilter, setPendingFilter] = useState({ year: '', branch: '' });
  const [loadingMain, setLoadingMain] = useState(false);
  const [overstays, setOverstays] = useState([]);
  const [overstaysFilter, setOverstaysFilter] = useState({ from: '', to: '' });
  // Admin student search + details
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearching, setStudentSearching] = useState(false);
  const [studentResults, setStudentResults] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null); // { student, logs }
  const [detailsError, setDetailsError] = useState('');
  // Show More toggles (match SecurityDashboard UX)
  const [showAllOverstays, setShowAllOverstays] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showAllSearch, setShowAllSearch] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState('all'); // all | check-in | check-out

  // Tabs: keep functionality intact by only toggling visibility (panels remain mounted)
  const [activeTab, setActiveTab] = useState('overstays');
  // Mount tabs lazily on first visit to cut initial render cost on mobile
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['overstays']));

  // Small client-side cache to avoid repeat fetches when user switches tabs.
  // This is especially important on Vercel/Serverless usage limits.
  const CACHE_MS = 60_000; // 1 minute
  const fetchedAtRef = useRef({ pending: 0, overstays: 0, students: 0, security: 0, logs: 0 });

  const isPageVisible = () => {
    try { return typeof document !== 'undefined' ? document.visibilityState === 'visible' : true; } catch { return true; }
  };

  const shouldFetch = (key, force = false) => {
    if (force) return true;
    const last = fetchedAtRef.current?.[key] || 0;
    return Date.now() - last > CACHE_MS;
  };

  const markFetched = (key) => {
    fetchedAtRef.current[key] = Date.now();
  };

  const activateTab = (tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Fetch only what the selected tab needs.
    // Visitors tab manages its own fetch inside VisitorList.
    if (tab !== 'visitors') {
      ensureTabData(tab, { showLoading: true }).catch(() => {});
    }
  };

  const loadPending = useCallback(async ({ force = false, showLoading = false } = {}) => {
    if (!shouldFetch('pending', force)) return;
    if (showLoading) setLoadingMain(true);
    try {
      const [p, ps, pa] = await Promise.all([
        api.get('/admin/students/pending'),
        api.get('/admin/security/pending'),
        api.get('/admin/admins/pending'),
      ]);
      setPending(p.data);
      setPendingSec(ps.data);
      setPendingAdmins(pa.data);
      markFetched('pending');
    } catch (e) {
      // No offline cache for pending lists; keep existing state.
      if (!navigator?.onLine) {
        setNotice('Offline mode: pending lists may be outdated');
        setNoticeType('error');
      }
    } finally {
      if (showLoading) setLoadingMain(false);
    }
  }, []);

  const loadStudentsTab = useCallback(async ({ force = false, showLoading = false } = {}) => {
    if (!shouldFetch('students', force)) return;
    if (showLoading) setLoadingMain(true);
    try {
      const s = await api.get('/admin/students');
      setStudents(s.data);
      offline.saveStudents(s.data).catch(() => {});
      markFetched('students');
    } catch (e) {
      const cachedStudents = await offline.loadStudents().catch(() => []);
      if (cachedStudents.length) {
        setStudents(cachedStudents);
        setNotice('Offline mode: showing cached students');
        setNoticeType('error');
      }
    } finally {
      if (showLoading) setLoadingMain(false);
    }
  }, []);

  const loadSecurityUsersTab = useCallback(async ({ force = false, showLoading = false } = {}) => {
    if (!shouldFetch('security', force)) return;
    if (showLoading) setLoadingMain(true);
    try {
      const sec = await api.get('/admin/users', { params: { role: 'security', approvedOnly: true } });
      setSecurityUsers(sec.data);
      offline.saveSecurityUsers(sec.data).catch(() => {});
      markFetched('security');
    } catch (e) {
      const cached = await offline.loadSecurityUsers().catch(() => []);
      if (cached.length) {
        setSecurityUsers(cached);
        setNotice('Offline mode: showing cached security users');
        setNoticeType('error');
      }
    } finally {
      if (showLoading) setLoadingMain(false);
    }
  }, []);

  const loadLogsTab = useCallback(async ({ force = false, showLoading = false } = {}) => {
    if (!shouldFetch('logs', force)) return;
    if (showLoading) setLoadingMain(true);
    try {
      const l = await api.get('/admin/logs', { params: date.from || date.to ? { ...date } : {} });
      setLogs(l.data);
      offline.saveLogs(l.data).catch(() => {});
      markFetched('logs');
    } catch (e) {
      const cachedLogs = await offline.loadLogs().catch(() => []);
      if (cachedLogs.length) {
        setLogs(cachedLogs);
        setNotice('Offline mode: showing cached logs');
        setNoticeType('error');
      }
    } finally {
      if (showLoading) setLoadingMain(false);
    }
  }, [date.from, date.to]);

  const loadOverstaysTab = useCallback(async ({ force = false, showLoading = false } = {}) => {
    if (!shouldFetch('overstays', force)) return;
    if (showLoading) setLoadingMain(true);
    try {
      const params = {};
      if (overstaysFilter.from) params.from = overstaysFilter.from;
      if (overstaysFilter.to) params.to = overstaysFilter.to;
      // IMPORTANT: do NOT set refresh=true for routine refreshes (it triggers a full rescan).
      const os = await api.get('/admin/overstays', { params });
      setOverstays(os.data || []);
      markFetched('overstays');
    } catch (e) {
      // No offline cache for overstays; keep existing list.
      if (!navigator?.onLine) {
        setNotice('Offline mode: overstays may be outdated');
        setNoticeType('error');
      }
    } finally {
      if (showLoading) setLoadingMain(false);
    }
  }, [overstaysFilter.from, overstaysFilter.to]);

  const ensureTabData = useCallback(async (tab, { force = false, showLoading = false } = {}) => {
    if (!me?.isApproved) return;
    if (tab === 'pending') return loadPending({ force, showLoading });
    if (tab === 'overstays') return loadOverstaysTab({ force, showLoading });
    if (tab === 'students') return loadStudentsTab({ force, showLoading });
    if (tab === 'security') return loadSecurityUsersTab({ force, showLoading });
    if (tab === 'logs') return loadLogsTab({ force, showLoading });
    // visitors handled inside VisitorList; maintenance has no fetch.
  }, [me?.isApproved, loadPending, loadOverstaysTab, loadStudentsTab, loadSecurityUsersTab, loadLogsTab]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        setMe(data);
        if (data?.isApproved) {
          // Fetch just what we need initially:
          // - pending lists for the badge
          // - active tab's data (default: overstays)
          await Promise.all([
            ensureTabData('pending', { force: true, showLoading: false }),
            ensureTabData(activeTab, { force: true, showLoading: true }),
          ]);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Periodically refresh overstays so Hours column stays up-to-date while open
  useEffect(() => {
    if (!me?.isApproved) return;
    // Only refresh overstays periodically when the user is actually viewing that tab.
    const id = setInterval(() => {
      if (activeTab !== 'overstays') return;
      if (!isPageVisible()) return;
      ensureTabData('overstays', { force: true, showLoading: false }).catch(() => {});
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [me?.isApproved, activeTab, ensureTabData, overstaysFilter.from, overstaysFilter.to]);

  // Auto-hide success/info notice after 2 seconds
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2000);
    return () => clearTimeout(t);
  }, [notice]);

  const approve = async (id) => {
    await api.post(`/admin/students/${id}/approve`);
    await Promise.all([
      loadPending({ force: true }),
      loadStudentsTab({ force: true }),
    ]);
  };
  const decline = async (id) => {
    await api.post(`/admin/students/${id}/decline`);
    await loadPending({ force: true });
  };
  const approveSec = async (id) => {
    await api.post(`/admin/security/${id}/approve`);
    await Promise.all([
      loadPending({ force: true }),
      loadSecurityUsersTab({ force: true }),
    ]);
  };
  const declineSec = async (id) => {
    await api.post(`/admin/security/${id}/decline`);
    await loadPending({ force: true });
  };
  const approveAdmin = async (id) => {
    await api.post(`/admin/admins/${id}/approve`);
    await loadPending({ force: true });
  };
  const declineAdmin = async (id) => {
    await api.post(`/admin/admins/${id}/decline`);
    await loadPending({ force: true });
  };

  const approveAllStudents = async () => {
    if (!confirm('Approve all pending students (filtered)? Pins and QR will be generated automatically.')) return;
    const body = { batchYear: pendingFilter.year ? Number(pendingFilter.year) : undefined, branch: pendingFilter.branch || undefined };
    const res = await api.post('/admin/students/approve-all', body);
    setNotice(`${res.data?.approved || 0} students approved`);
    setNoticeType('success');
    await Promise.all([
      loadPending({ force: true }),
      loadStudentsTab({ force: true }),
    ]);
  };

  const declineAllStudents = async () => {
    if (!confirm('Reject all pending students (filtered)?')) return;
    const body = { batchYear: pendingFilter.year ? Number(pendingFilter.year) : undefined, branch: pendingFilter.branch || undefined };
    const res = await api.post('/admin/students/decline-all', body);
    setNotice(`${res.data?.declined || 0} students rejected`);
    setNoticeType('success');
    await loadPending({ force: true });
  };

  const exportFile = async (fmt, type) => {
    try {
      const params = { type };
      if (type === 'overstays') {
        params.from = overstaysFilter.from || undefined;
        params.to = overstaysFilter.to || undefined;
      } else {
        params.from = date.from || undefined;
        params.to = date.to || undefined;
        if (type === 'students' && logActionFilter !== 'all') {
          params.action = logActionFilter;
        }
      }
      await authDownload(`/api/export/${fmt}`, params, `${type}-logs.${fmt}`);
    } catch (e) {
      setNotice(e.message || 'Export failed');
      setNoticeType('error');
    }
  };

  const exportStudentDetails = async (fmt) => {
    try {
      const params = {
        type: 'student-details',
        batchYear: batchDelete.year || undefined,
        branch: batchDelete.branch || undefined,
      };
      const filename = `student-details${batchDelete.year ? '-' + batchDelete.year : ''}${batchDelete.branch ? '-' + batchDelete.branch : ''}.${fmt}`;
      await authDownload(`/api/export/${fmt}`, params, filename);
    } catch (e) {
      setNotice(e.message || 'Export failed');
      setNoticeType('error');
    }
  };

  const purgeOld = async () => {
    if (!confirm('This will permanently delete logs and visitors older than the cutoff. Continue?')) return;
    const body = purgeDate ? { before: purgeDate } : { months: 3 };
    const { data } = await api.post('/admin/purge-old', body);
    setNotice(`Deleted ${data.deletedLogs} logs and ${data.deletedVisitors} visitors (<= ${new Date(data.cutoff).toLocaleDateString()})`);
    setNoticeType('success');
    // Invalidate tab caches that depend on logs/visitors.
    fetchedAtRef.current.logs = 0;
    fetchedAtRef.current.overstays = 0;
    await Promise.all([
      activeTab === 'logs' ? loadLogsTab({ force: true }) : Promise.resolve(),
      activeTab === 'overstays' ? loadOverstaysTab({ force: true }) : Promise.resolve(),
    ]);
  };

  const deleteOne = async (id) => {
    if (!confirm('Delete this student permanently?')) return;
    await api.delete(`/admin/students/${id}`);
    fetchedAtRef.current.students = 0;
    fetchedAtRef.current.logs = 0;
    await Promise.all([
      loadStudentsTab({ force: true }),
      activeTab === 'logs' ? loadLogsTab({ force: true }) : Promise.resolve(),
      loadPending({ force: true }),
    ]);
  };

  const deleteSecurityUser = async (id) => {
    if (!confirm('Delete this security user permanently?')) return;
    await api.delete(`/admin/security/${id}`);
    await Promise.all([
      loadSecurityUsersTab({ force: true }),
      loadPending({ force: true }),
    ]);
  };

  const refreshOverstays = async () => {
    // Lightweight refresh (no full rescan)
    await loadOverstaysTab({ force: true, showLoading: true });
    setNotice('Overstay list updated');
    setNoticeType('success');
  };

  const resolveOverstay = async (id) => {
    await api.post(`/admin/overstays/${id}/resolve`);
    await refreshOverstays();
  };

  const runBatchDelete = async () => {
    const { year, branch } = batchDelete;
    if (!year) return alert('Select a batch year');
    if (!confirm(`Delete all students from batch ${year}${branch ? ' (' + branch + ')' : ''}?`)) return;
    await api.post('/admin/students/batch-delete', { batchYear: Number(year), branch: branch || undefined });
    fetchedAtRef.current.students = 0;
    fetchedAtRef.current.logs = 0;
    await Promise.all([
      loadStudentsTab({ force: true }),
      activeTab === 'logs' ? loadLogsTab({ force: true }) : Promise.resolve(),
      loadPending({ force: true }),
    ]);
  };

  // --- Student Search ---
  const runStudentSearch = async () => {
    const q = (studentSearch || '').trim();
    setStudentResults([]);
    setDetailsOpen(false);
    if (!q) return;
    try {
      setStudentSearching(true);
      const { data } = await api.get('/admin/students/search', { params: { q } });
      setStudentResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setStudentResults([]);
      setNotice(e?.response?.data?.message || 'Search failed');
      setNoticeType('error');
    } finally {
      setStudentSearching(false);
    }
  };

  const openStudentDetails = async (registrationNo) => {
    if (!registrationNo) return;
    setDetailsError('');
    setDetails(null);
    setDetailsOpen(true);
    try {
      setDetailsLoading(true);
      const { data } = await api.get(`/admin/students/${encodeURIComponent(registrationNo)}/details`);
      setDetails(data);
    } catch (e) {
      setDetailsError(e?.response?.data?.message || 'Failed to load details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const clearSearch = () => {
    setStudentSearch('');
    setStudentResults([]);
    setShowAllSearch(false);
  };

  // Live-sort main students table as user types
  const displayedStudents = useMemo(() => {
    const list = Array.isArray(students) ? [...students] : [];
    const q = (studentSearch || '').trim().toLowerCase();
    if (!q) {
      // Default ordering by registration number (then name)
      return list.sort((a, b) => {
        const ra = String(a.registrationNo || '');
        const rb = String(b.registrationNo || '');
        const rcmp = ra.localeCompare(rb, undefined, { numeric: true, sensitivity: 'base' });
        if (rcmp !== 0) return rcmp;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      });
    }
    const score = (item) => {
      const name = String(item.name || '').toLowerCase();
      const reg = String(item.registrationNo || '').toLowerCase();
      if (reg === q) return 0;
      if (name === q) return 0.1;
      if (reg.startsWith(q)) return 0.2;
      if (name.startsWith(q)) return 0.3;
      if (reg.includes(q)) return 0.4;
      if (name.includes(q)) return 0.5;
      return 1;
    };
    return list
      .map((it) => ({ it, s: score(it) }))
      .sort((a, b) => {
        if (a.s !== b.s) return a.s - b.s;
        // Tie-breaker: registration then name
        const ra = String(a.it.registrationNo || '');
        const rb = String(b.it.registrationNo || '');
        const rcmp = ra.localeCompare(rb, undefined, { numeric: true, sensitivity: 'base' });
        if (rcmp !== 0) return rcmp;
        return String(a.it.name || '').localeCompare(String(b.it.name || ''), undefined, { sensitivity: 'base' });
      })
      .map(({ it }) => it);
  }, [students, studentSearch]);

  // Apply Show More slicing per section (50 by default)
  const displayedOverstays = useMemo(() => (showAllOverstays ? overstays : overstays.slice(0, 50)), [overstays, showAllOverstays]);
  const displayedStudentsLimited = useMemo(() => (showAllStudents ? displayedStudents : displayedStudents.slice(0, 50)), [displayedStudents, showAllStudents]);
  const displayedLogs = useMemo(() => {
    const list = Array.isArray(logs) ? logs : [];
    const filtered = logActionFilter === 'all'
      ? list
      : list.filter((l) => l.action === logActionFilter);
    return showAllLogs ? filtered : filtered.slice(0, 50);
  }, [logs, showAllLogs, logActionFilter]);
  const displayedSearchResults = useMemo(() => (showAllSearch ? studentResults : studentResults.slice(0, 50)), [studentResults, showAllSearch]);

  return (
  <>
  <div className="p-4 md:p-6 space-y-6">
  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>

      {me && !me.isApproved && !me.requestedApproval && (
        <div className="rounded border border-red-200 bg-red-50 text-red-800 p-4 flex items-start gap-3">
          <div className="font-semibold">Application was rejected</div>
          <div className="ml-auto">
            <button className="btn" onClick={async () => { await api.post('/auth/admin/request-approval'); setMe({ ...me, requestedApproval: true }); setNotice('Request sent'); setNoticeType('success'); }}>Send request again</button>
          </div>
        </div>
      )}
      {me && !me.isApproved && me.requestedApproval && (
        <div className="rounded border border-blue-200 bg-blue-50 text-blue-800 p-3">Application submitted — please wait for admin approval.</div>
      )}

      {notice && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 shadow-lg rounded px-4 py-3 transition-opacity duration-300 ${
            noticeType === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}
        >
          {notice}
        </div>
      )}

      {/* Tabs (visible only for approved admins) */}
      {me?.isApproved && (
        <div className="relative">
          <div
            role="tablist"
            aria-label="Admin sections"
            className="-mb-2 border-b border-gray-200 dark:border-gray-800 pb-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:flex md:flex-nowrap md:overflow-x-auto md:no-scrollbar"
          >
            <TabButton icon={<UserCheck className="h-4 w-4" />} label="Pending" value="pending"
                       active={activeTab === 'pending'} onClick={() => activateTab('pending')}
                       badge={(pending.length + pendingSec.length + pendingAdmins.length) || 0}
            />
            <TabButton icon={<Clock className="h-4 w-4" />} label="Overstays" value="overstays"
                       active={activeTab === 'overstays'} onClick={() => activateTab('overstays')} />
            <TabButton icon={<Users className="h-4 w-4" />} label="Students" value="students"
                       active={activeTab === 'students'} onClick={() => activateTab('students')} />
            <TabButton icon={<Shield className="h-4 w-4" />} label="Security" value="security"
                       active={activeTab === 'security'} onClick={() => activateTab('security')} />
            <TabButton icon={<ClipboardList className="h-4 w-4" />} label="Logs" value="logs"
                       active={activeTab === 'logs'} onClick={() => activateTab('logs')} />
            <TabButton icon={<FileText className="h-4 w-4" />} label="Visitors" value="visitors"
                       active={activeTab === 'visitors'} onClick={() => activateTab('visitors')} />
            <TabButton icon={<Trash2 className="h-4 w-4" />} label="Maintenance" value="maintenance"
                       active={activeTab === 'maintenance'} onClick={() => activateTab('maintenance')} />
          </div>
        </div>
      )}

      {/* Pending Tab Panel */}
      {me?.isApproved && visitedTabs.has('pending') && (
        <div role="tabpanel" id="panel-pending" aria-labelledby="tab-pending" className={activeTab === 'pending' ? '' : 'hidden'}>
          {pending.length > 0 && (
            <div className="card">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
            <div className="font-semibold">Pending Student Approvals</div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-sm">Batch Year</label>
                <select className="input" value={pendingFilter.year} onChange={(e) => setPendingFilter({ ...pendingFilter, year: e.target.value })}>
                  <option value="">All</option>
                  {Array.from({ length: 31 }, (_, i) => 2020 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Branch</label>
                <select className="input" value={pendingFilter.branch} onChange={(e) => setPendingFilter({ ...pendingFilter, branch: e.target.value })}>
                  <option value="">All</option>
                  {['CSE','Civil','Mechanical','EEE','FPP'].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
                <GradientButton color="teal" onClick={approveAllStudents} title="Approve all" icon={<CheckIcon className="h-4 w-4" />}>
                  Approve All
                </GradientButton>
                <GradientButton color="rose" onClick={declineAllStudents} title="Reject all" icon={<XIcon className="h-4 w-4" />}>
                  Reject All
                </GradientButton>
            </div>
          </div>
          <DataTable
            maxHeight={"60vh"}
            containerClassName="scroll-thin"
            columns={[
              { key: 'registrationNo', title: 'Reg No' },
              { key: 'name', title: 'Name' },
              { key: 'branch', title: 'Branch' },
              { key: 'batchYear', title: 'Batch' },
              { key: 'action', title: 'Action', render: (_, r) => (
                <div className="flex gap-2">
                  <ApproveButton onClick={() => approve(r.id)} />
                  <RejectButton onClick={() => decline(r.id)} />
                </div>
              ) },
            ]}
            data={pending}
          />
        </div>
          )}

          {pendingSec.length > 0 && (
            <div className="card">
          <div className="font-semibold mb-2">Pending Security Approvals</div>
          <DataTable
            maxHeight={"40vh"}
            containerClassName="scroll-thin"
            columns={[
              { key: 'name', title: 'Name' },
              { key: 'registrationNo', title: 'Identifier' },
              { key: 'action', title: 'Action', render: (_, r) => (
                <div className="flex gap-2">
                  <ApproveButton onClick={() => approveSec(r.id)} />
                  <RejectButton onClick={() => declineSec(r.id)} />
                </div>
              ) },
            ]}
            data={pendingSec}
          />
        </div>
          )}

          {pendingAdmins.length > 0 && (
            <div className="card">
          <div className="font-semibold mb-2">Pending Admin Approvals</div>
          <DataTable
            maxHeight={"40vh"}
            containerClassName="scroll-thin"
            columns={[
              { key: 'name', title: 'Name' },
              { key: 'registrationNo', title: 'Identifier' },
              { key: 'action', title: 'Action', render: (_, r) => (
                <div className="flex gap-2">
                  <ApproveButton onClick={() => approveAdmin(r.id)} />
                  <RejectButton onClick={() => declineAdmin(r.id)} />
                </div>
              ) },
            ]}
            data={pendingAdmins}
          />
        </div>
          )}
        </div>
      )}

      {/* Overstays Tab Panel */}
      {me?.isApproved && visitedTabs.has('overstays') && (
        <div role="tabpanel" id="panel-overstays" aria-labelledby="tab-overstays" className={activeTab === 'overstays' ? '' : 'hidden'}>
    <div className="card">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
          <div className="font-semibold">Overstay Alerts</div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div>
              <label className="text-sm">From</label>
              <input type="datetime-local" className="input" value={overstaysFilter.from} onChange={(e) => setOverstaysFilter({ ...overstaysFilter, from: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">To</label>
              <input type="datetime-local" className="input" value={overstaysFilter.to} onChange={(e) => setOverstaysFilter({ ...overstaysFilter, to: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <GradientButton color="teal" size="sm" onClick={refreshOverstays} title="Refresh overstay list">Filter</GradientButton>
              <GradientButton color="indigo" size="sm" onClick={() => exportFile('pdf', 'overstays')}
                icon={<DownloadIcon className="h-4 w-4" />}>
                PDF
              </GradientButton>
              <GradientButton color="indigo" size="sm" variant="outline" onClick={() => exportFile('docx', 'overstays')}
                icon={<DownloadIcon className="h-4 w-4" />}>
                DOCX
              </GradientButton>
            </div>
          </div>
        </div>
        {/* Overstays visibility controller */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <div className="text-xs sm:text-sm text-gray-400">
            Showing <span className="font-medium text-gray-200">{displayedOverstays.length}</span>
            {overstays.length > 50 && !showAllOverstays && (<>
              {' '}of <span className="font-medium">{overstays.length}</span>
              <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest</span>
            </>)}
            {showAllOverstays && overstays.length > 50 && (
              <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>
            )}
          </div>
          {overstays.length > 50 && (
            <div className="flex gap-2">
              {!showAllOverstays ? (
                <button
                  type="button"
                  onClick={() => setShowAllOverstays(true)}
                  className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
                >
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
                  Show More
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{overstays.length - 50}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAllOverstays(false)}
                  className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-violet-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                >
                  Show Less
                </button>
              )}
            </div>
          )}
        </div>
        <DataTable
          maxHeight={"50vh"}
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
                <GradientButton color="amber" size="xs" onClick={() => resolveOverstay(r._id)}>Mark Resolved</GradientButton>
              )
            ) },
          ]}
          data={displayedOverstays}
        />
  </div>
  </div>
  )}

  {/* Students Tab Panel */}
      {me?.isApproved && visitedTabs.has('students') && (
        <div role="tabpanel" id="panel-students" aria-labelledby="tab-students" className={activeTab === 'students' ? '' : 'hidden'}>
  <div className="card">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2">
          <div className="font-semibold">Students</div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div>
              <label className="text-sm">Batch Year</label>
              <select className="input" value={batchDelete.year} onChange={(e) => setBatchDelete({ ...batchDelete, year: e.target.value })}>
                <option value="">Select year</option>
                {Array.from({ length: 31 }, (_, i) => 2020 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm">Branch (optional)</label>
              <select className="input" value={batchDelete.branch} onChange={(e) => setBatchDelete({ ...batchDelete, branch: e.target.value })}>
                <option value="">All</option>
                {['CSE','Civil','Mechanical','EEE','FPP'].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <GradientButton color="amber" onClick={runBatchDelete} title="Batch delete" icon={<TrashIcon className="h-4 w-4" />}>Batch Delete</GradientButton>
            <div className="flex items-center gap-2">
              <GradientButton color="indigo" size="sm" onClick={() => exportStudentDetails('pdf')} icon={<DownloadIcon className="h-4 w-4" />}>Students PDF</GradientButton>
              <GradientButton color="indigo" variant="outline" size="sm" onClick={() => exportStudentDetails('docx')} icon={<DownloadIcon className="h-4 w-4" />}>Students DOCX</GradientButton>
            </div>
          </div>
        </div>
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-3">
          <div className="flex-1">
            <label className="text-sm">Search student</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Enter registration no or name"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runStudentSearch(); }}
            />
          </div>
          <div className="flex gap-2">
            <GradientButton color="teal" onClick={runStudentSearch} disabled={studentSearching}>
              {studentSearching ? 'Searching…' : 'Search'}
            </GradientButton>
            <GradientButton color="rose" variant="outline" onClick={clearSearch} disabled={studentSearching}>Clear</GradientButton>
          </div>
        </div>
        {studentResults.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Search results</div>
            {/* Search results visibility controller */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
              <div className="text-xs sm:text-sm text-gray-400">
                Showing <span className="font-medium text-gray-200">{displayedSearchResults.length}</span>
                {studentResults.length > 50 && !showAllSearch && (<>
                  {' '}of <span className="font-medium">{studentResults.length}</span>
                  <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest</span>
                </>)}
                {showAllSearch && studentResults.length > 50 && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>
                )}
              </div>
              {studentResults.length > 50 && (
                <div className="flex gap-2">
                  {!showAllSearch ? (
                    <button
                      type="button"
                      onClick={() => setShowAllSearch(true)}
                      className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
                    >
                      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
                      Show More
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{studentResults.length - 50}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAllSearch(false)}
                      className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-violet-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}
            </div>
            <DataTable
              maxHeight={"40vh"}
              containerClassName="scroll-thin"
              columns={[
                { key: 'registrationNo', title: 'Reg No' },
                { key: 'name', title: 'Name' },
                { key: 'branch', title: 'Branch' },
                { key: 'batchYear', title: 'Batch' },
                { key: 'action', title: 'Action', render: (_, r) => (
                  <GradientButton color="indigo" size="xs" onClick={() => openStudentDetails(r.registrationNo)}>View</GradientButton>
                ) },
              ]}
              data={displayedSearchResults}
            />
          </div>
        )}
  {/* Students visibility controller */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
    <div className="text-xs sm:text-sm text-gray-400">
      Showing <span className="font-medium text-gray-200">{displayedStudentsLimited.length}</span>
      {displayedStudents.length > 50 && !showAllStudents && (<>
        {' '}of <span className="font-medium">{displayedStudents.length}</span>
        <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest</span>
      </>)}
      {showAllStudents && displayedStudents.length > 50 && (
        <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>
      )}
    </div>
    {displayedStudents.length > 50 && (
      <div className="flex gap-2">
        {!showAllStudents ? (
          <button
            type="button"
            onClick={() => setShowAllStudents(true)}
            className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
          >
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
            Show More
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{displayedStudents.length - 50}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowAllStudents(false)}
            className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-violet-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
          >
            Show Less
          </button>
        )}
      </div>
    )}
  </div>
  <DataTable maxHeight={"60vh"} containerClassName="scroll-thin" columns={[
          { key: 'registrationNo', title: 'Reg No' },
          { key: 'name', title: 'Name' },
          { key: 'branch', title: 'Branch' },
          { key: 'batchYear', title: 'Batch' },
          { key: 'action', title: 'Action', render: (_, r) => (
            <div className="flex items-center gap-2">
              <GradientButton color="indigo" size="xs" onClick={() => openStudentDetails(r.registrationNo)}>Details</GradientButton>
              <GradientButton color="rose" size="xs" onClick={() => deleteOne(r.id)} title="Delete student" icon={<TrashIcon className="h-4 w-4" />}>Delete</GradientButton>
            </div>
          ) },
    ]} data={displayedStudentsLimited} />
  </div>
  </div>
      )}

      {/* Security Users Tab Panel */}
      {me?.isApproved && visitedTabs.has('security') && (
        <div role="tabpanel" id="panel-security" aria-labelledby="tab-security" className={activeTab === 'security' ? '' : 'hidden'}>
  <div className="card">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Security Users</div>
        </div>
  <DataTable maxHeight={"50vh"} containerClassName="scroll-thin" columns={[
          { key: 'registrationNo', title: 'Identifier' },
          { key: 'name', title: 'Name' },
          { key: 'action', title: 'Action', render: (_, r) => (
            <GradientButton color="rose" size="xs" onClick={() => deleteSecurityUser(r.id)} title="Delete security user" icon={<TrashIcon className="h-4 w-4" />}>Delete</GradientButton>
          ) },
        ]} data={securityUsers} />
  </div>
  </div>
      )}

      {/* Logs Tab Panel */}
      {me?.isApproved && visitedTabs.has('logs') && (
        <div role="tabpanel" id="panel-logs" aria-labelledby="tab-logs" className={activeTab === 'logs' ? '' : 'hidden'}>
  <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div>
            <label className="text-sm">From</label>
            <input type="datetime-local" className="input" value={date.from} onChange={(e) => setDate({ ...date, from: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">To</label>
            <input type="datetime-local" className="input" value={date.to} onChange={(e) => setDate({ ...date, to: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <GradientButton color="teal" disabled={loadingMain} onClick={load} icon={<FilterIcon className="h-4 w-4" />}>{loadingMain ? 'Loading…' : 'Filter'}</GradientButton>
            <GradientButton color="indigo" disabled={loadingMain} onClick={() => exportFile('pdf', 'students')} icon={<DownloadIcon className="h-4 w-4" />}>PDF</GradientButton>
            <GradientButton color="indigo" variant="outline" disabled={loadingMain} onClick={() => exportFile('docx', 'students')} icon={<DownloadIcon className="h-4 w-4" />}>DOCX</GradientButton>
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
  {loadingMain ? (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v3" strokeLinecap="round" />
              <path d="M12 18v3" strokeLinecap="round" />
              <path d="M3 12h3" strokeLinecap="round" />
              <path d="M18 12h3" strokeLinecap="round" />
            </svg>
            Loading data…
          </div>
        ) : (
  <>
    {/* Logs visibility controller */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
      <div className="text-xs sm:text-sm text-gray-400">
        Showing <span className="font-medium text-gray-200">{displayedLogs.length}</span>
        {logs.length > 50 && !showAllLogs && (<>
          {' '}of <span className="font-medium">{logs.length}</span>
          <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest</span>
        </>)}
        {showAllLogs && logs.length > 50 && (
          <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>
        )}
      </div>
      {logs.length > 50 && (
        <div className="flex gap-2">
          {!showAllLogs ? (
            <button
              type="button"
              onClick={() => setShowAllLogs(true)}
              className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
            >
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
              Show More
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{logs.length - 50}</span>
            </button>
          ) : (
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
    <DataTable maxHeight={"60vh"} containerClassName="scroll-thin" columns={[
          { key: 'registrationNo', title: 'Reg No' },
          { key: 'name', title: 'Name' },
          { key: 'branch', title: 'Branch' },
          { key: 'batchYear', title: 'Batch' },
          { key: 'action', title: 'Action' },
          { key: 'purpose', title: 'Purpose' },
          { key: 'checkInTime', title: 'Check-in', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
          { key: 'checkOutTime', title: 'Check-out', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
        ]} data={displayedLogs} />
  </>
        )}
  </div>
  </div>
      )}

      {/* Visitors Tab Panel */}
      {me?.isApproved && visitedTabs.has('visitors') && (
        <div role="tabpanel" id="panel-visitors" aria-labelledby="tab-visitors" className={activeTab === 'visitors' ? '' : 'hidden'}>
  <div className="card">
        <div className="font-semibold mb-2">Visitor Logs</div>
        <div className="flex gap-2 mb-2">
          <GradientButton color="indigo" size="sm" onClick={() => exportFile('pdf', 'visitors')} icon={<DownloadIcon className="h-4 w-4" />}>PDF</GradientButton>
          <GradientButton color="indigo" size="sm" variant="outline" onClick={() => exportFile('docx', 'visitors')} icon={<DownloadIcon className="h-4 w-4" />}>DOCX</GradientButton>
        </div>
        {/* Admin can view via admin visitors endpoint or reuse security endpoint; using admin */}
        <VisitorList />
  </div>
  </div>
      )}

      {/* Maintenance Tab Panel */}
      {me?.isApproved && visitedTabs.has('maintenance') && (
        <div role="tabpanel" id="panel-maintenance" aria-labelledby="tab-maintenance" className={activeTab === 'maintenance' ? '' : 'hidden'}>
  <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="font-semibold mb-2">Purge Old Data</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Delete student check-in/out logs and visitor logs older than 3 months (or a custom date).</div>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-sm">Custom cutoff (optional)</label>
              <input type="date" className="input" value={purgeDate} onChange={(e) => setPurgeDate(e.target.value)} />
            </div>
            <GradientButton color="rose" onClick={purgeOld} title="Permanently delete old data" icon={<TrashIcon className="h-4 w-4" />}>Purge Old Data</GradientButton>
          </div>
        </div>
  </div>
  </div>
      )}
    </div>
    {/* Student Details Modal */}
    {detailsOpen && (
      <div className="fixed inset-0 z-[999]">
        <div className="absolute inset-0 bg-black/60" onClick={() => setDetailsOpen(false)} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-[96vw] max-w-5xl max-h-[88vh] overflow-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2 sm:pb-3">
              <div className="font-semibold">Student Details</div>
              <button type="button" className="text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setDetailsOpen(false)}>Close</button>
            </div>
            <div className="pt-3 space-y-3">
              {detailsLoading && (
                <div className="text-sm text-gray-600 dark:text-gray-300">Loading…</div>
              )}
              {detailsError && (
                <div className="text-sm text-red-600">{detailsError}</div>
              )}
              {details && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="card">
                      <div className="font-semibold mb-1">Profile</div>
                      <div>Reg No: {details.student.registrationNo}</div>
                      <div>Name: {details.student.name || '-'}</div>
                      <div>Branch: {details.student.branch || '-'}</div>
                      <div>Batch: {details.student.batchYear || '-'}</div>
                      <div className="mt-1 text-sm">Student UID: <span className="font-mono">{details.student.studentUid || '-'}</span></div>
                      <div className="mt-1 text-sm">PIN: <span className="font-mono">{details.student.pinCode || '-'}</span></div>
                    </div>
                    {details.student.profilePhotoUrl && (
                      <div className="card flex items-center justify-center">
                        <img
                          src={details.student.profilePhotoUrl}
                          alt="Profile photo"
                          width="192"
                          height="192"
                          loading="lazy"
                          decoding="async"
                          className="w-28 h-28 sm:w-36 sm:h-36 md:w-48 md:h-48 object-cover rounded-md"
                        />
                      </div>
                    )}
                  </div>
                  <div className="card">
                    <div className="font-semibold mb-2">Check-in/Out Logs</div>
                    <DataTable
                      maxHeight={"50vh"}
                      columns={[
                        { key: 'action', title: 'Action' },
                        { key: 'purpose', title: 'Purpose' },
                        { key: 'checkInTime', title: 'Check-in', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
                        { key: 'checkOutTime', title: 'Check-out', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
                      ]}
                      data={details.logs || []}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

function VisitorList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllVisitors, setShowAllVisitors] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const getVisitorPhotoUrls = (row) => {
    const urls = [];
    if (Array.isArray(row?.photos) && row.photos.length) {
      urls.push(...row.photos.map((p) => p?.url).filter(Boolean));
    }
    // Backward compatible: old schema had only photoUrl
    if (!urls.length && row?.photoUrl) urls.push(row.photoUrl);
    return urls.slice(0, 3);
  };

  const openGallery = (urls, idx = 0) => {
    const safe = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!safe.length) return;
    setGalleryUrls(safe);
    setGalleryIndex(Math.min(Math.max(0, idx), safe.length - 1));
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
    setGalleryUrls([]);
    setGalleryIndex(0);
  };

  // Close on Escape
  useEffect(() => {
    if (!galleryOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') return closeGallery();
      if (e.key === 'ArrowLeft') {
        setGalleryIndex((i) => {
          const n = galleryUrls.length || 0;
          if (n <= 1) return i;
          return (i - 1 + n) % n;
        });
      }
      if (e.key === 'ArrowRight') {
        setGalleryIndex((i) => {
          const n = galleryUrls.length || 0;
          if (n <= 1) return i;
          return (i + 1) % n;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [galleryOpen, galleryUrls.length]);
  useEffect(() => { (async () => {
    try { const res = await api.get('/admin/visitors'); setItems(res.data); offline.saveVisitors(res.data).catch(() => {}); }
    catch { const cached = await offline.loadVisitors().catch(() => []); setItems(cached); }
    finally { setLoading(false); }
  })(); }, []);
  const displayedVisitors = useMemo(() => (showAllVisitors ? items : items.slice(0, 50)), [items, showAllVisitors]);
  return (
  loading ? (
    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v3" strokeLinecap="round" />
        <path d="M12 18v3" strokeLinecap="round" />
        <path d="M3 12h3" strokeLinecap="round" />
        <path d="M18 12h3" strokeLinecap="round" />
      </svg>
      Loading visitors…
    </div>
  ) : (
  <>
    {/* Visitors visibility controller */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
      <div className="text-xs sm:text-sm text-gray-400">
        Showing <span className="font-medium text-gray-200">{displayedVisitors.length}</span>
        {items.length > 50 && !showAllVisitors && (<>
          {' '}of <span className="font-medium">{items.length}</span>
          <span className="ml-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/10">Latest</span>
        </>)}
        {showAllVisitors && items.length > 50 && (
          <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-200">All</span>
        )}
      </div>
      {items.length > 50 && (
        <div className="flex gap-2">
          {!showAllVisitors ? (
            <button
              type="button"
              onClick={() => setShowAllVisitors(true)}
              className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 border border-white/10 text-cyan-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 group overflow-hidden"
            >
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-violet-500/10 transition" />
              Show More
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">+{items.length - 50}</span>
            </button>
          ) : (
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
    <DataTable
      maxHeight={"50vh"}
      columns={[
        { key: 'photos', title: 'Photos', render: (_v, row) => {
          const urls = getVisitorPhotoUrls(row);
          if (!urls.length) return '-';
          const first = urls[0];
          const extra = urls.length - 1;
          return (
            <button
              type="button"
              onClick={() => openGallery(urls, 0)}
              title={urls.length > 1 ? `View photos (${urls.length})` : 'View photo'}
              className="group relative"
            >
              <img
                src={first}
                alt="Visitor"
                width="40"
                height="40"
                loading="lazy"
                decoding="async"
                className="h-10 w-10 rounded object-cover border border-white/10 group-hover:ring-2 group-hover:ring-cyan-400/50"
              />
              {extra > 0 && (
                <span className="absolute -right-2 -top-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-900/95 text-cyan-200 border border-cyan-400/30 shadow">
                  +{extra}
                </span>
              )}
            </button>
          );
        } },
        { key: 'name', title: 'Name' },
        { key: 'vehicleNo', title: 'Vehicle' },
        { key: 'purpose', title: 'Purpose' },
        { key: 'entryTime', title: 'Entry', render: (v) => new Date(v).toLocaleString() },
        { key: 'exitTime', title: 'Exit', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
      ]}
      data={displayedVisitors}
    />
    {galleryOpen && (
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeGallery} />
        <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6" onClick={closeGallery}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close"
              className="group absolute -top-3 -right-3 sm:top-0 sm:right-0 translate-y-[-50%] sm:translate-y-0 px-0.5 py-0.5 rounded-full"
              onClick={closeGallery}
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/40 to-sky-500/40 blur-md opacity-0 group-hover:opacity-100 transition" />
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/90 text-white border border-white/10 shadow-lg ring-1 ring-white/10 hover:scale-105 transition">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </span>
            </button>

            <div className="w-[96vw] max-w-3xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-200">
                  Photo {galleryIndex + 1} of {galleryUrls.length}
                </div>
                {galleryUrls.length > 1 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-slate-800/70 border border-white/10 text-gray-100 hover:bg-slate-700/70"
                      onClick={() => setGalleryIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-slate-800/70 border border-white/10 text-gray-100 hover:bg-slate-700/70"
                      onClick={() => setGalleryIndex((i) => (i + 1) % galleryUrls.length)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              <img
                src={galleryUrls[galleryIndex]}
                alt="Visitor full"
                loading="lazy"
                decoding="async"
                className="max-h-[75vh] w-full object-contain rounded-lg border border-white/10 bg-black/20"
              />

              {galleryUrls.length > 1 && (
                <div className="mt-3 flex gap-2 justify-center flex-wrap">
                  {galleryUrls.map((u, idx) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setGalleryIndex(idx)}
                      className={`rounded border ${idx === galleryIndex ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-white/10'} overflow-hidden`}
                      title={`Photo ${idx + 1}`}
                    >
                      <img src={u} alt={`Thumb ${idx + 1}`} className="h-14 w-14 object-cover" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
  );
}

// --- Fancy action buttons ---
function ApproveButton({ onClick }) {
  return <GradientButton color="teal" size="xs" onClick={onClick} icon={<CheckIcon className="h-4 w-4" />}>Approve</GradientButton>;
}

function RejectButton({ onClick }) {
  return <GradientButton color="rose" size="xs" onClick={onClick} icon={<XIcon className="h-4 w-4" />}>Reject</GradientButton>;
}

// Reusable gradient button system
const COLOR_MAP = {
  teal: {
    solid: 'from-cyan-500 via-teal-500 to-emerald-500 text-white shadow-cyan-500/30',
    outline: 'text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/10'
  },
  rose: {
    solid: 'from-rose-500 via-fuchsia-500 to-pink-500 text-white shadow-rose-500/30',
    outline: 'text-rose-300 border border-rose-400/30 hover:bg-rose-500/10'
  },
  amber: {
    solid: 'from-amber-500 via-orange-500 to-yellow-500 text-white shadow-amber-500/30',
    outline: 'text-amber-300 border border-amber-400/30 hover:bg-amber-500/10'
  },
  indigo: {
    solid: 'from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-indigo-500/30',
    outline: 'text-violet-300 border border-violet-400/30 hover:bg-violet-500/10'
  }
};

function GradientButton({
  children,
  color = 'teal',
  variant = 'solid',
  size = 'md',
  icon,
  className = '',
  ...rest
}) {
  const sizes = {
    xs: 'text-xs px-2.5 py-1.5',
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5'
  };
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

function CheckIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.293 6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function TrashIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 7a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm4 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm4 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1z"/>
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v1H4V5zm2-1a1 1 0 00-1 1v1h10V5a1 1 0 00-1-1H6z" clipRule="evenodd"/>
    </svg>
  );
}

function DownloadIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9 2a1 1 0 012 0v8.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4A1 1 0 016.707 8.293L9 10.586V2z" />
      <path d="M3 14a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" />
    </svg>
  );
}

function FilterIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v1a2 2 0 01-.586 1.414L12 11.828V16a1 1 0 01-1.447.894l-2-1A1 1 0 018 15v-3.172L3.586 7.414A2 2 0 013 6V5z" />
    </svg>
  );
}

function TabButton({ icon, label, value, active, onClick, badge }) {
  return (
    <button
      id={`tab-${value}`}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${value}`}
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition w-full md:w-auto ${
        active
          ? 'bg-slate-800/60 text-white border-white/10 shadow'
          : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-slate-800/30 border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/30">
          {badge}
        </span>
      )}
    </button>
  );
}
