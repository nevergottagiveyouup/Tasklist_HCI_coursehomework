import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

type UserRecord = {
  username: string;
  password: string;
  nickname: string;
  avatar?: string;
};

type SessionUser = Omit<UserRecord, 'password'>;

type AuthContextType = {
  user: SessionUser | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { nickname?: string; currentPassword?: string; newPassword?: string; avatar?: string }) => Promise<void>;
};

const USERS_KEY = 'hci_users';
const SESSION_KEY = 'hci_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readUsers = (): UserRecord[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserRecord[];
  } catch (e) {
    console.error('Failed to read users', e);
    return [];
  }
};

const writeUsers = (users: UserRecord[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(readSession());
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const users = readUsers();
    const found = users.find(u => u.username === username && u.password === password);
    if (!found) throw new Error('用户名或密码错误');
    const sessionUser: SessionUser = { username: found.username, nickname: found.nickname, avatar: found.avatar };
    setUser(sessionUser);
    writeSession(sessionUser);
  }, []);

  const register = useCallback(async (username: string, password: string, nickname?: string) => {
    const users = readUsers();
    if (users.some(u => u.username === username)) {
      throw new Error('用户名已存在');
    }
    const record: UserRecord = { username, password, nickname: nickname || username, avatar: undefined };
    const next = [...users, record];
    writeUsers(next);
    const sessionUser: SessionUser = { username, nickname: record.nickname, avatar: record.avatar };
    setUser(sessionUser);
    writeSession(sessionUser);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    writeSession(null);
  }, []);

  const updateProfile = useCallback(async (payload: { nickname?: string; currentPassword?: string; newPassword?: string; avatar?: string }) => {
    const users = readUsers();
    if (!user) throw new Error('请先登录');
    const idx = users.findIndex(u => u.username === user.username);
    if (idx === -1) throw new Error('用户不存在');
    const current = users[idx];

    if (payload.newPassword) {
      if (!payload.currentPassword) throw new Error('请提供当前密码');
      if (payload.currentPassword !== current.password) throw new Error('当前密码不正确');
      current.password = payload.newPassword;
    }

    if (payload.nickname) current.nickname = payload.nickname;
    if (payload.avatar !== undefined) current.avatar = payload.avatar;

    users[idx] = current;
    writeUsers(users);
    const sessionUser: SessionUser = { username: current.username, nickname: current.nickname, avatar: current.avatar };
    setUser(sessionUser);
    writeSession(sessionUser);
  }, [user]);

  const value = useMemo(() => ({ user, login, register, logout, updateProfile }), [user, login, register, logout, updateProfile]);

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
