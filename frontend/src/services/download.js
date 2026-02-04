// Authenticated file download helper (PDF/DOCX) using fetch + blob
import { API_BASE } from './api';

function resolveApiUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (API_BASE || '').replace(/\/+$/, '');
  let path = url.startsWith('/') ? url : `/${url}`;
  if (/\/api$/i.test(base) && /^\/api(\/|$)/i.test(path)) {
    path = path.replace(/^\/api/i, '');
    if (!path.startsWith('/')) path = `/${path}`;
  }
  return `${base}${path}`;
}

export async function authDownload(url, params = {}, fallbackName = 'download') {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const token = localStorage.getItem('token');
  const baseUrl = resolveApiUrl(url);
  const fullUrl = qs.toString() ? `${baseUrl}?${qs.toString()}` : baseUrl;
  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  // Try to extract filename from Content-Disposition
  let filename = fallbackName;
  const cd = res.headers.get('content-disposition');
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    const name = decodeURIComponent(m?.[1] || m?.[2] || '');
    if (name) filename = name;
  }
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = urlObj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(urlObj);
}
