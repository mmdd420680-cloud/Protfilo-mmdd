import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, setClientAuthToken, getClientAuthToken } from '../services/api';
import type { AdminUser } from '../types/portfolio';

interface AuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshAdmin = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/session');
      const sessionAdmin = res.data?.data?.admin || null;
      setAdmin(sessionAdmin);
      if (!sessionAdmin && getClientAuthToken()) {
        setClientAuthToken(null);
      }
    } catch {
      setAdmin(null);
      if (getClientAuthToken()) {
        setClientAuthToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAdmin();
  }, [refreshAdmin]);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { token, admin: loggedInAdmin } = res.data.data;
    if (token) {
      setClientAuthToken(token);
    }
    setAdmin(loggedInAdmin);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setClientAuthToken(null);
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        isAuthenticated: Boolean(admin),
        login,
        logout,
        refreshAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
