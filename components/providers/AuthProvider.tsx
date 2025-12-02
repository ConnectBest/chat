"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Static code Backend team please change it to dynamic
interface User {
  id: string;
  email: string;
  name?: string;
  status?: string;
  avatarUrl?: string;
  role?: 'user' | 'admin';
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { // attempt session restoration
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      // Static code Backend team please change it to dynamic (POST /api/auth/login)
      const { data } = await axios.post('/api/auth/login', { email, password });
      setUser(data.user);
      if (data.token) { localStorage.setItem('mock_token', data.token); }
      window.location.href = '/chat';
    } catch (err) {
      console.error('Login failed:', err);
      alert('Login failed. Please register first or check credentials.');
      throw err;
    } finally { setLoading(false); }
  }

  async function register(email: string, password: string, name?: string) {
    setLoading(true);
    try {
      // Static code Backend team please change it to dynamic (POST /api/auth/register)
      const { data } = await axios.post('/api/auth/register', { email, password, name });
      setUser(data.user);
      if (data.token) { localStorage.setItem('mock_token', data.token); }
      window.location.href = '/chat';
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Registration failed. Please try again.');
      throw err;
    } finally { setLoading(false); }
  }

  async function logout() {
    setLoading(true);
    try {
      // Static code Backend team please change it to dynamic (POST /api/auth/logout)
      await axios.post('/api/auth/logout');
      setUser(null);
      localStorage.removeItem('mock_token');
    } finally { setLoading(false); }
  }

  async function refresh() {
    setLoading(true);
    try {
      // Static code Backend team please change it to dynamic (GET /api/auth/me)
      const token = typeof window !== 'undefined' ? localStorage.getItem('mock_token') : null;
      const { data } = await axios.get('/api/auth/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setUser(data.user);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
