import React, { createContext, useContext, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

const ToastComponent: React.FC<{ toast: Toast }> = ({ toast }) => {
  const { removeToast } = useToast();

  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={clsx(
        'flex items-start p-4 rounded-lg shadow-lg border max-w-sm bg-white animate-in slide-in-from-right duration-300',
        {
          'border-green-200': toast.type === 'success',
          'border-red-200': toast.type === 'error',
          'border-yellow-200': toast.type === 'warning',
          'border-[#275365]/20': toast.type === 'info',
        }
      )}
    >
      <Icon
        className={clsx('h-5 w-5 mr-3 flex-shrink-0 mt-0.5', {
          'text-green-600': toast.type === 'success',
          'text-red-600': toast.type === 'error',
          'text-yellow-600': toast.type === 'warning',
          'text-[#275365]': toast.type === 'info',
        })}
      />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1E2E3F] font-body">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-1 text-sm text-[#8F969C] font-body">
            {toast.description}
          </p>
        )}
      </div>
      
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-3 text-[#8F969C] hover:text-[#1E2E3F] transition-colors"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
};