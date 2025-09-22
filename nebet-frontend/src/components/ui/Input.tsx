import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helper, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[#1E2E3F] font-body">
            {label}
          </label>
        )}
        <input
          type={type}
          className={clsx(
            'flex w-full rounded-lg border px-3 py-2 text-sm font-body transition-colors',
            'bg-white border-[#8F969C]/30 text-[#1E2E3F] placeholder:text-[#8F969C]',
            'focus:border-[#275365] focus:outline-none focus:ring-2 focus:ring-[#275365]/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            {
              'border-red-500 focus:border-red-500 focus:ring-red-500/20': error,
            },
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600 font-body">{error}</p>
        )}
        {helper && !error && (
          <p className="text-sm text-[#8F969C] font-body">{helper}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helper, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[#1E2E3F] font-body">
            {label}
          </label>
        )}
        <textarea
          className={clsx(
            'flex min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm font-body transition-colors',
            'bg-white border-[#8F969C]/30 text-[#1E2E3F] placeholder:text-[#8F969C]',
            'focus:border-[#275365] focus:outline-none focus:ring-2 focus:ring-[#275365]/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            {
              'border-red-500 focus:border-red-500 focus:ring-red-500/20': error,
            },
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600 font-body">{error}</p>
        )}
        {helper && !error && (
          <p className="text-sm text-[#8F969C] font-body">{helper}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';