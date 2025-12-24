
import React, { useState, useMemo, useEffect } from 'react';
import { TaskProvider, useTasks } from './context/TaskContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { TaskItem } from './components/TaskItem';
import { ICONS, THEME } from './constants';
import { TaskPriority, TaskStatus, Task } from './types';

const Dashboard: React.FC = () => {
  const { state, addTask, setFilter, setActiveSmartList } = useTasks();
  const { t, language, setLanguage } = useLanguage();
  
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
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM,
    startDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0]
  });

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

  // --- 智能分组逻辑 ---
  const groupedTasks = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // 基础过滤
    const filtered = state.tasks.filter(task => {
      if (state.activeSmartList === 'TODAY' && task.dueDate !== todayStr) return false;
      if (state.activeSmartList === 'UPCOMING' && task.dueDate <= todayStr) return false;
      
      const matchSearch = task.title.toLowerCase().includes(state.filter.search.toLowerCase());
      const matchStatus = state.filter.status === 'ALL' || task.status === state.filter.status;
      const matchPriority = state.filter.priority === 'ALL' || task.priority === state.filter.priority;
      return matchSearch && matchStatus && matchPriority;
    });

    // 智能分组
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
      
      if (task.dueDate < todayStr) {
        groups.overdue.push(task);
      } else if (task.startDate < todayStr && task.dueDate >= todayStr) {
        groups.active.push(task);
      } else if (task.dueDate === todayStr) {
        groups.today.push(task);
      } else if (task.dueDate === tomorrowStr) {
        groups.tomorrow.push(task);
      } else {
        // 判断是否在本周内
        const dueDate = new Date(task.dueDate);
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 86400));
        if (diffDays <= 7) groups.thisWeek.push(task);
        else groups.future.push(task);
      }
    });

    return groups;
  }, [state.tasks, state.filter, state.activeSmartList]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    addTask({ ...newTask, status: TaskStatus.TODO, tags: [] });
    setNewTask({
      title: '',
      description: '',
      priority: TaskPriority.MEDIUM,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0]
    });
    setIsAdding(false);
  };

  const counts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      all: state.tasks.length,
      today: state.tasks.filter(t => t.dueDate === today).length,
      upcoming: state.tasks.filter(t => t.dueDate > today).length,
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
          <button onClick={() => setActiveSmartList('ALL')} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'ALL' ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="truncate flex-1 text-left">{t('allTasks')}</span>
            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{counts.all}</span>
          </button>
          <button onClick={() => setActiveSmartList('TODAY')} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'TODAY' ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="truncate flex-1 text-left">{t('today')}</span>
            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{counts.today}</span>
          </button>
          <button onClick={() => setActiveSmartList('UPCOMING')} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${state.activeSmartList === 'UPCOMING' ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="truncate flex-1 text-left">{t('upcoming')}</span>
            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{counts.upcoming}</span>
          </button>
        </nav>
        
        <div className="p-4 shrink-0 space-y-4">
          <div className="bg-indigo-600 text-white p-4 rounded-2xl text-[11px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-150" />
            <p className="font-bold mb-1 flex items-center gap-1"><span className="animate-pulse">✨</span> {t('hciTipTitle')}</p>
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
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 shrink-0 gap-4">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)} icon={<ICONS.Menu />} />
          <h2 className="text-lg font-black text-slate-800 tracking-tight">
            {state.activeSmartList === 'ALL' ? t('allTasks') : state.activeSmartList === 'TODAY' ? t('today') : t('upcoming')}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">{t('pendingTasks', { count: counts.pending })}</p>
              </div>
              <Button icon={<ICONS.Plus />} onClick={() => setIsAdding(true)} className="rounded-xl px-6">{t('addNewTask')}</Button>
            </header>

            {isAdding && (
              <form onSubmit={handleAddTask} className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <Card className="p-6 border-none shadow-2xl ring-1 ring-slate-200">
                  <div className="space-y-5">
                    <Input autoFocus placeholder={t('taskTitlePlaceholder')} value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="text-xl font-bold border-none px-0 focus:ring-0 placeholder:text-slate-200" />
                    <textarea placeholder={t('taskDescPlaceholder')} value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} className="w-full text-sm text-slate-500 border-none px-0 focus:ring-0 resize-none h-20 placeholder:text-slate-200" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-slate-50">
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
                          <input type="date" value={newTask.startDate} onChange={(e) => setNewTask({...newTask, startDate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-3">{t('taskDateLabel')}</label>
                          <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-50">
                    <Button variant="ghost" type="button" onClick={() => setIsAdding(false)}>{t('cancel')}</Button>
                    <Button type="submit" className="px-8 shadow-lg shadow-indigo-100">{t('saveTask')}</Button>
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

            {/* --- 时间轴主视图 --- */}
            <div className="space-y-12 pb-32">
              {(Object.keys(groupedTasks) as Array<keyof typeof groupedTasks>).map(groupKey => {
                const tasks = groupedTasks[groupKey];
                if (tasks.length === 0) return null;
                
                return (
                  <div key={groupKey} className="relative">
                    <div className="flex items-center gap-3 mb-4 sticky top-0 bg-slate-50/80 backdrop-blur-sm z-10 py-2">
                      <div className={`w-2 h-2 rounded-full ${groupKey === 'overdue' ? 'bg-rose-500' : groupKey === 'active' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                      <h3 className={`text-xs font-black uppercase tracking-widest ${groupKey === 'overdue' ? 'text-rose-500' : 'text-slate-400'}`}>
                        {/* Fix: Wrapped groupKey with String() to avoid potential symbol-to-string conversion error */}
                        {t(`groups.${String(groupKey)}`)}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-300 bg-slate-100 px-2 rounded-full">{tasks.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 pl-5 border-l-2 border-slate-100 ml-1">
                      {tasks.map(task => <TaskItem key={task.id} task={task} />)}
                    </div>
                  </div>
                );
              })}
              
              {/* Fix: Cast Object.values results to Task[][] to fix 'length' property error on unknown type */}
              {(Object.values(groupedTasks) as Task[][]).every(g => g.length === 0) && (
                <div className="text-center py-32 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                  <div className="text-slate-200 flex justify-center mb-6 scale-150"><ICONS.Search /></div>
                  <h3 className="text-slate-400 font-bold">{t('noTasks')}</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <TaskProvider>
        <Dashboard />
      </TaskProvider>
    </LanguageProvider>
  );
};

export default App;
