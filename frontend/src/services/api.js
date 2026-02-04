import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const instance = axios.create({ baseURL: API_BASE, timeout: 15000, headers: { Accept: 'application/json' } });

let token = null;
instance.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response interceptor: if a security account is removed (or token invalid),
// force logout and redirect to login. Also expose lastError for optional UI use.
let onAuthFailure = null;
instance.interceptors.response.use(
  (res) => {
    // If routing is misconfigured and we get HTML, reject to surface a clear error path
    if (res && res.status === 200 && typeof res.data === 'string') {
      const s = String(res.data).trim().slice(0, 200).toLowerCase();
      if (s.startsWith('<!doctype') || s.startsWith('<html')) {
        const err = new Error('Invalid server response');
        err.response = { status: 502, data: { message: 'Invalid server response (HTML). Check API routing or BASE URL.' } };
        throw err;
      }
    }
    return res;
  },
  (error) => {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message;
    if (status === 401 || status === 403) {
      try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
      token = null;
      if (typeof onAuthFailure === 'function') onAuthFailure(msg || 'Session expired');
      // Soft redirect; don't throw if caller wants to handle
    }
    return Promise.reject(error);
  }
);

export const api = {
  setToken: (t) => {
    token = t;
  },
  onAuthFailure: (cb) => { onAuthFailure = cb; },
  get: (url, config) => instance.get(url, { ...config }),
  post: (url, data, config) => instance.post(url, data, config),
  patch: (url, data, config) => instance.patch(url, data, config),
  delete: (url, config) => instance.delete(url, config),
};
