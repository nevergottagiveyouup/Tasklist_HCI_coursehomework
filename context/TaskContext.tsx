
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Task, TaskPriority, TaskStatus, TaskState, SmartListType, SubTask } from '../types';
import { ApiTask, createTaskRequest, deleteTaskRequest, fetchTasksRequest, mapStatusFromApi, mapStatusToApi, updateTaskRequest } from '../api';
import { useAuth } from './AuthContext';

const formatDateTimeString = (value: Task['startDate']) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  // 后端 LocalDateTime 需要包含秒
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

// 后端期望 "yyyy-MM-dd HH:mm"（空格分隔、无秒）格式
const formatBackendDateTimeString = (value: Task['startDate']) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDate = (value: Task['startDate']) => {
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  return normalized instanceof Date ? normalized : new Date(normalized);
};

const inferDurationType = (start: Task['startDate'], due: Task['dueDate']): Task['durationType'] => {
  const startDate = toDate(start);
  const dueDate = toDate(due);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(dueDate.getTime())) return 'short';
  const diffMs = dueDate.getTime() - startDate.getTime();
  return diffMs <= 24 * 60 * 60 * 1000 ? 'short' : 'long';
};

    const deriveStatus = (task: Task, now: Date = new Date()): TaskStatus => {
      // 如果有子任务且全部完成，父任务标记完成
      const hasSubTasks = (task.subTasks?.length ?? 0) > 0;
      const allSubTasksDone = hasSubTasks && task.subTasks!.every(st => !!st.completed);

      if (allSubTasksDone) return TaskStatus.COMPLETED;
      if (task.status === TaskStatus.COMPLETED) return TaskStatus.COMPLETED;

  const start = toDate(task.startDate);
  const due = toDate(task.dueDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return TaskStatus.TODO;
  if (now < start) return TaskStatus.TODO;
  if (now > due) return TaskStatus.ARCHIVED;
  return TaskStatus.IN_PROGRESS;
};

const normalizeTaskDates = (task: Task): Task => {
  const normalized: Task = {
    ...task,
    startDate: formatDateTimeString(task.startDate),
    dueDate: formatDateTimeString(task.dueDate),
    durationType: task.durationType || 'short',
    subTasks: task.subTasks?.map(st => ({
      ...st,
      startTime: formatDateTimeString(st.startTime as any),
      endTime: formatDateTimeString(st.endTime as any),
      completed: !!st.completed
    })) || []
  };

  return { ...normalized, status: deriveStatus(normalized) };
};

const seedGuestTasks = (): Task[] => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const today = now;
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  return [
    {
      id: 'guest-1',
      title: '示例：查看任务时间轴',
      description: '登录后任务将存储在后端；当前为游客模式，仅本次会话有效。',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      startDate: formatDateTimeString(yesterday),
      dueDate: formatDateTimeString(nextWeek),
      durationType: 'long',
      subTasks: [],
      tags: ['Demo'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
};

interface TaskContextType {
  state: TaskState;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setFilter: (filter: Partial<TaskState['filter']>) => void;
  setSort: (sort: Partial<TaskState['sort']>) => void;
  setActiveSmartList: (list: SmartListType) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [state, setState] = useState<TaskState>({
    tasks: [],
    activeSmartList: 'ALL',
    filter: {
      status: 'ALL',
      priority: 'ALL',
      search: ''
    },
    sort: {
      by: 'createdAt',
      order: 'desc'
    }
  });

  const normalizeFromServer = useCallback((serverTask: ApiTask): Task => {
    const start = serverTask.startTime || serverTask.startDate || new Date().toISOString();
    const due = serverTask.endTime || serverTask.dueDate || start;
    const base: Task = {
      id: String(serverTask.id),
      title: serverTask.title || '未命名任务',
      description: serverTask.description || '',
      priority: serverTask.priority || TaskPriority.MEDIUM,
      status: mapStatusFromApi(serverTask.status),
      startDate: start,
      dueDate: due,
      durationType: serverTask.durationType || inferDurationType(start, due),
      subTasks: (serverTask.subTasks as SubTask[] | undefined) || [],
      tags: serverTask.tags || [],
      createdAt: serverTask.createdAt || new Date().toISOString(),
      updatedAt: serverTask.updatedAt || new Date().toISOString()
    };
    return normalizeTaskDates(base);
  }, []);

  const loadTasks = useCallback(async () => {
    if (!token) {
      setState(prev => ({ ...prev, tasks: seedGuestTasks() }));
      return;
    }
    // 清空游客任务，避免短暂显示旧数据
    setState(prev => ({ ...prev, tasks: [] }));
    try {
      const list = await fetchTasksRequest(token);
      setState(prev => ({ ...prev, tasks: list.map(normalizeFromServer) }));
    } catch (err) {
      console.error('Failed to fetch tasks', err);
      setState(prev => ({ ...prev, tasks: [] }));
    }
  }, [token, normalizeFromServer]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const timer = setInterval(() => {
      setState(prev => {
        const now = new Date();
        let changed = false;
        const updatedTasks = prev.tasks.map(task => {
          const nextStatus = deriveStatus(task, now);
          if (nextStatus === task.status) return task;
          changed = true;
          return { ...task, status: nextStatus, updatedAt: new Date().toISOString() };
        });
        if (!changed) return prev;
        return { ...prev, tasks: updatedTasks };
      });
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const buildApiPayload = useCallback((taskData: Partial<Task>) => {
    const normalizeSubTasks = taskData.subTasks?.map(st => ({
      // 后端子任务 id 是 Long；新建时不要传随机字符串，改为 undefined 让后端生成
      id: typeof st.id === 'number' ? st.id : (/^\d+$/.test(st.id) ? Number(st.id) : undefined),
      title: st.title,
      completed: !!st.completed,
      startTime: st.startTime ? formatBackendDateTimeString(st.startTime as any) : undefined,
      endTime: st.endTime ? formatBackendDateTimeString(st.endTime as any) : undefined
    }));

    return {
      title: taskData.title,
      description: taskData.description,
      status: taskData.status !== undefined ? mapStatusToApi(taskData.status) : undefined,
      priority: taskData.priority,
      // backend expects startTime/endTime; keep startDate/dueDate for compatibility
      startTime: taskData.startDate ? formatBackendDateTimeString(taskData.startDate) : undefined,
      endTime: taskData.dueDate ? formatBackendDateTimeString(taskData.dueDate) : undefined,
      startDate: taskData.startDate ? formatBackendDateTimeString(taskData.startDate) : undefined,
      dueDate: taskData.dueDate ? formatBackendDateTimeString(taskData.dueDate) : undefined,
      durationType: taskData.durationType,
      subTasks: normalizeSubTasks,
      tags: taskData.tags
    };
  }, []);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (token) {
      try {
        const created = await createTaskRequest(buildApiPayload(taskData), token);
        const normalized = normalizeFromServer(created);
        setState(prev => ({ ...prev, tasks: [normalized, ...prev.tasks] }));
      } catch (err) {
        console.error('Failed to create task', err);
      }
      return;
    }

    const providedId = taskData.id;
    const newTask: Task = {
      ...taskData,
      startDate: formatDateTimeString(taskData.startDate),
      dueDate: formatDateTimeString(taskData.dueDate),
      subTasks: taskData.subTasks?.map(st => ({
        ...st,
        startTime: formatDateTimeString(st.startTime as any),
        endTime: formatDateTimeString(st.endTime as any)
      })) || [],
      id: providedId || Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const derivedStatus = deriveStatus(newTask);
    setState(prev => ({ ...prev, tasks: [{ ...newTask, status: derivedStatus }, ...prev.tasks] }));
  }, [token, buildApiPayload, normalizeFromServer, state.tasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (token) {
      const current = state.tasks.find(t => String(t.id) === String(id));
      if (!current) {
        console.error('Task not found, cannot update');
        return;
      }
      const mergedClient: Task = {
        ...current,
        ...updates,
        startDate: updates.startDate ?? current.startDate,
        dueDate: updates.dueDate ?? current.dueDate,
        subTasks: updates.subTasks ?? current.subTasks ?? []
      } as Task;
      // 乐观更新，避免子任务完成状态在后端无回传时丢失
      const optimistic = { ...mergedClient, status: deriveStatus(mergedClient) };
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => (String(t.id) === String(id) ? optimistic : t))
      }));

      const payload = buildApiPayload(mergedClient);
      try {
        const updated = await updateTaskRequest(id, payload, token);
        // 部分后端实现不会回传或更新子任务，优先采用客户端提交的子任务状态
        const serverSubs = (updated as any).subTasks;
        const mergedSubs = serverSubs && Array.isArray(serverSubs)
          ? serverSubs.map((s: any) => {
              const clientMatch = (payload.subTasks || []).find(ps => String(ps?.id) === String(s?.id));
              return clientMatch ? { ...s, completed: clientMatch.completed ?? s.completed } : s;
            })
          : (payload.subTasks ?? current.subTasks);

        const mergedServer = {
          ...updated,
          subTasks: mergedSubs
        } as ApiTask;
        const normalized = normalizeFromServer(mergedServer);
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => (String(t.id) === String(id) ? normalized : t))
        }));
      } catch (err) {
        console.error('Failed to update task', err);
      }
      return;
    }

    const normalizedUpdates: Partial<Task> = { ...updates };
    if (updates.startDate !== undefined) normalizedUpdates.startDate = formatDateTimeString(updates.startDate);
    if (updates.dueDate !== undefined) normalizedUpdates.dueDate = formatDateTimeString(updates.dueDate);
    if (updates.subTasks !== undefined) {
      normalizedUpdates.subTasks = updates.subTasks.map(st => ({
        ...st,
        startTime: formatDateTimeString(st.startTime as any),
        endTime: formatDateTimeString(st.endTime as any)
      }));
    }
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== id) return t;
        const merged: Task = { ...t, ...normalizedUpdates } as Task;
        const nextStatus = normalizedUpdates.status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : deriveStatus(merged);
        return { ...merged, status: nextStatus, updatedAt: new Date().toISOString() };
      })
    }));
  }, [token, buildApiPayload, normalizeFromServer, state.tasks]);

  const deleteTask = useCallback(async (id: string) => {
    if (token) {
      try {
        await deleteTaskRequest(id, token);
      } catch (err) {
        console.error('Failed to delete task', err);
      }
    }
    setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  }, [token]);

  const setFilter = useCallback((filter: Partial<TaskState['filter']>) => {
    setState(prev => ({ ...prev, filter: { ...prev.filter, ...filter } }));
  }, []);

  const setSort = useCallback((sort: Partial<TaskState['sort']>) => {
    setState(prev => ({ ...prev, sort: { ...prev.sort, ...sort } }));
  }, []);

  const setActiveSmartList = useCallback((list: SmartListType) => {
    setState(prev => ({ ...prev, activeSmartList: list }));
  }, []);

  const value = useMemo(() => ({ state, addTask, updateTask, deleteTask, setFilter, setSort, setActiveSmartList }), [state, addTask, updateTask, deleteTask, setFilter, setSort, setActiveSmartList]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within TaskProvider');
  return context;
};
