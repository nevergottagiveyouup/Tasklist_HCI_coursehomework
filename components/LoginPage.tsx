import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Input } from './Input';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    navigate('/');
  };

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login');
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        navigate('/');
      } else {
        if (password !== confirmPassword) throw new Error('两次密码不一致');
        await register(username.trim(), password, nickname.trim() || username.trim());
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0" onClick={handleClose} />
      <div className="relative w-full max-w-md mx-auto">
        <Card className="p-6 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-lg font-bold text-slate-800">{mode === 'login' ? '登录' : '注册'}</div>
              <p className="text-xs text-slate-500">使用用户名和密码{mode === 'login' ? '登录' : '注册'}账户</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const next = mode === 'login' ? 'register' : 'login';
                  setMode(next);
                  setSearchParams(next === 'register' ? { mode: 'register' } : {});
                  setError('');
                }}
              >
                切换到{mode === 'login' ? '注册' : '登录'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClose}>
                关闭
              </Button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} required />
            <Input placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            {mode === 'register' && (
              <>
                <Input placeholder="确认密码" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                <Input placeholder="昵称（可选）" value={nickname} onChange={e => setNickname(e.target.value)} />
              </>
            )}
            {mode === 'login' && (
              <p className="text-[11px] text-slate-400">没有账号？点击右上切换注册</p>
            )}
            {error && <div className="text-rose-500 text-sm bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
