
import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { ICONS, THEME } from '../constants';
import { useTasks } from '../context/TaskContext';
import { useLanguage } from '../context/LanguageContext';

interface TaskItemProps {
  task: Task;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { updateTask, deleteTask } = useTasks();
  const { t } = useLanguage();

  const toggleStatus = () => {
    const nextStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;
    updateTask(task.id, { status: nextStatus });
  };

  const timeInfo = useMemo(() => {
    const now = new Date();
    const start = new Date(task.startDate);
    const end = new Date(task.dueDate);
    
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    
    const totalDurationMs = end.getTime() - start.getTime();
    const totalDays = Math.max(Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24)), 1);
    
    const elapsedMs = now.getTime() - start.getTime();
    const progress = totalDurationMs > 0 
      ? Math.min(Math.max((elapsedMs / totalDurationMs) * 100, 0), 100) 
      : (now > end ? 100 : 0);

    const isOverdue = now > end && task.status !== TaskStatus.COMPLETED;
    const isDueSoon = !isOverdue && (end.getTime() - now.getTime()) < 86400000 && task.status !== TaskStatus.COMPLETED;

    return { progress, isOverdue, isDueSoon, totalDays };
  }, [task.startDate, task.dueDate, task.status]);

  return (
    <Card className={`p-4 mb-2 border-l-4 group transition-all hover:translate-x-1 hover:shadow-md border-l-${THEME.colors.primary} bg-white`}>
      <div className="flex items-start gap-4">
        <button 
          onClick={toggleStatus}
          className={`
            mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0
            ${task.status === TaskStatus.COMPLETED ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}
          `}
        >
          {task.status === TaskStatus.COMPLETED && <span className="text-white scale-[0.6]"><ICONS.Check /></span>}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={`font-semibold text-slate-800 truncate ${task.status === TaskStatus.COMPLETED ? 'line-through text-slate-400' : ''}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteTask(task.id)} icon={<ICONS.Trash />} />
            </div>
          </div>
          
          <p className="text-xs text-slate-500 line-clamp-1 mb-3">
            {task.description}
          </p>

          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span>{new Date(task.startDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                <span className="bg-slate-100 px-1.5 rounded-md text-slate-500">
                  {t('duration', { days: timeInfo.totalDays })}
                </span>
              </div>
              {timeInfo.isOverdue ? (
                <span className="text-rose-500">{t('groups.overdue')}</span>
              ) : timeInfo.isDueSoon ? (
                <span className="text-amber-500">{t('groups.today')}</span>
              ) : (
                <span>{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
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
        </div>
      </div>
    </Card>
  );
};
