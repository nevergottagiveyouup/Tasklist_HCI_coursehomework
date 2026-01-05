import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'eye';

type ThemeContextType = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  styles: {
    page: string;
    surface: string;
    input: string;
    chromeBg: string;
    chromeBorder: string;
    surfaceSoft: string;
    mutedText: string;
    pillActive: string;
    pillInactive: string;
    primaryShadow: string;
  };
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STYLES: Record<ThemeMode, ThemeContextType['styles']> = {
  light: {
    page: 'bg-slate-50 text-slate-900',
    surface: 'bg-white border border-slate-200 text-slate-900',
    input: 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400',
    chromeBg: 'bg-white text-slate-900',
    chromeBorder: 'border-slate-200',
    surfaceSoft: 'bg-slate-50 border border-slate-200 text-slate-800',
    mutedText: 'text-slate-500',
    pillActive: 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200',
    pillInactive: 'text-slate-500 hover:bg-slate-50',
    primaryShadow: 'shadow-lg shadow-indigo-200/60'
  },
  dark: {
    page: 'bg-gray-900 text-white',
    surface: 'bg-gray-800 border border-gray-700 text-white',
    input: 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-400',
    chromeBg: 'bg-gray-900 text-white',
    chromeBorder: 'border-gray-700',
    surfaceSoft: 'bg-gray-800 border border-gray-700 text-white',
    mutedText: 'text-gray-300',
    pillActive: 'text-indigo-100 bg-indigo-900/50 ring-1 ring-indigo-700 shadow-sm',
    pillInactive: 'text-gray-300 hover:bg-gray-800',
    primaryShadow: 'shadow-lg shadow-black/30'
  },
  eye: {
    page: 'bg-amber-50 text-slate-900',
    surface: 'bg-amber-50 border border-amber-200 text-slate-900',
    input: 'bg-amber-50 border-amber-300 text-slate-900 placeholder:text-amber-500/70',
    chromeBg: 'bg-amber-50 text-slate-900',
    chromeBorder: 'border-amber-200',
    surfaceSoft: 'bg-amber-100 border border-amber-200 text-slate-900',
    mutedText: 'text-amber-800/80',
    pillActive: 'text-amber-900 bg-amber-200 ring-1 ring-amber-300 shadow-sm',
    pillInactive: 'text-amber-900/80 hover:bg-amber-100',
    primaryShadow: 'shadow-lg shadow-amber-300/60'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app_theme');
    return saved === 'dark' || saved === 'eye' ? saved : 'light';
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('app_theme', mode);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('eye-theme', theme === 'eye');
  }, [theme]);

  const styles = useMemo(() => THEME_STYLES[theme], [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, styles }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
