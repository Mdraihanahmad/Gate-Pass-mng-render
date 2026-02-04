import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function ForgotPassword() {
  const [role, setRole] = useState('student');
  const [step, setStep] = useState(1);
  const [student, setStudent] = useState({ registrationNo: '', pinCode: '' });
  const [security, setSecurity] = useState({ registrationNo: '', name: '' });
  const [token, setToken] = useState('');
  const [pwd, setPwd] = useState({ p1: '', p2: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const requestToken = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (role === 'student') {
        if (!/^[0-9]{6}$/.test(student.pinCode)) throw new Error('PIN must be 6 digits');
        const { data } = await api.post('/auth/forgot-password', { role, registrationNo: student.registrationNo, pinCode: student.pinCode });
        setToken(data.token);
        setStep(2);
      } else {
        const { data } = await api.post('/auth/forgot-password', { role, registrationNo: security.registrationNo, name: security.name });
        setToken(data.token);
        setStep(2);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Request failed');
    }
  };

  const submitNewPwd = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (pwd.p1.length < 6) throw new Error('Password must be at least 6 characters');
      if (pwd.p1 !== pwd.p2) throw new Error('Passwords do not match');
      const base = { role, token, newPassword: pwd.p1 };
      const body = role === 'student' ? { ...base, registrationNo: student.registrationNo } : { ...base, registrationNo: security.registrationNo, name: security.name };
      await api.post('/auth/reset-password', body);
      setMsg('Password reset successful. You can login now.');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Reset failed');
    }
  };

  return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      <div className="glass auth-card max-w-md w-full mx-auto rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold mb-2">Reset your password</h1>
        <div className="grid grid-cols-2 gap-2 bg-gray-200/60 dark:bg-gray-800/70 rounded-lg p-1 mb-4">
          {['student','security'].map((r) => (
            <button key={r} type="button" onClick={() => { setRole(r); setStep(1); setToken(''); setMsg(''); setError(''); }}
              className={`text-sm font-medium rounded-md py-2 transition ${role===r ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow' : 'text-gray-700/80 dark:text-gray-300/80 hover:bg-white/70 dark:hover:bg-gray-900/50'}`}> {r[0].toUpperCase()+r.slice(1)} </button>
          ))}
        </div>

        {error && <div className="mb-3 rounded-md border border-rose-300 bg-rose-50/80 text-rose-800 px-3 py-2 text-sm">{error}</div>}
        {msg && <div className="mb-3 rounded-md border border-emerald-300 bg-emerald-50/80 text-emerald-800 px-3 py-2 text-sm">{msg}</div>}

        {step === 1 && (
          <form className="space-y-3" onSubmit={requestToken}>
            {role === 'student' ? (
              <>
                <input className="input" placeholder="Registration No" value={student.registrationNo} onChange={(e) => setStudent({ ...student, registrationNo: e.target.value })} />
                <input className="input" placeholder="6-digit PIN" value={student.pinCode} onChange={(e) => setStudent({ ...student, pinCode: e.target.value })} maxLength={6} inputMode="numeric" />
              </>
            ) : (
              <>
                <input className="input" placeholder="Security Name" value={security.name} onChange={(e) => setSecurity({ ...security, name: e.target.value })} />
                <input className="input" placeholder="Registration No" value={security.registrationNo} onChange={(e) => setSecurity({ ...security, registrationNo: e.target.value })} />
              </>
            )}
            <button className="btn w-full">Get reset token</button>
          </form>
        )}

        {step === 2 && (
          <form className="space-y-3" onSubmit={submitNewPwd}>
            <input className="input" placeholder="New password" type="password" value={pwd.p1} onChange={(e) => setPwd({ ...pwd, p1: e.target.value })} />
            <input className="input" placeholder="Confirm password" type="password" value={pwd.p2} onChange={(e) => setPwd({ ...pwd, p2: e.target.value })} />
            <button className="btn w-full">Reset password</button>
          </form>
        )}

        <div className="mt-4 text-center text-sm">
          <Link className="underline" to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
