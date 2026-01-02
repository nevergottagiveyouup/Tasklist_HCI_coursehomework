import React, { useMemo, useState } from 'react';
import { Task, TaskState, TaskStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './Button';
import { ICONS } from '../constants';
import { TaskItem } from './TaskItem';
import { useNavigate } from 'react-router-dom';

const parseDateValue = (value: Task['startDate']) => {
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  return normalized instanceof Date ? normalized : new Date(normalized);
};

const getWeekNumber = (date: Date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

const getBucketInfo = (date: Date, unit: 'month' | 'week' | 'day') => {
  if (Number.isNaN(date.getTime())) return null;
  const pad = (num: number) => String(num).padStart(2, '0');

  if (unit === 'month') {
    const label = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { key: `m-${label}`, label, start };
  }

  if (unit === 'week') {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = (day + 6) % 7; // Monday as start
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekNo = getWeekNumber(weekStart);
    const label = `${weekStart.getFullYear()}-W${pad(weekNo)}`;
    return { key: `w-${label}`, label, start: weekStart };
  }

  const label = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return { key: `d-${label}`, label, start };
};

interface StatsViewProps {
  tasks: Task[];
  filter: TaskState['filter'];
  highlightedTaskIds: string[];
  onEditTask: (task: Task) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ tasks, filter, highlightedTaskIds, onEditTask }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [statsUnit, setStatsUnit] = useState<'month' | 'week' | 'day'>('month');
  const [expandedBuckets, setExpandedBuckets] = useState<string[]>([]);

  const statsBuckets = useMemo(() => {
    const baseTasks = tasks.filter(task => {
      const dueDate = parseDateValue(task.dueDate);
      if (Number.isNaN(dueDate.getTime())) return false;
      if (task.status === TaskStatus.COMPLETED) return false; // 只看未完成

      const matchSearch = task.title.toLowerCase().includes(filter.search.toLowerCase());
      const matchPriority = filter.priority === 'ALL' || task.priority === filter.priority;
      const matchStatus = filter.status === 'ALL' ? task.status !== TaskStatus.COMPLETED : task.status === filter.status;
      return matchSearch && matchPriority && matchStatus;
    });

    const buckets = new Map<string, { key: string; label: string; start: Date; tasks: Task[] }>();

    baseTasks.forEach(task => {
      const dueDate = parseDateValue(task.dueDate);
      const info = getBucketInfo(dueDate, statsUnit);
      if (!info) return;
      if (!buckets.has(info.key)) {
        buckets.set(info.key, { ...info, tasks: [] });
      }
      buckets.get(info.key)!.tasks.push(task);
    });

    return Array.from(buckets.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks, filter, statsUnit]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">任务统计</h3>
          <p className="text-sm text-slate-500">按时间分布查看未完成任务</p>
        </div>
        <div className="flex gap-2">
          {([
            { key: 'month', label: '月' },
            { key: 'week', label: '周' },
            { key: 'day', label: '日' }
          ] as const).map(item => (
            <Button
              key={item.key}
              size="sm"
              variant={statsUnit === item.key ? 'primary' : 'secondary'}
              onClick={() => setStatsUnit(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {statsBuckets.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="text-slate-200 flex justify-center mb-4 scale-125"><ICONS.Search /></div>
          <p className="text-slate-500 font-medium">暂无未完成任务</p>
        </div>
      ) : (
        <div className="relative pl-5 pb-20">
          <div className="absolute left-1 top-1 bottom-0 w-px bg-slate-200" />
          {statsBuckets.map(bucket => {
            const expanded = expandedBuckets.includes(bucket.key);
            return (
              <div key={bucket.key} className="relative mb-5">
                <div className="absolute -left-[7px] top-2 w-3 h-3 rounded-full bg-indigo-500 shadow" />
                <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{bucket.label}</div>
                    <div className="text-xs text-slate-500">{bucket.tasks.length} 个未完成任务</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setExpandedBuckets(prev => prev.includes(bucket.key) ? prev.filter(k => k !== bucket.key) : [...prev, bucket.key])}
                  >
                    {expanded ? '收起' : '展开'}
                  </Button>
                </div>
                {expanded && (
                  <div className="mt-3 space-y-2 pl-2">
                    {bucket.tasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        highlighted={highlightedTaskIds.includes(task.id)}
                        onEdit={() => { onEditTask(task); navigate('/'); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
