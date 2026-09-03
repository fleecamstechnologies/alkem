import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('authUser');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser());

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { accessToken, user: loggedInUser } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('authUser', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser as AuthUser;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
