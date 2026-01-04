import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';

const pad = (num: number) => String(num).padStart(2, '0');

const buildRingPositions = (count: number, radius: number) => {
  return Array.from({ length: count }).map((_, idx) => {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  });
};

type ClockTimePickerProps = {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  label?: string;
};

export const ClockTimePicker: React.FC<ClockTimePickerProps> = ({ hour, minute, onChange }) => {
  const { styles: themeStyles } = useTheme();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
   const [hourRange, setHourRange] = useState<'am' | 'pm'>(hour >= 12 ? 'pm' : 'am');
  const [tempHour, setTempHour] = useState(hour);
  const [tempMinute, setTempMinute] = useState(Math.round(minute / 5) * 5);

  useEffect(() => {
    if (open) {
      setTempHour(hour);
      setTempMinute(Math.round(minute / 5) * 5);
      setMode('hour');
      setHourRange(hour >= 12 ? 'pm' : 'am');
    }
  }, [open, hour, minute]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const hourPositions = useMemo(() => buildRingPositions(12, 110), []);
  const minutePositions = useMemo(() => buildRingPositions(12, 110), []);

  const renderHourButton = (display: number, actual: number, coords: { x: number; y: number }) => (
    <button
      key={actual}
      onClick={() => {
        setTempHour(actual);
        setMode('minute');
      }}
      className={`absolute w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all -translate-x-1/2 -translate-y-1/2 ${themeStyles.surfaceSoft} ${tempHour === actual ? themeStyles.pillActive : ''}`}
      style={{
        left: `calc(50% + ${coords.x}px)`,
        top: `calc(50% + ${coords.y}px)`
      }}
    >
      {pad(display)}
    </button>
  );

  const renderMinuteButton = (value: number, coords: { x: number; y: number }) => (
    <button
      key={value}
      onClick={() => {
        setTempMinute(value);
        onChange(tempHour, value);
        setOpen(false);
      }}
      className={`absolute w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all -translate-x-1/2 -translate-y-1/2 ${themeStyles.surfaceSoft} ${tempMinute === value ? themeStyles.pillActive : ''}`}
      style={{
        left: `calc(50% + ${coords.x}px)`,
        top: `calc(50% + ${coords.y}px)`
      }}
    >
      {pad(value)}
    </button>
  );

  const timeLabel = `${pad(hour)}:${pad(minute)}`;

  const picker = open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <div className={`relative w-full max-w-[420px] rounded-3xl p-6 shadow-2xl ${themeStyles.surface} ${themeStyles.chromeBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase">选择时间</div>
            <div className="text-lg font-black">{pad(tempHour)}:{pad(tempMinute)}</div>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            <button onClick={() => setMode('hour')} className={`px-3 py-1 rounded-full ${mode === 'hour' ? themeStyles.pillActive : themeStyles.pillInactive}`}>小时</button>
            <button onClick={() => setMode('minute')} className={`px-3 py-1 rounded-full ${mode === 'minute' ? themeStyles.pillActive : themeStyles.pillInactive}`}>分钟</button>
          </div>
        </div>
        {mode === 'hour' && (
          <div className="flex gap-2 mb-3 text-xs font-bold">
            <button onClick={() => setHourRange('am')} className={`px-3 py-1 rounded-full ${hourRange === 'am' ? themeStyles.pillActive : themeStyles.pillInactive}`}>00-11</button>
            <button onClick={() => setHourRange('pm')} className={`px-3 py-1 rounded-full ${hourRange === 'pm' ? themeStyles.pillActive : themeStyles.pillInactive}`}>12-23</button>
          </div>
        )}
        <div className="relative mx-auto" style={{ width: 280, height: 280 }}>
          <div className="absolute inset-0 rounded-full border border-dashed border-slate-200 opacity-60" />
          {mode === 'hour' && (
            <>
              {hourPositions.map((pos, idx) => {
                const actual = (hourRange === 'am' ? 0 : 12) + idx;
                const display = actual % 24;
                return renderHourButton(display, actual % 24, pos);
              })}
            </>
          )}
          {mode === 'minute' && (
            <>
              {minutePositions.map((pos, idx) => {
                const value = (idx * 5) % 60;
                return renderMinuteButton(value, pos);
              })}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full h-full min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${themeStyles.input}`}
      >
        <span className="font-mono text-base">{timeLabel}</span>
      </button>
      {open && createPortal(picker, document.body)}
    </>
  );
};
