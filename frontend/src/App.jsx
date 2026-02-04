import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider, RequireRole, useAuth } from './context/AuthContext';
import Splash from './components/Splash';

// Route-level code splitting (creates route chunks that get precached by the PWA)
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const About = lazy(() => import('./pages/About'));

function Home() {
  const { user } = useAuth();
  if (user) {
    const dest = user.role === 'admin' ? '/admin' : user.role === 'security' ? '/security' : '/student';
    return <Navigate to={dest} replace />;
  }
  // If not logged in, go straight to login (no landing page)
  return <Navigate to="/login" replace />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash only on first load per browser session
    try {
      const seen = sessionStorage.getItem('seen_splash');
      return !seen;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showSplash) return;
    try { sessionStorage.setItem('seen_splash', '1'); } catch {}
  }, [showSplash]);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 transition-colors pt-2">
        {showSplash && <Splash onDone={() => setShowSplash(false)} duration={1200} />}
        <Navbar />
        <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/student" element={<RequireRole role="student"><StudentDashboard /></RequireRole>} />
            <Route path="/about" element={<RequireRole role="student"><About /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
            <Route path="/security" element={<RequireRole role="security"><SecurityDashboard /></RequireRole>} />
          </Routes>
        </Suspense>
      </div>
    </AuthProvider>
  );
}
