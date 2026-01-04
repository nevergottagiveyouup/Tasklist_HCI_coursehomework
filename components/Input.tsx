
import React from 'react';
import { THEME } from '../constants';
import { useTheme } from '../context/ThemeContext';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  const { styles } = useTheme();
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          className={`
            block w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2 
            ${styles.input} ${error ? 'border-rose-500' : ''} 
            ${THEME.radius.md} text-sm 
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
            transition-all ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
};
