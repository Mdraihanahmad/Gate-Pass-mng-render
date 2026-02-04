// Minimal IndexedDB wrapper for offline caching
const DB_NAME = 'gatepass-offline';
const DB_VERSION = 6; // bump when creating new stores

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('students')) db.createObjectStore('students', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: '_id' });
  // New stores for student dashboard offline
      if (!db.objectStoreNames.contains('studentProfile')) db.createObjectStore('studentProfile', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('studentLogs')) db.createObjectStore('studentLogs', { keyPath: '_id' });
      // Cache of student profiles by SID for Security offline preview
      if (!db.objectStoreNames.contains('studentCacheBySid')) db.createObjectStore('studentCacheBySid', { keyPath: 'sid' });
      // Cache of student profiles by PIN hash for Security offline manual entry
      if (!db.objectStoreNames.contains('studentCacheByPin')) db.createObjectStore('studentCacheByPin', { keyPath: 'pinHash' });
  // Admin/Security
  if (!db.objectStoreNames.contains('securityUsers')) db.createObjectStore('securityUsers', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('visitors')) db.createObjectStore('visitors', { keyPath: '_id' });
      // Pending actions queue (for offline security scans/manual logs)
      if (!db.objectStoreNames.contains('pendingActions')) db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAll(store, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    s.clear();
    for (const it of items) s.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = s.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getOne(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = s.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function sha256Hex(text) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

export const offline = {
  saveStudents: (items) => putAll('students', items),
  loadStudents: () => getAll('students'),
  saveLogs: (items) => putAll('logs', items),
  loadLogs: () => getAll('logs'),
  // Student dashboard
  saveStudentProfile: async (profile) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('studentProfile', 'readwrite');
      const s = tx.objectStore('studentProfile');
      s.put({ key: 'me', ...profile });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  loadStudentProfile: async () => {
    const rec = await getOne('studentProfile', 'me');
    if (!rec) return null;
    const { key, ...rest } = rec;
    return rest;
  },
  saveStudentLogs: (items) => putAll('studentLogs', items),
  loadStudentLogs: () => getAll('studentLogs'),
  // Student cache for Security offline preview
  saveStudentBySid: async (student) => {
    const db = await openDB();
    // pick only required fields to keep storage light
    const doc = {
      sid: student.studentUid || student.sid || student.SID || student.id || student._id,
      registrationNo: student.registrationNo,
      name: student.name,
      branch: student.branch,
      batchYear: student.batchYear,
      profilePhotoUrl: student.profilePhotoUrl || null,
      profilePhotoThumbUrl: student.profilePhotoThumbUrl || null,
      updatedAt: Date.now(),
    };
    if (!doc.sid) return; // skip if no SID
    return new Promise((resolve, reject) => {
      const tx = db.transaction('studentCacheBySid', 'readwrite');
      const s = tx.objectStore('studentCacheBySid');
      s.put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getStudentBySid: async (sid) => {
    if (!sid) return null;
    return getOne('studentCacheBySid', sid);
  },
  // PIN-based cache for manual offline preview (stores a peppered hash; never plaintext)
  saveStudentByPin: async (pinCode, student) => {
    if (!pinCode || !/^\d{6}$/.test(pinCode)) return; // only exact 6 digits
    const pepper = 'gatepass-pepper-v1';
    const pinHash = await sha256Hex(pepper + ':' + pinCode);
    if (!pinHash) return;
    const db = await openDB();
    const doc = {
      pinHash,
      registrationNo: student.registrationNo,
      name: student.name,
      branch: student.branch,
      batchYear: student.batchYear,
      sid: student.studentUid || student.sid || student.SID || student.id || student._id,
      profilePhotoUrl: student.profilePhotoUrl || null,
      profilePhotoThumbUrl: student.profilePhotoThumbUrl || null,
      updatedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('studentCacheByPin', 'readwrite');
      const s = tx.objectStore('studentCacheByPin');
      s.put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getStudentByPin: async (pinCode) => {
    if (!pinCode || !/^\d{6}$/.test(pinCode)) return null;
    const pepper = 'gatepass-pepper-v1';
    const pinHash = await sha256Hex(pepper + ':' + pinCode);
    if (!pinHash) return null;
    return getOne('studentCacheByPin', pinHash);
  },
  pruneStudentCache: async (maxAgeDays = 60) => {
    try {
      const db = await openDB();
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      const pruneStore = (storeName, keyField) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const s = tx.objectStore(storeName);
        const req = s.getAll();
        req.onsuccess = () => {
          const rows = req.result || [];
          for (const r of rows) {
            if (!r?.updatedAt || r.updatedAt < cutoff) {
              try { s.delete(r[keyField]); } catch {}
            }
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await pruneStore('studentCacheBySid', 'sid');
      await pruneStore('studentCacheByPin', 'pinHash');
      return;
    } catch {
      // ignore pruning errors
    }
  },
  // Admin/Security
  saveSecurityUsers: (items) => putAll('securityUsers', items),
  loadSecurityUsers: () => getAll('securityUsers'),
  saveVisitors: (items) => putAll('visitors', items),
  loadVisitors: () => getAll('visitors'),
  // Pending actions queue
  queueAction: async (action) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingActions', 'readwrite');
      const s = tx.objectStore('pendingActions');
      const req = s.add({ ...action, createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  listPendingActions: async () => {
    return getAll('pendingActions');
  },
  removePendingAction: async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingActions', 'readwrite');
      const s = tx.objectStore('pendingActions');
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
