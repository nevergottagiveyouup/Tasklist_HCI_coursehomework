
import React from 'react';
import { THEME } from '../constants';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      className={`
        bg-white border border-slate-200 
        ${THEME.radius.lg} ${THEME.shadows.sm} 
        overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} 
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
