import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { fetchUserInfoRequest, loginRequest, registerRequest, updateProfileRequest, mapThemeFromApi } from '../api';
import { useTheme, ThemeMode } from './ThemeContext';

type SessionUser = {
  username: string;
  nickname?: string;
  avatar?: string;
  theme?: ThemeMode;
};

type AuthContextType = {
  user: SessionUser | null;
  token: string | null;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { nickname?: string; currentPassword?: string; newPassword?: string; avatar?: string; theme?: ThemeMode }) => Promise<void>;
};

const SESSION_KEY = 'hci_session';
const TOKEN_KEY = 'hci_token';
const PROFILE_KEY = 'hci_profiles';

type ProfileStore = Record<string, Pick<SessionUser, 'nickname' | 'avatar'>>;

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

const readProfiles = (): ProfileStore => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileStore) : {};
  } catch (e) {
    console.error('Failed to read profiles', e);
    return {};
  }
};

const writeProfile = (username: string, profile: Pick<SessionUser, 'nickname' | 'avatar'>) => {
  const all = readProfiles();
  all[username] = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    const session = readSession();
    if (session?.theme) setTheme(session.theme);
    setUser(session);
    setToken(readToken());
  }, [setTheme]);

  const persistAuth = useCallback((sessionUser: SessionUser, authToken: string) => {
    setUser(sessionUser);
    setToken(authToken);
    writeSession(sessionUser);
    writeToken(authToken);
    if (sessionUser.theme) setTheme(sessionUser.theme);
  }, [setTheme]);

  const syncUserInfo = useCallback(async (authToken: string, fallback?: SessionUser) => {
    try {
      const info = await fetchUserInfoRequest(authToken);
      const normalized: SessionUser = {
        username: info.username || fallback?.username || '',
        nickname: info.nickname || fallback?.nickname || info.username,
        avatar: info.avatar || fallback?.avatar,
        theme: mapThemeFromApi(info.theme)
      };
      persistAuth(normalized, authToken);
    } catch (err) {
      console.error('Failed to fetch user info', err);
      if (fallback) persistAuth(fallback, authToken);
    }
  }, [persistAuth]);

  useEffect(() => {
    if (token && !user) {
      const fallback = readSession() || undefined;
      syncUserInfo(token, fallback || undefined);
    }
  }, [token, user, syncUserInfo]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginRequest(username, password);
    const previous = readSession();
    const profile = readProfiles()[username];
    const fallback: SessionUser = {
      username,
      nickname: profile?.nickname || previous?.nickname || username,
      avatar: profile?.avatar,
      theme: previous?.theme
    };
    await syncUserInfo(res.token, fallback);
  }, [syncUserInfo]);

  const register = useCallback(async (username: string, password: string, nickname?: string) => {
    await registerRequest(username, password, nickname);
    const res = await loginRequest(username, password);
    const sessionUser: SessionUser = { username, nickname: nickname || username };
    writeProfile(username, { nickname: sessionUser.nickname, avatar: sessionUser.avatar });
    await syncUserInfo(res.token, sessionUser);
  }, [syncUserInfo]);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    writeSession(null);
    writeToken(null);
  }, []);

  const updateProfile = useCallback(async (payload: { nickname?: string; currentPassword?: string; newPassword?: string; avatar?: string; theme?: ThemeMode }) => {
    if (!user) throw new Error('请先登录');
    if (token) {
      const res = await updateProfileRequest({
        nickname: payload.nickname,
        avatar: payload.avatar,
        theme: payload.theme,
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword
      }, token);

      const next: SessionUser = {
        username: res.username || user.username,
        nickname: res.nickname || payload.nickname || user.nickname || user.username,
        avatar: res.avatar ?? payload.avatar ?? user.avatar,
        theme: res.theme ? mapThemeFromApi(res.theme) : (payload.theme || user.theme)
      };
      persistAuth(next, token);
      writeProfile(user.username, { nickname: next.nickname, avatar: next.avatar });
      return;
    }

    const next: SessionUser = {
      ...user,
      nickname: payload.nickname || user.nickname || user.username,
      avatar: payload.avatar ?? user.avatar,
      theme: payload.theme || user.theme
    };
    setUser(next);
    writeSession(next);
    writeProfile(user.username, { nickname: next.nickname, avatar: next.avatar });
    if (next.theme) setTheme(next.theme);
  }, [user, token, persistAuth, setTheme]);

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
