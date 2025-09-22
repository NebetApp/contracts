import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'inline-flex items-center rounded-full font-medium transition-colors font-body',
          
          // Variant styles
          {
            'bg-[#8F969C]/10 text-[#8F969C] border border-[#8F969C]/20': variant === 'default',
            'bg-green-100 text-green-800 border border-green-200': variant === 'success',
            'bg-yellow-100 text-yellow-800 border border-yellow-200': variant === 'warning',
            'bg-red-100 text-red-800 border border-red-200': variant === 'error',
            'bg-blue-100 text-[#275365] border border-[#275365]/20': variant === 'info',
          },
          
          // Size styles
          {
            'px-2 py-0.5 text-xs': size === 'sm',
            'px-3 py-1 text-sm': size === 'md',
          },
          
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';