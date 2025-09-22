import React from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  pill?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, pill, disabled, children, ...props }, ref) => {
    return (
      <button
        className={clsx(
          // Base styles
          'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
          
          // Variant styles
          {
            // Primary (Ocean Teal)
            'bg-gradient-to-r from-[#275365] to-[#3B7F9F] text-white hover:from-[#223A4E] hover:to-[#275365] focus:ring-[#275365] shadow-md hover:shadow-lg': variant === 'primary',
            
            // Secondary (Slate Blue)
            'bg-[#223A4E] text-white hover:bg-[#1E2E3F] focus:ring-[#223A4E] shadow-md hover:shadow-lg': variant === 'secondary',
            
            // Outline
            'border-2 border-[#275365] text-[#275365] hover:bg-[#275365] hover:text-white focus:ring-[#275365]': variant === 'outline',
            
            // Ghost
            'text-[#275365] hover:bg-[#F2F5F7] focus:ring-[#275365]': variant === 'ghost',
            
            // Success
            'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-md hover:shadow-lg': variant === 'success',
            
            // Warning  
            'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-400 shadow-md hover:shadow-lg': variant === 'warning',
            
            // Error
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-md hover:shadow-lg': variant === 'error',
          },
          
          // Size styles
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          
          // Shape
          {
            'rounded-full': pill,
            'rounded-lg': !pill,
          },
          
          // Disabled state
          {
            'opacity-50 cursor-not-allowed': disabled || loading,
          },
          
          className
        )}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';