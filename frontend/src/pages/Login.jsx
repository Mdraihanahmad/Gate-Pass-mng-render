import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, UserRound, UsersRound, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [role, setRole] = useState('student');
  const [stage, setStage] = useState('pick'); // 'pick' | 'form'
  const [identifier, setIdentifier] = useState('');
  const [password, setPwd] = useState('');
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const formRef = useRef(null);
  const nav = useNavigate();
  const { login, loading } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Backend expects `registrationNo`. For admin/security we let users type their Name,
      // but we send it in the `registrationNo` field for compatibility.
  const user = await login(identifier, password, role);
      if (user.role === 'admin') nav('/admin');
      else if (user.role === 'security') nav('/security');
      else nav('/student');
    } catch (e) {
      setError(e.response?.data?.message || 'Login failed');
      // Shake on failure
      try {
        const el = formRef.current;
        if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
      } catch {}
    }
  };

  // Keyboard: 1/2/3 to pick role, Enter to proceed from picker
  useEffect(() => {
    const onKey = (e) => {
      if (stage === 'pick') {
        if (e.key === '1') { setRole('student'); setStage('form'); }
        if (e.key === '2') { setRole('security'); setStage('form'); }
        if (e.key === '3') { setRole('admin'); setStage('form'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  const roles = useMemo(() => ([
    { key: 'student', label: 'Student', icon: UserRound, color: 'from-sky-500 to-cyan-500', desc: 'Access your gate pass' },
    { key: 'security', label: 'Security', icon: Shield, color: 'from-amber-500 to-orange-500', desc: 'Security dashboard login' },
    { key: 'admin', label: 'Admin', icon: UsersRound, color: 'from-violet-500 to-fuchsia-500', desc: 'Admin dashboard login' },
  ]), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-gray-100">
      {/* Top header with gradient and glow */}
      <div className="relative text-white pt-10 pb-16 rounded-b-[28px] header-shadow" style={{ background: 'linear-gradient(135deg, #3b0d6d 0%, #5b21b6 70%)' }}>
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <img src="/icons/icon-192.png" alt="App logo" className="w-20 h-20 rounded-full bg-white shadow-md border border-white/70 object-contain p-1" />
        </div>
      </div>

      {/* Body content */}
      <div className="-mt-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto bg-slate-800/80 backdrop-blur rounded-2xl fancy-shadow border border-white/10 p-5 sm:p-6">
          {stage === 'pick' ? (
            <>
              <div className="text-center mb-6">
                <div className="text-xl sm:text-2xl font-semibold text-white">Choose Your Role</div>
                <div className="text-sm text-gray-300">Tap to continue</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 animate-slide-up">
                {roles.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => { setRole(r.key); setStage('form'); }}
                      className="role-card group flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-900/40 border border-white/10 hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-slate-900"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRole(r.key); setStage('form'); } }}
                      tabIndex={0}
                      aria-label={`Login as ${r.label}`}
                    >
                      <span className={`role-circle w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center shadow-2xl pulse-ring`} title={`${r.label} login`}>
                        <Icon className="w-12 h-12 drop-shadow" />
                      </span>
                      <span className="text-base font-semibold text-white">{r.label}</span>
                      <span className="text-xs text-gray-300 text-center">{r.desc}</span>
                      {r.key !== 'student' && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/20">Staff</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 text-center text-xs text-gray-300">
                Looking for signup? <Link to="/signup" className="font-semibold underline decoration-rose-400/80 underline-offset-4">Create an account</Link>
              </div>
            </>
          ) : (
            <div className="max-w-md mx-auto">
              <button type="button" onClick={() => setStage('pick')} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white mb-3">
                <ArrowLeft className="w-4 h-4" /> Change role
              </button>
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold text-white">Login as {role[0].toUpperCase()+role.slice(1)}</h1>
                <p className="text-sm text-gray-300">Enter your credentials to continue</p>
              </div>

              {error && <div className="mb-3 rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm" role="alert">{error}</div>}

              <form className="space-y-4" onSubmit={submit} ref={formRef}>
                <div className="relative">
                  <input
                    className="input bg-slate-900/40 border-white/10"
                    placeholder={role === 'student' ? 'Registration No' : 'Name'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete={role === 'student' ? 'username' : 'name'}
                  />
                </div>
                <div className="relative">
                  <input
                    className="input pr-10 bg-slate-900/40 border-white/10"
                    placeholder="Password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPwd(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white cursor-pointer"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 5 12 5c4.64 0 8.577 2.51 9.964 6.678.07.194.07.45 0 .644C20.577 16.49 16.64 19 12 19c-4.64 0-8.577-2.51-9.964-6.678z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                <button disabled={loading} className="w-full inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600 text-white font-semibold py-2.5 shadow-lg hover:brightness-110 active:brightness-95 transition disabled:opacity-60">
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" strokeWidth="4"/><path d="M4 12a8 8 0 018-8" strokeWidth="4" strokeLinecap="round"/></svg>
                      Logging in…
                    </span>
                  ) : 'Login'}
                </button>
              </form>

              <div className="mt-4 text-center text-sm text-gray-300">
                <Link to="/forgot-password" className="font-semibold underline decoration-indigo-400/80 decoration-2 underline-offset-4 mr-2">Forgot password?</Link>
                New here? <Link to="/signup" className="font-semibold underline decoration-rose-400/80 decoration-2 underline-offset-4">Create an account</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
