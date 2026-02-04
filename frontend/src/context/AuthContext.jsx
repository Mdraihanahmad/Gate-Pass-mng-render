import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) api.setToken(token);
  }, [token]);

  useEffect(() => {
    // Register a global handler for auth failures
    api.onAuthFailure((message) => {
      setToken(null);
      setUser(null);
      try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
      // Optionally display a toast via a global mechanism; for now, redirect
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams();
        if (message) params.set('msg', message);
        window.location.assign(`/login?${params.toString()}`);
      }
    });
  }, []);

  const login = async (identifier, password, role) => {
    setLoading(true);
    try {
      // Send as registrationNo by default; include name for admin/security
      const payload = { registrationNo: identifier, password };
      if (role && role !== 'student') {
        delete payload.registrationNo;
        payload.name = identifier;
      }
      const { data } = await api.post('/auth/login', payload);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      api.setToken(data.token);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', payload);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      api.setToken(data.token);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const refreshUser = async () => {
    if (!token) return null;
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  };

  return <AuthContext.Provider value={{ token, user, loading, login, signup, logout, refreshUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const RequireRole = ({ role, children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const ok = !!user && (Array.isArray(role) ? role.includes(user.role) : user.role === role);
  if (!ok) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};
