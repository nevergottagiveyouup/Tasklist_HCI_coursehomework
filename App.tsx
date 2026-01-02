import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { TaskProvider, useTasks } from './context/TaskContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { TaskItem } from './components/TaskItem';
import { ICONS, THEME } from './constants';
import { TaskPriority, TaskStatus, Task, SubTask } from './types';
import { ConfirmDialog } from './components/ConfirmDialog';
import { StatsView } from './components/StatsView';
import { CompletedStatsView } from './components/CompletedStatsView';
import { LoginPage } from './components/LoginPage';
import { SettingsPage } from './components/SettingsPage';

const parseDateValue = (value: Task['startDate']) => {
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  return normalized instanceof Date ? normalized : new Date(normalized);
};

const toDateTimeLocalString = (value: Task['startDate']) => {
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const defaultDateTimeValue = () => toDateTimeLocalString(new Date());

type NewTaskDraft = Pick<Task, 'title' | 'description' | 'priority' | 'startDate' | 'dueDate' | 'durationType'> & { subTasks: SubTask[] };

const Dashboard: React.FC = () => {
  const { state, addTask, updateTask, setFilter, setActiveSmartList } = useTasks();
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width');
    return saved ? parseInt(saved, 10) : 256;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [pendingRemoveSubTaskIndex, setPendingRemoveSubTaskIndex] = useState<number | null>(null);
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<string[]>([]);
  const [newTask, setNewTask] = useState<NewTaskDraft>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM,
    startDate: defaultDateTimeValue(),
    dueDate: defaultDateTimeValue(),
    durationType: 'short',
    subTasks: []
  });

  const navigate = useNavigate();
  const location = useLocation();
  const isStatsPage = location.pathname.startsWith('/stats');
  const isCompletedStatsPage = location.pathname.startsWith('/completed-stats');
  const isLoginPage = location.pathname.startsWith('/login');
  const isSettingsPage = location.pathname.startsWith('/settings');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(200, e.clientX), 450);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
      }
    };
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const resetFormState = () => {
    setNewTask({
      title: '',
      description: '',
      priority: TaskPriority.MEDIUM,
      startDate: defaultDateTimeValue(),
      dueDate: defaultDateTimeValue(),
      durationType: 'short',
      subTasks: []
    });
    setEditingTaskId(null);
    setFormError('');
    setIsAdding(false);
    setPendingRemoveSubTaskIndex(null);
  };

  const addSubTask = () => {
    setNewTask(prev => ({
      ...prev,
      subTasks: [
        ...prev.subTasks,
        {
          id: Math.random().toString(36).slice(2),
          title: '',
          completed: false,
          startTime: defaultDateTimeValue(),
          endTime: defaultDateTimeValue()
        }
      ]
    }));
  };

  const removeSubTask = (index: number) => {
    setNewTask(prev => ({
      ...prev,
      subTasks: prev.subTasks.filter((_, i) => i !== index)
    }));
  };

  const updateSubTaskField = (index: number, key: keyof SubTask, value: any) => {
    setNewTask(prev => ({
      ...prev,
      subTasks: prev.subTasks.map((st, i) => i === index ? { ...st, [key]: value } : st)
    }));
  };

  const openCreateForm = () => {
    resetFormState();
    setIsAdding(true);
    navigate('/');
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setIsAdding(true);
    setFormError('');
    setPendingRemoveSubTaskIndex(null);
    setNewTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      startDate: toDateTimeLocalString(task.startDate),
      dueDate: toDateTimeLocalString(task.dueDate),
      durationType: task.durationType ?? 'short',
      subTasks: (task.subTasks || []).map(st => ({
        ...st,
        startTime: toDateTimeLocalString(st.startTime),
        endTime: toDateTimeLocalString(st.endTime)
      }))
    });
    navigate('/');
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) {
      setFormError(t('taskTitlePlaceholder'));
      return;
    }

    const baseData = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      priority: newTask.priority,
      startDate: newTask.startDate,
      dueDate: newTask.dueDate,
      durationType: newTask.durationType,
      subTasks: newTask.subTasks.map(st => ({
        ...st,
        startTime: st.startTime,
        endTime: st.endTime
      })),
      tags: [] as string[],
      status: TaskStatus.TODO
    };

    if (editingTaskId) {
      updateTask(editingTaskId, baseData);
      setHighlightedTaskIds([editingTaskId]);
    } else {
      const tempId = Math.random().toString(36).slice(2);
      addTask({ ...baseData, id: tempId } as any);
      setHighlightedTaskIds([tempId]);
    }

    resetFormState();
  };

  const groupedTasks = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const filtered = state.tasks.filter(task => {
      const startDate = toDateTimeLocalString(task.startDate).split('T')[0];
      const dueDate = toDateTimeLocalString(task.dueDate).split('T')[0];

      if (state.activeSmartList === 'TODAY' && dueDate !== todayStr) return false;
      if (state.activeSmartList === 'UPCOMING' && dueDate <= todayStr) return false;

      const matchSearch = task.title.toLowerCase().includes(state.filter.search.toLowerCase());
      const matchStatus = state.filter.status === 'ALL' || task.status === state.filter.status;
      const matchPriority = state.filter.priority === 'ALL' || task.priority === state.filter.priority;
      return matchSearch && matchStatus && matchPriority;
    });

    const groups: Record<string, Task[]> = {
      overdue: [],
      active: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      future: [],
      completed: []
    };

    filtered.forEach(task => {
      if (task.status === TaskStatus.COMPLETED) {
        groups.completed.push(task);
        return;
      }
      const startDate = parseDateValue(task.startDate);
      const dueDate = parseDateValue(task.dueDate);

      if (dueDate < now) {
        groups.overdue.push(task);
      } else if (startDate < now && dueDate >= now) {
        groups.active.push(task);
      } else if (isSameDay(dueDate, now)) {
        groups.today.push(task);
      } else if (isSameDay(dueDate, tomorrow)) {
        groups.tomorrow.push(task);
      } else {
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 86400));
        if (diffDays <= 7) groups.thisWeek.push(task);
        else groups.future.push(task);
      }
    });

    return groups;
  }, [state.tasks, state.filter, state.activeSmartList]);

  const counts = useMemo(() => {
    const today = new Date();
    const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return {
      all: state.tasks.length,
      today: state.tasks.filter(t => isSameDay(parseDateValue(t.dueDate), today)).length,
      upcoming: state.tasks.filter(t => parseDateValue(t.dueDate) >= startOfTomorrow).length,
      pending: state.tasks.filter(t => t.status !== TaskStatus.COMPLETED).length
    };
  }, [state.tasks]);

  return (
    <div className={`flex h-screen bg-slate-50 overflow-hidden ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside 
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        className={`fixed lg:relative h-full bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300 ease-in-out ${!isSidebarOpen ? 'overflow-hidden border-none' : ''}`}
      >
        <div className="p-6 shrink-0">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2 truncate">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-mono shrink-0">IT</div>
            <span className={isSidebarOpen ? 'opacity-100 transition-opacity' : 'opacity-0'}>{t('appName')}</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <button onClick={() => { setActiveSmartList('ALL'); navigate('/'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'ALL' && !isStatsPage && !isCompletedStatsPage ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="truncate flex-1 text-left">{t('allTasks')}</span>
            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{counts.all}</span>
          </button>
          <button onClick={() => { setActiveSmartList('TODAY'); navigate('/'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'TODAY' && !isStatsPage && !isCompletedStatsPage ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="truncate flex-1 text-left">{t('today')}</span>
            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{counts.today}</span>
          </button>
          <button onClick={() => { setActiveSmartList('UPCOMING'); navigate('/'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'UPCOMING' && !isStatsPage && !isCompletedStatsPage ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="truncate flex-1 text-left">{t('upcoming')}</span>
            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{counts.upcoming}</span>
          </button>
        </nav>
        <div className="px-4 pt-2">
          <NavLink
            to="/stats"
            className={({ isActive }) => `w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${isActive ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
            onClick={() => { setIsAdding(false); setEditingTaskId(null); }}
          >
            <ICONS.BarChart />
            任务统计
          </NavLink>
        </div>
        <div className="px-4 pt-2">
          <NavLink
            to="/completed-stats"
            className={({ isActive }) => `w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${isActive ? 'text-emerald-700 bg-emerald-50 shadow-sm ring-1 ring-emerald-200' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
            onClick={() => { setIsAdding(false); setEditingTaskId(null); }}
          >
            <ICONS.Check />
            完成统计
          </NavLink>
        </div>
        
        <div className="p-4 shrink-0 space-y-4">
          <div className="bg-indigo-600 text-white p-4 rounded-2xl text-[11px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-150" />
            <p className="font-bold mb-1 flex items-center gap-1"><span className="animate-pulse"></span> {t('hciTipTitle')}</p>
            <p className="text-indigo-100 leading-normal opacity-90">{t('hciTipDesc')}</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setLanguage('en')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${language === 'en' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>EN</button>
            <button onClick={() => setLanguage('zh')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${language === 'zh' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>中文</button>
          </div>
        </div>
        <div onMouseDown={startResizing} className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 transition-colors z-50 ${isResizing ? 'bg-indigo-500' : 'bg-transparent'}`} />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 shrink-0 gap-4 relative z-30">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)} icon={<ICONS.Menu />} />
          <h2 className="text-lg font-black text-slate-800 tracking-tight">
            {isLoginPage ? '账户登录/注册' : isSettingsPage ? '账户设置' : isStatsPage ? '任务统计' : isCompletedStatsPage ? '完成统计' : (state.activeSmartList === 'ALL' ? t('allTasks') : state.activeSmartList === 'TODAY' ? t('today') : t('upcoming'))}
          </h2>
          <div className="ml-auto flex items-center gap-4">
            {!user && <p className="text-xs text-slate-400 hidden sm:block">请登录以使用全部功能</p>}
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-2 py-1.5 flex items-center gap-2 border-slate-200"
                onClick={() => setIsProfileMenuOpen(v => !v)}
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user?.nickname?.[0] || user?.username?.[0] || '游')
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-700 truncate">{user?.nickname || user?.username || '游客'}</div>
                  <div className="text-[10px] text-slate-400">{user ? '欢迎回来' : '暂未登录'}</div>
                </div>
                <span className={`text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}><ICONS.ChevronDown /></span>
              </Button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 z-40">
                  <div className="px-3 py-2 border-b border-slate-100 mb-2">
                    <div className="text-sm font-semibold text-slate-800">{user?.nickname || user?.username || '游客'}</div>
                    <div className="text-[11px] text-slate-400">{user ? '已登录' : '未登录状态'}</div>
                  </div>
                  {user ? (
                    <div className="space-y-1">
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700"
                        onClick={() => { setIsProfileMenuOpen(false); navigate('/settings'); }}
                      >
                        个人设置
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold text-rose-600"
                        onClick={async () => {
                          await logout();
                          setIsProfileMenuOpen(false);
                          navigate('/login');
                        }}
                      >
                        退出登录
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700"
                        onClick={() => { setIsProfileMenuOpen(false); navigate('/login'); }}
                      >
                        登录
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold text-indigo-600"
                        onClick={() => { setIsProfileMenuOpen(false); navigate('/login?mode=register'); }}
                      >
                        注册
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        {isProfileMenuOpen && <div className="fixed inset-0 z-20" onClick={() => setIsProfileMenuOpen(false)} />}

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={(
                <div className="max-w-4xl mx-auto px-6 py-8">
                  <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">{t('pendingTasks', { count: counts.pending })}</p>
                    </div>
                    <Button icon={<ICONS.Plus />} onClick={openCreateForm} className="rounded-xl px-6">{t('addNewTask')}</Button>
                  </header>

                  {isAdding && (
                    <form onSubmit={handleSubmitTask} className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                      <Card className="p-6 border-none shadow-2xl ring-1 ring-slate-200">
                        <div className="space-y-5">
                          <Input autoFocus placeholder={t('taskTitlePlaceholder')} value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="text-xl font-bold border-none px-0 focus:ring-0 placeholder:text-slate-200" />
                          <textarea placeholder={t('taskDescPlaceholder')} value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} className="w-full text-sm text-slate-500 border-none px-0 focus:ring-0 resize-none h-20 placeholder:text-slate-200" />
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-slate-50">
                            <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3">任务类型</label>
                              <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                                {['short', 'long'].map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setNewTask({ ...newTask, durationType: type as 'short' | 'long' })}
                                    className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${newTask.durationType === type ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:bg-slate-100'}`}
                                  >
                                    {type === 'short' ? '短期任务 (<24h)' : '长期任务 (≥24h)'}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3">{t('taskPriorityLabel')}</label>
                              <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                                {(Object.keys(TaskPriority) as Array<keyof typeof TaskPriority>).map((p) => (
                                  <button key={p} type="button" onClick={() => setNewTask({...newTask, priority: TaskPriority[p]})} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${newTask.priority === TaskPriority[p] ? `${THEME.colors.priority[TaskPriority[p]]} shadow-sm ring-1 ring-black/5` : 'text-slate-400 hover:bg-slate-100'}`}>{t(`priority.${p}`)}</button>
                                ))}
                              </div>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-3">{t('startDateLabel')}</label>
                                <input type="datetime-local" value={toDateTimeLocalString(newTask.startDate)} onChange={(e) => setNewTask({...newTask, startDate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-3">{t('taskDateLabel')}</label>
                                <input type="datetime-local" value={toDateTimeLocalString(newTask.dueDate)} onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-slate-500">子任务</div>
                              <Button type="button" size="sm" variant="secondary" className="px-3" onClick={addSubTask}>添加子任务</Button>
                            </div>
                            {newTask.subTasks.length === 0 && (
                              <div className="text-xs text-slate-400">暂无子任务</div>
                            )}
                            {newTask.subTasks.map((st, idx) => (
                              <div key={st.id} className="bg-white rounded-lg p-3 border border-slate-100 space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={st.completed}
                                    onChange={(e) => updateSubTaskField(idx, 'completed', e.target.checked)}
                                    className="h-4 w-4 text-indigo-600"
                                  />
                                  <Input
                                    value={st.title}
                                    onChange={(e) => updateSubTaskField(idx, 'title', e.target.value)}
                                    placeholder="子任务标题"
                                    className="flex-1"
                                  />
                                  <Button type="button" size="sm" variant="ghost" className="text-rose-500" onClick={() => setPendingRemoveSubTaskIndex(idx)}>
                                    删除
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] text-slate-500">
                                  <div className="space-y-1">
                                    <div className="font-semibold">开始时间</div>
                                    <input
                                      type="datetime-local"
                                      value={toDateTimeLocalString(st.startTime)}
                                      onChange={(e) => updateSubTaskField(idx, 'startTime', e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-semibold">结束时间</div>
                                    <input
                                      type="datetime-local"
                                      value={toDateTimeLocalString(st.endTime)}
                                      onChange={(e) => updateSubTaskField(idx, 'endTime', e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {formError && (
                            <div className="text-rose-500 text-sm bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">{formError}</div>
                          )}
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-50">
                          <Button variant="ghost" type="button" onClick={resetFormState}>{t('cancel')}</Button>
                          <Button type="submit" className="px-8 shadow-lg shadow-indigo-100">{editingTaskId ? '保存修改' : t('saveTask')}</Button>
                        </div>
                      </Card>
                    </form>
                  )}

                  <section className="bg-white p-3 rounded-2xl border border-slate-200 mb-10 flex flex-wrap items-center gap-3 shadow-sm">
                    <div className="flex-1 min-w-[200px]">
                      <Input placeholder={t('searchPlaceholder')} icon={<ICONS.Search />} value={state.filter.search} onChange={(e) => setFilter({ search: e.target.value })} className="border-none bg-slate-50 rounded-xl" />
                    </div>
                    <select className="bg-slate-50 border-none rounded-xl text-xs font-bold px-4 py-2.5 outline-none text-slate-600 cursor-pointer" value={state.filter.status} onChange={(e) => setFilter({ status: e.target.value as TaskStatus | 'ALL' })}>
                      <option value="ALL">{t('allStatus')}</option>
                      <option value={TaskStatus.TODO}>{t('status.TODO')}</option>
                      <option value={TaskStatus.IN_PROGRESS}>{t('status.IN_PROGRESS')}</option>
                      <option value={TaskStatus.COMPLETED}>{t('status.COMPLETED')}</option>
                    </select>
                  </section>

                  <div className="space-y-12 pb-32">
                    {(Object.keys(groupedTasks) as Array<keyof typeof groupedTasks>).map(groupKey => {
                      const tasks = groupedTasks[groupKey];
                      if (tasks.length === 0) return null;
                      
                      return (
                        <div key={groupKey} className="relative">
                          <div className="flex items-center gap-3 mb-4 sticky top-0 bg-slate-50/80 backdrop-blur-sm z-10 py-2">
                            <div className={`w-2 h-2 rounded-full ${groupKey === 'overdue' ? 'bg-rose-500' : groupKey === 'active' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                            <h3 className={`text-xs font-black uppercase tracking-widest ${groupKey === 'overdue' ? 'text-rose-500' : 'text-slate-400'}`}>
                              {t(`groups.${String(groupKey)}`)}
                            </h3>
                            <span className="text-[10px] font-bold text-slate-300 bg-slate-100 px-2 rounded-full">{tasks.length}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 pl-5 border-l-2 border-slate-100 ml-1">
                            {tasks.map(task => (
                              <TaskItem
                                key={task.id}
                                task={task}
                                highlighted={highlightedTaskIds.includes(task.id)}
                                onEdit={() => openEditTask(task)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {(Object.values(groupedTasks) as Task[][]).every(g => g.length === 0) && (
                      <div className="text-center py-32 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                        <div className="text-slate-200 flex justify-center mb-6 scale-150"><ICONS.Search /></div>
                        <h3 className="text-slate-400 font-bold">{t('noTasks')}</h3>
                      </div>
                    )}
                  </div>
                </div>
              )}
            />
            <Route
              path="/stats"
              element={<StatsView tasks={state.tasks} filter={state.filter} highlightedTaskIds={highlightedTaskIds} onEditTask={openEditTask} />}
            />
            <Route
              path="/completed-stats"
              element={<CompletedStatsView tasks={state.tasks} />}
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <ConfirmDialog
        open={pendingRemoveSubTaskIndex !== null}
        message={`确定要删除任务「${pendingRemoveSubTaskIndex !== null ? (newTask.subTasks[pendingRemoveSubTaskIndex]?.title || '子任务') : '子任务'}」吗？此操作不可恢复。`}
        onCancel={() => setPendingRemoveSubTaskIndex(null)}
        onConfirm={() => {
          if (pendingRemoveSubTaskIndex !== null) {
            removeSubTask(pendingRemoveSubTaskIndex);
          }
          setPendingRemoveSubTaskIndex(null);
        }}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TaskProvider>
          <Dashboard />
        </TaskProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
