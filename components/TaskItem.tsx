
import React, { useMemo, useState, useCallback } from 'react';
import { Task, TaskStatus, SubTask } from '../types';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { ICONS, THEME } from '../constants';
import { useTasks } from '../context/TaskContext';
import { useLanguage } from '../context/LanguageContext';

interface TaskItemProps {
  task: Task;
  highlighted?: boolean;
  onEdit?: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, highlighted = false, onEdit }) => {
  const { updateTask, deleteTask } = useTasks();
  const { t } = useLanguage();
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const [showAllSubTasks, setShowAllSubTasks] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
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
    const now = new Date();
    const start = new Date(task.startDate);
    const end = new Date(task.dueDate);
    const totalDurationMs = Math.max(end.getTime() - start.getTime(), 0);
    const totalDays = Math.max(Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24)), 1);
    const elapsedMs = now.getTime() - start.getTime();
    const progress = totalDurationMs > 0
      ? Math.min(Math.max((elapsedMs / totalDurationMs) * 100, 0), 100)
      : now > end ? 100 : 0;

    const isOverdue = now > end && task.status !== TaskStatus.COMPLETED;
    const isDueSoon = !isOverdue && (end.getTime() - now.getTime()) < 86400000 && task.status !== TaskStatus.COMPLETED;

    return { progress, isOverdue, isDueSoon, totalDays };
  }, [task.startDate, task.dueDate, task.status]);

  return (
    <Card
      onClick={onEdit}
      className={`p-4 mb-2 border-l-4 group transition-all hover:translate-x-1 hover:shadow-md border-l-${THEME.colors.primary} bg-white ${isCompleted ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={`font-semibold text-slate-800 truncate ${isCompleted ? 'line-through text-slate-400' : ''}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true); }} icon={<ICONS.Trash />} />
            </div>
          </div>
          
          <p className={`text-xs text-slate-500 line-clamp-1 mb-3 ${isCompleted ? 'line-through' : ''}`}>
            {task.description}
          </p>

          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span>{new Date(task.startDate).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
                <span className="bg-slate-100 px-1.5 rounded-md text-slate-500">
                  {t('duration', { days: timeInfo.totalDays })}
                </span>
              </div>
              {timeInfo.isOverdue ? (
                <span className="text-rose-500">{t('groups.overdue')}</span>
              ) : timeInfo.isDueSoon ? (
                <span className="text-amber-500">{t('groups.today')}</span>
              ) : (
                <span>{new Date(task.dueDate).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
              )}
            </div>
            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden ring-1 ring-slate-100">
              <div 
                className={`h-full transition-all duration-700 ease-out ${
                  task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' : 
                  timeInfo.isOverdue ? 'bg-rose-500' : 
                  timeInfo.isDueSoon ? 'bg-amber-400' : 'bg-indigo-500'
                }`}
                style={{ width: `${timeInfo.progress}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={task.status}>{t(`status.${task.status}`)}</Badge>
            <Badge variant={task.priority}>{t(`priority.${task.priority}`)}</Badge>
          </div>

          {hasSubTasks && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
                <span>子任务</span>
                {subTasks.length > 3 && (
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); setShowAllSubTasks(v => !v); }}
                  >
                    {showAllSubTasks ? '收起更多' : `展开剩余 ${subTasks.length - 3} 个`}
                    <span className={`transition-transform ${showAllSubTasks ? 'rotate-180' : ''}`}><ICONS.ChevronDown /></span>
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {(showAllSubTasks ? subTasks : subTasks.slice(0, 3)).map(st => (
                  <div key={st.id} className="bg-gray-50 border border-slate-100 rounded-lg p-2 pl-4 flex items-start gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>{new Date(st.startTime).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
                        <span className="text-slate-300">→</span>
                        <span>{new Date(st.endTime).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={st.completed ? 'secondary' : 'primary'}
                      onClick={(e) => { e.stopPropagation(); toggleSubTask(st); }}
                      className="whitespace-nowrap"
                    >
                      {st.completed ? '取消完成' : '完成'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4 gap-2" onClick={(e) => e.stopPropagation()}>
            {hasSubTasks ? (
              <>
                <Button
                  onClick={(e) => { e.stopPropagation(); cancelAllSubTasks(); }}
                  variant="secondary"
                  size="sm"
                  className="rounded-lg px-4 py-2"
                  disabled={noSubTasksDone}
                >
                  一键取消完成
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); completeAllSubTasks(); }}
                  variant="primary"
                  size="sm"
                  className="rounded-lg px-4 py-2"
                  disabled={allSubTasksDone}
                >
                  一键完成
                </Button>
              </>
            ) : (
              <Button
                onClick={(e) => { e.stopPropagation(); toggleStatus(); }}
                variant={isCompleted ? 'secondary' : 'primary'}
                size="sm"
                className="rounded-lg px-4 py-2"
              >
                {isCompleted ? '取消完成' : '完成'}
              </Button>
            )}
          </div>
        </div>
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
