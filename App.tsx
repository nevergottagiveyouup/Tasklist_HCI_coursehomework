import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { TaskProvider, useTasks } from './context/TaskContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { TaskItem } from './components/TaskItem';
import { ClockTimePicker } from './components/ClockTimePicker';
import { ICONS, THEME } from './constants';
import { TaskPriority, TaskStatus, Task, SubTask } from './types';
import { ConfirmDialog } from './components/ConfirmDialog';
import { StatsView } from './components/StatsView';
import { CompletedStatsView } from './components/CompletedStatsView';
import { LoginPage } from './components/LoginPage';
import { SettingsPage } from './components/SettingsPage';
import { ThemeProvider, useTheme } from './context/ThemeContext';

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

type NewTaskDraft = Pick<Task, 'title' | 'description' | 'priority' | 'startDate' | 'dueDate'> & { subTasks: SubTask[] };

const inferDurationType = (start: Task['startDate'], due: Task['dueDate']): Task['durationType'] => {
  const startDate = parseDateValue(start);
  const dueDate = parseDateValue(due);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(dueDate.getTime())) return 'short';
  const diffMs = dueDate.getTime() - startDate.getTime();
  return diffMs <= 24 * 60 * 60 * 1000 ? 'short' : 'long';
};

const PRIORITY_TEXT: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'text-slate-600',
  [TaskPriority.MEDIUM]: 'text-amber-600',
  [TaskPriority.HIGH]: 'text-orange-600',
  [TaskPriority.URGENT]: 'text-rose-600'
};

const splitDateTime = (value: Task['startDate']) => {
  const dateObj = parseDateValue(value);
  if (Number.isNaN(dateObj.getTime())) {
    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    return {
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      hour: now.getHours(),
      minute: now.getMinutes()
    };
  }
  const pad = (num: number) => String(num).padStart(2, '0');
  return {
    date: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
    hour: dateObj.getHours(),
    minute: dateObj.getMinutes()
  };
};

const withDatePart = (value: Task['startDate'], dateStr: string) => {
  const parts = splitDateTime(value);
  return `${dateStr}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
};

const withTimePart = (value: Task['startDate'], hour: number, minute: number) => {
  const parts = splitDateTime(value);
  return `${parts.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const Dashboard: React.FC = () => {
  const { state, addTask, updateTask, setFilter, setActiveSmartList } = useTasks();
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const { styles: themeStyles } = useTheme();

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
    subTasks: []
  });
  const [pendingConflict, setPendingConflict] = useState<{ conflictTask: Task; data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>; editingId: string | null } | null>(null);
  const inferredDuration = useMemo(() => inferDurationType(newTask.startDate, newTask.dueDate), [newTask.startDate, newTask.dueDate]);

  const navigate = useNavigate();
  const location = useLocation();
  const isStatsPage = location.pathname.startsWith('/stats');
  const isCompletedStatsPage = location.pathname.startsWith('/completed-stats');
  const isLoginPage = location.pathname.startsWith('/login');
  const isSettingsPage = location.pathname.startsWith('/settings');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const findShortTaskConflict = useCallback((candidate: { startDate: Task['startDate']; dueDate: Task['dueDate']; id?: string; }) => {
    const durationType = inferDurationType(candidate.startDate, candidate.dueDate);
    if (durationType !== 'short') return null;

    const start = parseDateValue(candidate.startDate);
    const end = parseDateValue(candidate.dueDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    return state.tasks.find(task => {
      if (task.id === candidate.id) return false;
      if (task.durationType !== 'short') return false;
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.ARCHIVED) return false;

      const taskStart = parseDateValue(task.startDate);
      const taskEnd = parseDateValue(task.dueDate);
      const overlapMs = Math.min(taskEnd.getTime(), end.getTime()) - Math.max(taskStart.getTime(), start.getTime());
      return overlapMs > 30 * 60 * 1000; // overlap longer than 30 minutes
    }) || null;
  }, [state.tasks]);

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

  const resetFormState = useCallback(() => {
    setNewTask({
      title: '',
      description: '',
      priority: TaskPriority.MEDIUM,
      startDate: defaultDateTimeValue(),
      dueDate: defaultDateTimeValue(),
      subTasks: []
    });
    setEditingTaskId(null);
    setFormError('');
    setIsAdding(false);
    setPendingRemoveSubTaskIndex(null);
  }, []);

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

  const persistTask = useCallback((data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, editingId: string | null) => {
    if (editingId) {
      updateTask(editingId, data);
      setHighlightedTaskIds([editingId]);
    } else {
      const tempId = Math.random().toString(36).slice(2);
      addTask({ ...data, id: tempId });
      setHighlightedTaskIds([tempId]);
    }

    setPendingConflict(null);
    resetFormState();
  }, [addTask, resetFormState, updateTask]);

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
      setFormError(t('taskTitleMissing'));
      return;
    }

    const startDateObj = parseDateValue(newTask.startDate);
    const dueDateObj = parseDateValue(newTask.dueDate);
    if (!Number.isNaN(startDateObj.getTime()) && !Number.isNaN(dueDateObj.getTime()) && dueDateObj <= startDateObj) {
      setFormError(t('endAfterStartError'));
      return;
    }

    const durationType = inferDurationType(newTask.startDate, newTask.dueDate);
    const baseData = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      priority: newTask.priority,
      startDate: newTask.startDate,
      dueDate: newTask.dueDate,
      durationType,
      subTasks: newTask.subTasks.map(st => ({
        ...st,
        startTime: st.startTime,
        endTime: st.endTime
      })),
      tags: [] as string[],
      status: TaskStatus.TODO
    };

    const conflict = findShortTaskConflict({ ...baseData, id: editingTaskId || undefined });
    if (conflict) {
      setFormError('');
      setHighlightedTaskIds([conflict.id]);
      setPendingConflict({ conflictTask: conflict, data: baseData, editingId: editingTaskId });
      return;
    }

    persistTask(baseData, editingTaskId);
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
    <div className={`flex h-screen overflow-hidden ${themeStyles.page} ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside 
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        className={`fixed lg:relative h-full ${themeStyles.chromeBg} border-r ${themeStyles.chromeBorder} flex flex-col z-50 transition-all duration-300 ease-in-out ${!isSidebarOpen ? 'overflow-hidden border-none' : ''}`}
      >
        <div className="p-6 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2 truncate text-indigo-500">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-mono shrink-0">IT</div>
            <span className={isSidebarOpen ? 'opacity-100 transition-opacity' : 'opacity-0'}>{t('appName')}</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <button onClick={() => { setActiveSmartList('ALL'); navigate('/'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'ALL' && !isStatsPage && !isCompletedStatsPage ? themeStyles.pillActive : themeStyles.pillInactive}`}>
            <span className="truncate flex-1 text-left">{t('allTasks')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${themeStyles.surfaceSoft}`}>{counts.all}</span>
          </button>
          <button onClick={() => { setActiveSmartList('TODAY'); navigate('/'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'TODAY' && !isStatsPage && !isCompletedStatsPage ? themeStyles.pillActive : themeStyles.pillInactive}`}>
            <span className="truncate flex-1 text-left">{t('today')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${themeStyles.surfaceSoft}`}>{counts.today}</span>
          </button>
          <button onClick={() => { setActiveSmartList('UPCOMING'); navigate('/'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'UPCOMING' && !isStatsPage && !isCompletedStatsPage ? themeStyles.pillActive : themeStyles.pillInactive}`}>
            <span className="truncate flex-1 text-left">{t('upcoming')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${themeStyles.surfaceSoft}`}>{counts.upcoming}</span>
          </button>
        </nav>
        <div className="px-4 pt-2">
          <NavLink
            to="/stats"
            className={({ isActive }) => `w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${isActive ? themeStyles.pillActive : themeStyles.pillInactive}`}
            onClick={() => { setIsAdding(false); setEditingTaskId(null); }}
          >
            <ICONS.BarChart />
            任务统计
          </NavLink>
        </div>
        <div className="px-4 pt-2">
          <NavLink
            to="/completed-stats"
            className={({ isActive }) => `w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${isActive ? themeStyles.pillActive : themeStyles.pillInactive}`}
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
          <div className={`${themeStyles.surfaceSoft} flex p-1 rounded-xl`}>
            <button onClick={() => setLanguage('en')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${language === 'en' ? themeStyles.pillActive : themeStyles.pillInactive}`}>EN</button>
            <button onClick={() => setLanguage('zh')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${language === 'zh' ? themeStyles.pillActive : themeStyles.pillInactive}`}>中文</button>
          </div>
        </div>
        <div onMouseDown={startResizing} className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 transition-colors z-50 ${isResizing ? 'bg-indigo-500' : 'bg-transparent'}`} />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className={`h-16 border-b ${themeStyles.chromeBorder} ${themeStyles.chromeBg} flex items-center px-6 shrink-0 gap-4 relative z-30`}>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)} icon={<ICONS.Menu />} />
          <h2 className="text-lg font-black tracking-tight">
            {isLoginPage ? '账户登录/注册' : isSettingsPage ? '账户设置' : isStatsPage ? '任务统计' : isCompletedStatsPage ? '完成统计' : (state.activeSmartList === 'ALL' ? t('allTasks') : state.activeSmartList === 'TODAY' ? t('today') : t('upcoming'))}
          </h2>
          <div className="ml-auto flex items-center gap-4">
            {!user && <p className={`text-xs hidden sm:block ${themeStyles.mutedText}`}>请登录以使用全部功能</p>}
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-2 py-1.5 flex items-center gap-2"
                onClick={() => setIsProfileMenuOpen(v => !v)}
              >
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-slate-600 font-bold uppercase overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user?.nickname?.[0] || user?.username?.[0] || '游')
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold truncate">{user?.nickname || user?.username || '游客'}</div>
                  <div className={`text-[10px] ${themeStyles.mutedText}`}>{user ? '欢迎回来' : '暂未登录'}</div>
                </div>
                <span className={`transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}><ICONS.ChevronDown /></span>
              </Button>
              {isProfileMenuOpen && (
                <div className={`absolute right-0 mt-3 w-56 ${themeStyles.surface} rounded-2xl shadow-2xl p-2 z-40`}>
                  <div className={`px-3 py-2 border-b ${themeStyles.chromeBorder} mb-2`}>
                    <div className="text-sm font-semibold">{user?.nickname || user?.username || '游客'}</div>
                    <div className={`text-[11px] ${themeStyles.mutedText}`}>{user ? '已登录' : '未登录状态'}</div>
                  </div>
                  {user ? (
                    <div className="space-y-1">
                      <button
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold hover:opacity-80`}
                        onClick={() => { setIsProfileMenuOpen(false); navigate('/settings'); }}
                      >
                        个人设置
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:opacity-80"
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
                        className="w-full text-left px-3 py-2 rounded-xl hover:opacity-80 text-sm font-semibold"
                        onClick={() => { setIsProfileMenuOpen(false); navigate('/login'); }}
                      >
                        登录
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl hover:opacity-80 text-sm font-semibold text-indigo-600"
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
                      <p className={`text-sm font-medium ${themeStyles.mutedText}`}>{t('pendingTasks', { count: counts.pending })}</p>
                    </div>
                    <Button icon={<ICONS.Plus />} onClick={openCreateForm} className="rounded-xl px-6">{t('addNewTask')}</Button>
                  </header>

                  {isAdding && (
                    <form onSubmit={handleSubmitTask} className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                      <Card className="p-6 border-none shadow-2xl ring-1 ring-slate-200">
                        <div className="space-y-5">
                          <Input autoFocus placeholder={t('taskTitlePlaceholder')} value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="text-xl font-bold border-none px-0 focus:ring-0" />
                          <textarea
                            placeholder={t('taskDescPlaceholder')}
                            value={newTask.description}
                            onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                            className={`w-full text-sm resize-none h-20 px-3 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none ${themeStyles.surfaceSoft} ${themeStyles.mutedText}`}
                          />
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-slate-50">
                            <div className="space-y-2">
                              <label className={`block text-[10px] font-black uppercase mb-1 ${themeStyles.mutedText}`}>任务类型（自动判定）</label>
                              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black ${themeStyles.surfaceSoft} ${themeStyles.mutedText} ${inferredDuration === 'short' ? 'text-indigo-600' : 'text-amber-600'}`}>
                                {inferredDuration === 'short' ? '短期任务（≤24h）' : '长期任务（＞24h）'}
                              </div>
                              <p className={`text-[11px] ${themeStyles.mutedText}`}>根据开始/结束时间自动判断，无需手动切换。</p>
                            </div>
                            <div>
                              <label className={`block text-[10px] font-black uppercase mb-3 ${themeStyles.mutedText}`}>{t('taskPriorityLabel')}</label>
                              <div className={`flex p-1 rounded-xl gap-1 ${themeStyles.surfaceSoft}`}>
                                {(Object.keys(TaskPriority) as Array<keyof typeof TaskPriority>).map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => setNewTask({...newTask, priority: TaskPriority[p]})}
                                    className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${newTask.priority === TaskPriority[p]
                                      ? `${themeStyles.surfaceSoft} ${PRIORITY_TEXT[TaskPriority[p]]} shadow-sm ring-2 ring-indigo-200/70 ring-offset-1 ring-offset-black/5`
                                      : `${themeStyles.mutedText} hover:opacity-80`}`}
                                  >
                                    {t(`priority.${p}`)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                              <div>
                                <label className={`block text-[10px] font-black uppercase mb-3 ${themeStyles.mutedText}`}>{t('startDateLabel')}</label>
                                <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
                                  <input
                                    type="date"
                                    value={splitDateTime(newTask.startDate).date}
                                    onChange={(e) => setNewTask({...newTask, startDate: withDatePart(newTask.startDate, e.target.value)})}
                                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 calendar-picker ${themeStyles.input}`}
                                  />
                                  <ClockTimePicker
                                    hour={splitDateTime(newTask.startDate).hour}
                                    minute={splitDateTime(newTask.startDate).minute}
                                    onChange={(h, m) => setNewTask({...newTask, startDate: withTimePart(newTask.startDate, h, m)})}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-[10px] font-black uppercase mb-3 ${themeStyles.mutedText}`}>{t('taskDateLabel')}</label>
                                <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
                                  <input
                                    type="date"
                                    value={splitDateTime(newTask.dueDate).date}
                                    onChange={(e) => setNewTask({...newTask, dueDate: withDatePart(newTask.dueDate, e.target.value)})}
                                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 calendar-picker ${themeStyles.input}`}
                                  />
                                  <ClockTimePicker
                                    hour={splitDateTime(newTask.dueDate).hour}
                                    minute={splitDateTime(newTask.dueDate).minute}
                                    onChange={(h, m) => setNewTask({...newTask, dueDate: withTimePart(newTask.dueDate, h, m)})}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={`space-y-3 p-3 rounded-xl ${themeStyles.surfaceSoft}`}>
                            <div className="flex items-center justify-between">
                              <div className={`text-xs font-bold ${themeStyles.mutedText}`}>子任务</div>
                              <Button type="button" size="sm" variant="secondary" className="px-3" onClick={addSubTask}>添加子任务</Button>
                            </div>
                            {newTask.subTasks.length === 0 && (
                              <div className={`text-xs ${themeStyles.mutedText}`}>暂无子任务</div>
                            )}
                            {newTask.subTasks.map((st, idx) => (
                              <div key={st.id} className={`rounded-lg p-3 space-y-2 ${themeStyles.surfaceSoft}`}>
                                <div className="flex items-center gap-3">
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
                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px] ${themeStyles.mutedText}`}>
                                  <div className="space-y-2">
                                    <div className="font-semibold">开始日期</div>
                                    <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
                                      <input
                                        type="date"
                                        value={splitDateTime(st.startTime).date}
                                        onChange={(e) => updateSubTaskField(idx, 'startTime', withDatePart(st.startTime, e.target.value))}
                                        className={`w-full px-4 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 calendar-picker ${themeStyles.input}`}
                                      />
                                      <ClockTimePicker
                                        hour={splitDateTime(st.startTime).hour}
                                        minute={splitDateTime(st.startTime).minute}
                                        onChange={(h, m) => updateSubTaskField(idx, 'startTime', withTimePart(st.startTime, h, m))}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="font-semibold">结束日期</div>
                                    <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
                                      <input
                                        type="date"
                                        value={splitDateTime(st.endTime).date}
                                        onChange={(e) => updateSubTaskField(idx, 'endTime', withDatePart(st.endTime, e.target.value))}
                                        className={`w-full px-4 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 calendar-picker ${themeStyles.input}`}
                                      />
                                      <ClockTimePicker
                                        hour={splitDateTime(st.endTime).hour}
                                        minute={splitDateTime(st.endTime).minute}
                                        onChange={(h, m) => updateSubTaskField(idx, 'endTime', withTimePart(st.endTime, h, m))}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {formError && (
                            <div className={`text-rose-500 text-sm border border-rose-200 px-3 py-2 rounded-lg ${themeStyles.surfaceSoft}`}>
                              {formError}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-50">
                          <Button variant="ghost" type="button" onClick={resetFormState}>{t('cancel')}</Button>
                          <Button type="submit" className={`px-8 ${themeStyles.primaryShadow}`}>{editingTaskId ? '保存修改' : t('saveTask')}</Button>
                        </div>
                      </Card>
                    </form>
                  )}

                  <section className={`${themeStyles.surface} p-3 rounded-2xl mb-10 flex flex-wrap items-center gap-3 shadow-sm`}>
                    <div className="flex-1 min-w-[200px]">
                      <Input placeholder={t('searchPlaceholder')} icon={<ICONS.Search />} value={state.filter.search} onChange={(e) => setFilter({ search: e.target.value })} className="border-none rounded-xl" />
                    </div>
                    <select className={`${themeStyles.input} rounded-xl text-xs font-bold px-4 py-2.5 outline-none cursor-pointer`} value={state.filter.status} onChange={(e) => setFilter({ status: e.target.value as TaskStatus | 'ALL' })}>
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
                          <div className="flex items-center gap-3 mb-4 sticky top-0 backdrop-blur-sm z-10 py-2">
                            <div className={`w-2 h-2 rounded-full ${groupKey === 'overdue' ? 'bg-rose-500' : groupKey === 'active' ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                            <h3 className={`text-xs font-black uppercase tracking-widest ${groupKey === 'overdue' ? 'text-rose-500' : themeStyles.mutedText}`}>
                              {t(`groups.${String(groupKey)}`)}
                            </h3>
                            <span className={`text-[10px] font-bold px-2 rounded-full ${themeStyles.surfaceSoft}`}>{tasks.length}</span>
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
                      <div className={`text-center py-32 rounded-[32px] border-2 border-dashed ${themeStyles.surfaceSoft}`}>
                        <div className="opacity-50 flex justify-center mb-6 scale-150"><ICONS.Search /></div>
                        <h3 className={`font-bold ${themeStyles.mutedText}`}>{t('noTasks')}</h3>
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
        open={!!pendingConflict}
        message={`⚠️ 该任务与「${pendingConflict?.conflictTask.title || ''}」时间冲突，是否继续？`}
        cancelLabel="调整时间"
        confirmLabel="强制添加"
        onCancel={() => setPendingConflict(null)}
        onConfirm={() => {
          if (!pendingConflict) return;
          persistTask(pendingConflict.data, pendingConflict.editingId);
        }}
      />

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
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TaskProvider>
            <Dashboard />
          </TaskProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
