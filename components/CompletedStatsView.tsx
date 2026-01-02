import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { Card } from './Card';
import { ICONS } from '../constants';

const parseDateValue = (value: Task['startDate'] | Task['updatedAt']) => {
  const normalized = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  return normalized instanceof Date ? normalized : new Date(normalized || '');
};

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7; // Monday start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
};

const startOfMonth = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getCompletionDate = (task: Task) => {
  const source = task.updatedAt || task.dueDate || task.startDate;
  return parseDateValue(source as any);
};

interface CompletedStatsViewProps {
  tasks: Task[];
}

export const CompletedStatsView: React.FC<CompletedStatsViewProps> = ({ tasks }) => {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const completedTasks = useMemo(
    () => tasks.filter(t => t.status === TaskStatus.COMPLETED && !Number.isNaN(getCompletionDate(t).getTime())),
    [tasks]
  );

  const weekCount = useMemo(
    () => completedTasks.filter(t => getCompletionDate(t).getTime() >= weekStart.getTime()).length,
    [completedTasks, weekStart]
  );

  const monthCount = useMemo(
    () => completedTasks.filter(t => getCompletionDate(t).getTime() >= monthStart.getTime()).length,
    [completedTasks, monthStart]
  );

  const totalCount = completedTasks.length;

  const weeklyChart = useMemo(() => {
    const DAY = 86400000;
    const data: { label: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const start = new Date(weekStart.getTime() - i * 7 * DAY);
      const end = new Date(start.getTime() + 7 * DAY);
      const value = completedTasks.filter(t => {
        const doneAt = getCompletionDate(t).getTime();
        return doneAt >= start.getTime() && doneAt < end.getTime();
      }).length;
      const label = `${start.getMonth() + 1}/${String(start.getDate()).padStart(2, '0')}`;
      data.push({ label, value });
    }
    return data;
  }, [completedTasks, weekStart]);

  const maxValue = Math.max(1, ...weeklyChart.map(d => d.value));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">完成统计</h3>
          <p className="text-sm text-slate-500">查看已完成任务的趋势</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <ICONS.Check />
          <span>完成总览</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-2">本周完成</div>
          <div className="text-3xl font-black text-slate-800">{weekCount}</div>
          <div className="text-xs text-slate-400 mt-1">周一至今</div>
        </Card>
        <Card className="p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-2">本月完成</div>
          <div className="text-3xl font-black text-slate-800">{monthCount}</div>
          <div className="text-xs text-slate-400 mt-1">月初至今</div>
        </Card>
        <Card className="p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-2">总完成</div>
          <div className="text-3xl font-black text-slate-800">{totalCount}</div>
          <div className="text-xs text-slate-400 mt-1">所有历史已完成</div>
        </Card>
      </div>

      <Card className="p-6 bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-slate-800">最近 6 周完成趋势</div>
            <p className="text-xs text-slate-500">按完成时间（更新于标记完成时）</p>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-3 items-end h-[20rem]">
          {weeklyChart.map(item => {
            const heightPercent = Math.max(6, (item.value / maxValue) * 100);
            return (
              <div key={item.label} className="flex flex-col items-center gap-2 h-full">
                <div className="w-full h-full bg-indigo-100 rounded-lg overflow-hidden flex items-end">
                  <div className="w-full bg-indigo-500 rounded-lg" style={{ height: `${heightPercent}%`, opacity: 0.8 }} />
                </div>
                <div className="text-xs font-semibold text-slate-700">{item.value}</div>
                <div className="text-[10px] text-slate-400">{item.label}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
