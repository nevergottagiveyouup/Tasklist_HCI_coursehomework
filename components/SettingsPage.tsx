import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Input } from './Input';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => navigate('/');

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      // 先持久化主题，再保存昵称/密码
      setTheme(selectedTheme);
      await updateProfile({ nickname: nickname.trim() || user?.username, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined });
      setMessage('保存成功');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0" onClick={handleClose} />
      <div className="relative w-full max-w-md mx-auto">
        <Card className="p-6 shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <div className="text-lg font-bold text-slate-800">设置</div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleSave} disabled={loading}>
                快速保存
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClose}>
                关闭
              </Button>
            </div>
          </div>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 font-semibold">主题切换</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'light', label: '浅色' },
                  { key: 'dark', label: '深色' },
                  { key: 'eye', label: '护眼' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedTheme(opt.key as any)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${selectedTheme === opt.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 font-semibold">昵称</div>
              <Input placeholder="昵称" value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
            <div className="text-xs text-slate-500 font-semibold">修改密码（可选）</div>
            <Input placeholder="当前密码" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            <Input placeholder="新密码" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            {error && <div className="text-rose-500 text-sm bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">{error}</div>}
            {message && <div className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{message}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '保存中…' : '保存'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
