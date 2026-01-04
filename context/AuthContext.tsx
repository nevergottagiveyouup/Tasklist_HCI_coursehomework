import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { loginRequest, registerRequest } from '../api';

type SessionUser = {
  username: string;
  nickname?: string;
  avatar?: string;
};

type AuthContextType = {
  user: SessionUser | null;
  token: string | null;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { nickname?: string; currentPassword?: string; newPassword?: string; avatar?: string }) => Promise<void>;
};

const SESSION_KEY = 'hci_session';
const TOKEN_KEY = 'hci_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readSession = (): SessionUser | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch (e) {
    console.error('Failed to read session', e);
    return null;
  }
};

const writeSession = (user: SessionUser | null) => {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
};

const readToken = (): string | null => localStorage.getItem(TOKEN_KEY);
const writeToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setUser(readSession());
    setToken(readToken());
  }, []);

  const persistAuth = useCallback((sessionUser: SessionUser, authToken: string) => {
    setUser(sessionUser);
    setToken(authToken);
    writeSession(sessionUser);
    writeToken(authToken);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginRequest(username, password);
    const previous = readSession();
    const sessionUser: SessionUser = { username, nickname: previous?.nickname || username };
    persistAuth(sessionUser, res.token);
  }, [persistAuth]);

  const register = useCallback(async (username: string, password: string, nickname?: string) => {
    await registerRequest(username, password);
    const res = await loginRequest(username, password);
    const sessionUser: SessionUser = { username, nickname: nickname || username };
    persistAuth(sessionUser, res.token);
  }, [persistAuth]);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    writeSession(null);
    writeToken(null);
  }, []);

  const updateProfile = useCallback(async (payload: { nickname?: string; currentPassword?: string; newPassword?: string; avatar?: string }) => {
    if (!user) throw new Error('请先登录');
    // 后端未提供更新资料接口，这里仅更新本地会话信息以避免功能中断。
    const next: SessionUser = {
      ...user,
      nickname: payload.nickname || user.nickname || user.username,
      avatar: payload.avatar ?? user.avatar
    };
    setUser(next);
    writeSession(next);
  }, [user]);

  const value = useMemo(() => ({ user, token, isGuest: !token, login, register, logout, updateProfile }), [user, token, login, register, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
