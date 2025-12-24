
import React from 'react';
import { THEME } from '../constants';

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof THEME.colors.status | keyof typeof THEME.colors.priority;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'TODO', className = '' }) => {
  const styles = THEME.colors.status[variant as keyof typeof THEME.colors.status] || 
                 THEME.colors.priority[variant as keyof typeof THEME.colors.priority];
                 
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles} ${className}`}>
      {children}
    </span>
  );
};
