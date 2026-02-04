import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [form, setForm] = useState({ registrationNo: '', password: '', role: 'student', name: '', branch: '', batchYear: '' });
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const nav = useNavigate();
  const { signup, loading } = useAuth();
  const years = Array.from({ length: 31 }, (_, i) => 2020 + i);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { role: form.role, password: form.password };
      if (form.role === 'student') {
        payload.registrationNo = form.registrationNo;
        payload.name = form.name;
        payload.branch = form.branch;
        payload.batchYear = Number(form.batchYear);
      } else {
        // admin/security: signup by name; use name as registrationNo on server side implicitly
        payload.name = form.name || form.registrationNo; // allow either field to be used visually
      }
      const user = await signup(payload);
      if (user.role === 'admin') nav('/admin');
      else if (user.role === 'security') nav('/security');
      else nav('/student');
    } catch (e) {
      setError(e.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-600 via-sky-600 to-emerald-500 animate-gradient" />
      {/* Floating blobs */}
      <div className="blob absolute top-12 -left-10 w-56 h-56 bg-fuchsia-400/40 rounded-full" />
      <div className="blob absolute bottom-16 right-10 w-72 h-72 bg-cyan-400/40 rounded-full" style={{ animationDelay: '2s' }} />
      <div className="blob absolute top-1/3 right-1/3 w-64 h-64 bg-amber-400/40 rounded-full" style={{ animationDelay: '4s' }} />

      <div className="flex items-center justify-center p-6">
        <div className="glass auth-card max-w-md w-full mx-auto rounded-2xl p-6 shadow-xl neon">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-extrabold text-gray-900/90 dark:text-white tracking-tight">Create your account</h1>
            <p className="text-sm text-gray-700/80 dark:text-gray-300/80">Join the gate pass system</p>
          </div>

          {error && <div className="mb-3 rounded-md border border-rose-300 bg-rose-50/80 text-rose-800 px-3 py-2 text-sm">{error}</div>}

          {/* Role segmented control */}
          <div className="grid grid-cols-3 gap-2 bg-gray-200/60 dark:bg-gray-800/70 rounded-lg p-1 mb-4">
            {['student','security','admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, role: r })}
                className={`text-sm font-medium rounded-md py-2 transition ${form.role===r ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow' : 'text-gray-700/80 dark:text-gray-300/80 hover:bg-white/70 dark:hover:bg-gray-900/50'}`}
              >
                {r[0].toUpperCase()+r.slice(1)}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {form.role === 'student' ? (
              <>
                <input className="input" placeholder="Registration No" value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} />
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 cursor-pointer"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {/* Always show the eye (show password) icon */}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 5 12 5c4.64 0 8.577 2.51 9.964 6.678.07.194.07.45 0 .644C20.577 16.49 16.64 19 12 19c-4.64 0-8.577-2.51-9.964-6.678z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
                <input className="input" placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <select className="input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                  <option value="" disabled>Select Branch</option>
                  <option value="CSE">CSE</option>
                  <option value="Civil">Civil</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="EEE">EEE</option>
                  <option value="FPP">FPP</option>
                </select>
                <select className="input" value={form.batchYear} onChange={(e) => setForm({ ...form, batchYear: e.target.value })}>
                  <option value="" disabled>Select Year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 cursor-pointer"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {/* Always show the eye (show password) icon */}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 5 12 5c4.64 0 8.577 2.51 9.964 6.678.07.194.07.45 0 .644C20.577 16.49 16.64 19 12 19c-4.64 0-8.577-2.51-9.964-6.678z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </>
            )}
            <button
              disabled={loading}
              className={`w-full inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 via-sky-600 to-emerald-500 text-white font-semibold py-2.5 shadow-lg transition ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95 active:opacity-90'}`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 3v3" strokeLinecap="round" />
                    <path d="M12 18v3" strokeLinecap="round" />
                    <path d="M3 12h3" strokeLinecap="round" />
                    <path d="M18 12h3" strokeLinecap="round" />
                    <path d="M5.64 5.64l2.12 2.12" strokeLinecap="round" />
                    <path d="M16.24 16.24l2.12 2.12" strokeLinecap="round" />
                    <path d="M5.64 18.36l2.12-2.12" strokeLinecap="round" />
                    <path d="M16.24 7.76l2.12-2.12" strokeLinecap="round" />
                  </svg>
                  Creating…
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-800/80 dark:text-gray-200/80">
            Already have an account? <Link to="/login" className="font-semibold underline decoration-sky-500/70 decoration-2 underline-offset-4">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
