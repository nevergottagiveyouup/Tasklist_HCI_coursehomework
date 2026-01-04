
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Task, TaskPriority, TaskStatus, TaskState, SmartListType, SubTask } from '../types';

const formatDateTimeString = (value: Task['startDate']) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDate = (value: Task['startDate']) => {
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  return date;
};

const deriveStatus = (task: Task, now: Date = new Date()): TaskStatus => {
  // Completed tasks remain completed
  if (task.status === TaskStatus.COMPLETED) return TaskStatus.COMPLETED;

  const start = toDate(task.startDate);
  const due = toDate(task.dueDate);

  const hasSubTasks = (task.subTasks?.length ?? 0) > 0;
  const allSubTasksDone = hasSubTasks && task.subTasks!.every(st => !!st.completed);

  if (allSubTasksDone) return TaskStatus.COMPLETED;

  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return TaskStatus.TODO;
  }

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

  return {
    ...normalized,
    status: deriveStatus(normalized)
  };
};

interface TaskContextType {
  state: TaskState;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setFilter: (filter: Partial<TaskState['filter']>) => void;
  setSort: (sort: Partial<TaskState['sort']>) => void;
  setActiveSmartList: (list: SmartListType) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  useEffect(() => {
    const saved = localStorage.getItem('hci_tasks');
    if (saved) {
      try {
        const parsed: Task[] = JSON.parse(saved);
        setState(prev => ({ ...prev, tasks: parsed.map(normalizeTaskDates) }));
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    } else {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const today = now;
      const tomorrow = new Date(now.getTime() + 86400000);
      const nextWeek = new Date(now.getTime() + 7 * 86400000);
      const longTimeAgo = new Date(now.getTime() - 5 * 86400000);

      const seed: Task[] = [
        {
          id: 'overdue-1',
          title: '逾期任务演示：提交开题报告',
          description: '这是一个已经超过截止日期的任务，系统应自动标记为逾期。',
          priority: TaskPriority.URGENT,
          status: TaskStatus.TODO,
          startDate: formatDateTimeString(longTimeAgo),
          dueDate: formatDateTimeString(yesterday),
          durationType: 'long',
          subTasks: [],
          tags: ['Urgent'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'active-1',
          title: '跨周项目：HCI 系统原型开发',
          description: '从上周开始，持续到下周的长跨度任务。',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          startDate: formatDateTimeString(yesterday),
          dueDate: formatDateTimeString(nextWeek),
          durationType: 'long',
          subTasks: [],
          tags: ['Coding'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'today-1',
          title: '今日任务：小组站会',
          description: '讨论关于时间轴布局的反馈。',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.TODO,
          startDate: formatDateTimeString(today),
          dueDate: formatDateTimeString(today),
          durationType: 'short',
          subTasks: [],
          tags: ['Meeting'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'future-1',
          title: '远期任务：期末考试复习',
          description: '下周才开始的任务，属于远期规划。',
          priority: TaskPriority.LOW,
          status: TaskStatus.TODO,
          startDate: formatDateTimeString(nextWeek),
          dueDate: formatDateTimeString(new Date(nextWeek.getTime() + 3 * 86400000)),
          durationType: 'long',
          subTasks: [],
          tags: ['Study'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      setState(prev => ({ ...prev, tasks: seed }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hci_tasks', JSON.stringify(state.tasks));
  }, [state.tasks]);

  useEffect(() => {
    // Periodically reconcile task status based on current time
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

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
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
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const normalizedUpdates: Partial<Task> = { ...updates };
    if (updates.startDate !== undefined) {
      normalizedUpdates.startDate = formatDateTimeString(updates.startDate);
    }
    if (updates.dueDate !== undefined) {
      normalizedUpdates.dueDate = formatDateTimeString(updates.dueDate);
    }
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
        const nextStatus = normalizedUpdates.status === TaskStatus.COMPLETED
          ? TaskStatus.COMPLETED
          : deriveStatus(merged);
        return { ...merged, status: nextStatus, updatedAt: new Date().toISOString() };
      })
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id)
    }));
  }, []);

  const setFilter = useCallback((filter: Partial<TaskState['filter']>) => {
    setState(prev => ({ ...prev, filter: { ...prev.filter, ...filter } }));
  }, []);

  const setSort = useCallback((sort: Partial<TaskState['sort']>) => {
    setState(prev => ({ ...prev, sort: { ...prev.sort, ...sort } }));
  }, []);

  const setActiveSmartList = useCallback((list: SmartListType) => {
    setState(prev => ({ ...prev, activeSmartList: list }));
  }, []);

  return (
    <TaskContext.Provider value={{ state, addTask, updateTask, deleteTask, setFilter, setSort, setActiveSmartList }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error("useTasks must be used within TaskProvider");
  return context;
};
