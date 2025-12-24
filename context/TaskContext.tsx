
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Task, TaskPriority, TaskStatus, TaskState, SmartListType } from '../types';

interface TaskContextType {
  state: TaskState;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
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
        setState(prev => ({ ...prev, tasks: JSON.parse(saved) }));
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    } else {
      const now = new Date();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
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
          startDate: formatDate(longTimeAgo),
          dueDate: formatDate(yesterday),
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
          startDate: formatDate(yesterday),
          dueDate: formatDate(nextWeek),
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
          startDate: formatDate(today),
          dueDate: formatDate(today),
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
          startDate: formatDate(nextWeek),
          dueDate: formatDate(new Date(nextWeek.getTime() + 3 * 86400000)),
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

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setState(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)
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
