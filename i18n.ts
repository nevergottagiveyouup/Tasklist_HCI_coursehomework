
export const translations = {
  en: {
    appName: "IntelliTask",
    allTasks: "All Tasks",
    today: "Today",
    upcoming: "Upcoming",
    hciTipTitle: "HCI Homework Tip",
    hciTipDesc: "Timeline grouping reduces cognitive load by organizing tasks by their natural temporal order.",
    projectOverview: "Project Overview",
    pendingTasks: "Welcome back! You have {count} tasks pending.",
    addNewTask: "Add New Task",
    searchPlaceholder: "Search tasks...",
    allStatus: "All Status",
    allPriority: "All Priority",
    noTasks: "No tasks found",
    noTasksDesc: "Try changing your search or filter settings.",
    cancel: "Cancel",
    saveTask: "Save Task",
    taskTitle: "Task Title",
    taskTitlePlaceholder: "What needs to be done?",
    taskDescPlaceholder: "Add some details (optional)...",
    taskDateLabel: "Due Date",
    taskPriorityLabel: "Priority",
    startDateLabel: "Start Date",
    duration: "{days} days",
    groups: {
      overdue: "Overdue",
      active: "Active Now",
      today: "Due Today",
      tomorrow: "Due Tomorrow",
      thisWeek: "Later This Week",
      future: "Future Plans",
      completed: "Completed Recently"
    },
    status: {
      TODO: "To Do",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      ARCHIVED: "Archived"
    },
    priority: {
      LOW: "Low",
      MEDIUM: "Medium",
      HIGH: "High",
      URGENT: "Urgent"
    }
  },
  zh: {
    appName: "智能清单",
    allTasks: "所有任务",
    today: "今天",
    upcoming: "即将到来",
    hciTipTitle: "HCI 作业提示",
    hciTipDesc: "通过时间轴分组进行‘认知外包’，用户无需计算日期即可感知任务节奏。",
    projectOverview: "项目概览",
    pendingTasks: "欢迎回来！您还有 {count} 项任务待办。",
    addNewTask: "添加新任务",
    searchPlaceholder: "搜索任务...",
    allStatus: "所有状态",
    allPriority: "所有优先级",
    noTasks: "未找到任务",
    noTasksDesc: "请尝试更改搜索或筛选条件。",
    cancel: "取消",
    saveTask: "保存任务",
    taskTitle: "任务标题",
    taskTitlePlaceholder: "准备做什么？",
    taskDescPlaceholder: "添加描述（可选）...",
    taskDateLabel: "截止日期",
    startDateLabel: "开始日期",
    duration: "跨度 {days} 天",
    groups: {
      overdue: "已逾期",
      active: "正在进行中",
      today: "今日截止",
      tomorrow: "明天截止",
      thisWeek: "本周晚些时候",
      future: "远期规划",
      completed: "最近已完成"
    },
    status: {
      TODO: "待办",
      IN_PROGRESS: "进行中",
      COMPLETED: "已完成",
      ARCHIVED: "已归档"
    },
    priority: {
      LOW: "低",
      MEDIUM: "中",
      HIGH: "高",
      URGENT: "紧急"
    }
  }
};

export type Language = 'en' | 'zh';
