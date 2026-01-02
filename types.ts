
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  startTime: string | Date;
  endTime: string | Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  // 支持日期字符串（YYYY-MM-DD HH:mm / datetime-local）或 Date 实例
  startDate: string | Date;
  dueDate: string | Date;
  durationType: 'short' | 'long';
  subTasks?: SubTask[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type SmartListType = 'ALL' | 'TODAY' | 'UPCOMING';

export interface TaskState {
  tasks: Task[];
  activeSmartList: SmartListType; // 新增：当前激活的智能清单
  filter: {
    status: TaskStatus | 'ALL';
    priority: TaskPriority | 'ALL';
    search: string;
  };
  sort: {
    by: 'dueDate' | 'priority' | 'createdAt';
    order: 'asc' | 'desc';
  };
}

export type ThemeColors = {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
};
