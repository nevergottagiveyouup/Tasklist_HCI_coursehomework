import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Task, TaskStatus, SubTask } from '../types';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { ICONS, THEME } from '../constants';
import { useTasks } from '../context/TaskContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface TaskItemProps {
  task: Task;
  highlighted?: boolean;
  onEdit?: () => void;
}

// 辅助函数：将日期和时间拆分开
const getDateParts = (dateStr: string | Date) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { date: '--月--日', time: '--:--' };

  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');

  return {
    date: `${m}月${d}日`,
    time: `${h}:${min}`
  };
};

export const TaskItem: React.FC<TaskItemProps> = ({ task, highlighted = false, onEdit }) => {
  const { updateTask, deleteTask } = useTasks();
  const { t } = useLanguage();
  const { styles: themeStyles } = useTheme();
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const [showAllSubTasks, setShowAllSubTasks] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const subTasks = task.subTasks || [];
  const completedCount = subTasks.filter(st => st.completed).length;
  const hasSubTasks = subTasks.length > 0;
  const allSubTasksDone = hasSubTasks && completedCount === subTasks.length;
  const noSubTasksDone = hasSubTasks && completedCount === 0;

  const recomputeParentStatus = (subTasks: SubTask[]) => {
    if (!subTasks.length) return TaskStatus.TODO;
    const allDone = subTasks.every(st => st.completed);
    if (allDone) return TaskStatus.COMPLETED;
    const someDone = subTasks.some(st => st.completed);
    return someDone ? TaskStatus.IN_PROGRESS : TaskStatus.TODO;
  };

  const toggleSubTask = useCallback((sub: SubTask) => {
    const updatedSubTasks = (task.subTasks || []).map(st => st.id === sub.id ? { ...st, completed: !st.completed } : st);
    const newStatus = recomputeParentStatus(updatedSubTasks);
    updateTask(task.id, { subTasks: updatedSubTasks, status: newStatus });
  }, [task.id, task.subTasks, updateTask]);

  const toggleStatus = () => {
    const nextStatus = isCompleted ? TaskStatus.TODO : TaskStatus.COMPLETED;
    updateTask(task.id, { status: nextStatus });
  };

  const completeAllSubTasks = () => {
    if (!hasSubTasks) return;
    const updatedSubTasks = subTasks.map(st => ({ ...st, completed: true }));
    updateTask(task.id, { status: TaskStatus.COMPLETED, subTasks: updatedSubTasks });
  };

  const cancelAllSubTasks = () => {
    if (!hasSubTasks) return;
    const updatedSubTasks = subTasks.map(st => ({ ...st, completed: false }));
    updateTask(task.id, { status: TaskStatus.TODO, subTasks: updatedSubTasks });
  };

  const timeInfo = useMemo(() => {
    const start = new Date(task.startDate);
    const end = new Date(task.dueDate);
    const totalDurationMs = Math.max(end.getTime() - start.getTime(), 0);
    const elapsedMs = now.getTime() - start.getTime();

    const isOverdue = now > end && task.status !== TaskStatus.COMPLETED;

    let progress = 0;
    if (isOverdue) {
      progress = 100;
    } else if (totalDurationMs > 0) {
      progress = (elapsedMs / totalDurationMs) * 100;
    }

    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    const isDueSoon = !isOverdue && (end.getTime() - now.getTime()) < 86400000 && task.status !== TaskStatus.COMPLETED;

    let colorClass = 'bg-indigo-500';
    let textClass = 'text-indigo-600';

    if (task.status === TaskStatus.COMPLETED) {
      colorClass = 'bg-emerald-500';
      textClass = 'text-emerald-600';
    } else if (isOverdue) {
      colorClass = 'bg-rose-500';
      textClass = 'text-rose-600';
    } else if (isDueSoon) {
      colorClass = 'bg-amber-400';
      textClass = 'text-amber-500';
    }

    const parts = getDateParts(now);

    return {
      progress: clampedProgress,
      isOverdue,
      colorClass,
      textClass,
      nowLabel: `${parts.time}`
    };
  }, [task.startDate, task.dueDate, task.status, now]);

  const startParts = getDateParts(task.startDate);
  const endParts = getDateParts(task.dueDate);

  return (
      <Card
          onClick={onEdit}
          className={`
        p-5 mb-3 group transition-all duration-200 
        hover:shadow-lg hover:-translate-y-0.5 border-l-4 
        ${isCompleted ? 'opacity-70 grayscale-[0.3]' : ''}
      `}
      >
        {/* ---------------- 顶部区域 ---------------- */}
        <div className="flex items-center gap-4 mb-3 pt-3">
          <div className="shrink-0 max-w-[20%] md:max-w-[160px]">
            <h3 className={`text-lg font-bold truncate ${isCompleted ? 'line-through opacity-60' : ''}`}>
              {task.title || '无标题'}
            </h3>
          </div>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className={`shrink-0 px-3 py-1 rounded-xl shadow-sm flex flex-col items-center justify-center min-w-[60px] ${themeStyles.surfaceSoft}`}>
              <span className={`text-[10px] font-bold leading-tight ${themeStyles.mutedText}`}>{startParts.date}</span>
              <span className="text-xs font-black tabular-nums leading-tight">{startParts.time}</span>
            </div>

            <div className="relative flex-1 h-2 rounded-full mx-1 bg-transparent">
              <div className={`absolute inset-0 rounded-full opacity-70 ${themeStyles.surfaceSoft}`} />
              <div
                  className={`absolute left-0 top-0 h-full rounded-full opacity-50 transition-all duration-500 ${timeInfo.colorClass}`}
                  style={{ width: `${task.status === TaskStatus.COMPLETED ? 100 : timeInfo.progress}%` }}
              />
              {!isCompleted && (
                  <div
                      className="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-500 flex flex-col items-center"
                      style={{ left: `${timeInfo.progress}%` }}
                  >
                    <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black shadow-md ${timeInfo.colorClass} text-white tracking-wide tabular-nums`}>
                        {timeInfo.nowLabel}
                      </div>
                      <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-transparent border-t-current absolute left-1/2 -translate-x-1/2 -bottom-[4px] ${timeInfo.textClass.replace('text-', 'text-')}`} style={{ color: 'inherit' }} />
                    </div>
                    <div className={`w-3.5 h-3.5 rotate-45 border-2 border-white shadow-sm box-content ${timeInfo.colorClass}`} />
                  </div>
              )}
            </div>

            <div className={`shrink-0 px-3 py-1 rounded-xl shadow-sm flex flex-col items-center justify-center min-w-[60px] transition-colors ${timeInfo.isOverdue ? 'bg-rose-50 border border-rose-200 text-rose-600' : themeStyles.surfaceSoft}`}>
              <span className={`text-[10px] font-bold leading-tight ${timeInfo.isOverdue ? 'text-rose-400' : themeStyles.mutedText}`}>{endParts.date}</span>
              <span className="text-xs font-black tabular-nums leading-tight">{endParts.time}</span>
            </div>
          </div>
        </div>

        {/* ---------------- 描述与操作栏 ---------------- */}
        <div className="pl-1">
          {/*
          修改重点在这里：
          1. whitespace-pre-wrap: 保留换行符和空格
          2. break-words: 单词太长时自动换行，防止撑破布局
          3. 移除了 line-clamp-2
        */}
          <div className={`text-sm mb-4 whitespace-pre-wrap break-words ${themeStyles.mutedText} ${isCompleted ? 'line-through opacity-60' : ''}`}>
            {task.description || <span className="opacity-70 italic text-xs">暂无描述...</span>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={task.status}>{t(`status.${task.status}`)}</Badge>
            <Badge variant={task.priority}>{t(`priority.${task.priority}`)}</Badge>

            {hasSubTasks && (
                 <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${themeStyles.surfaceSoft}`}>
                 {completedCount} / {subTasks.length}
               </span>
            )}

            <div className="ml-auto flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full transition-colors"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true); }}
                  icon={<ICONS.Trash />}
                />
                <div className={`w-px h-4 ${themeStyles.chromeBorder}`}></div>
              {hasSubTasks ? (
                  <>
                    <Button onClick={cancelAllSubTasks} variant="secondary" size="sm" className="px-3 py-1 h-8 text-xs font-bold" disabled={noSubTasksDone}>重置</Button>
                    <Button onClick={completeAllSubTasks} variant="primary" size="sm" className="px-3 py-1 h-8 text-xs font-bold" disabled={allSubTasksDone}>全完成</Button>
                  </>
              ) : (
                  <Button onClick={toggleStatus} variant={isCompleted ? 'secondary' : 'primary'} size="sm" className="px-4 py-1 h-8 text-xs font-bold">
                    {isCompleted ? '撤销' : '完成'}
                  </Button>
              )}
            </div>
          </div>

          {/* ---------------- 子任务区域 ---------------- */}
          {hasSubTasks && (
              <div className={`mt-4 pt-3`}>
                <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-bold text-indigo-500 mb-2 hover:text-indigo-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setShowAllSubTasks(v => !v); }}
                >
                  <span>{showAllSubTasks ? '收起子任务' : '查看子任务详情'}</span>
                  <span className={`transition-transform duration-200 ${showAllSubTasks ? 'rotate-180' : ''}`}><ICONS.ChevronDown size={12} /></span>
                </button>

                {showAllSubTasks && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      {subTasks.map(st => {
                        const stStart = getDateParts(st.startTime);
                        const stEnd = getDateParts(st.endTime);
                        return (
                            <div key={st.id} className={`rounded-lg p-2 flex items-center gap-3 transition-colors ${themeStyles.surfaceSoft}` } onClick={(e) => e.stopPropagation()}>
                              <input
                                  type="checkbox"
                                  checked={st.completed}
                                  onChange={() => toggleSubTask(st)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-bold truncate ${st.completed ? 'line-through opacity-60' : ''}`}>{st.title}</div>
                                <div className={`text-[10px] font-bold mt-0.5 ${themeStyles.mutedText}`}>
                                  {stStart.date} {stStart.time} - {stEnd.time}
                                </div>
                              </div>
                            </div>
                        );
                      })}
                    </div>
                )}
              </div>
          )}
        </div>

        <ConfirmDialog
            open={confirmDeleteOpen}
            message={`确定要删除任务「${task.title}」吗？此操作不可恢复。`}
            onCancel={() => setConfirmDeleteOpen(false)}
            onConfirm={() => {
              deleteTask(task.id);
              setConfirmDeleteOpen(false);
            }}
        />
      </Card>
  );
};