
import React from 'react';
import { THEME } from '../constants';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ children, className = '', onClick }, ref) => {
  const { styles } = useTheme();
  return (
    <div 
      ref={ref}
      className={`
        ${styles.surface}
        ${THEME.radius.lg} ${THEME.shadows.sm} 
        overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} 
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';
