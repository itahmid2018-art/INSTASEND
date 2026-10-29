import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastNotification } from '../types.ts';

interface ToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const duration = toast.durationMs ?? 4500;
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const getTheme = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-white',
          border: 'border-[#ceead6]',
          icon: <CheckCircle2 className="w-5 h-5 text-[#34A853] shrink-0 mt-0.5" />,
          titleColor: 'text-[#137333]',
          accent: 'bg-[#34A853]'
        };
      case 'warning':
        return {
          bg: 'bg-white',
          border: 'border-amber-200',
          icon: <AlertTriangle className="w-5 h-5 text-[#f29900] shrink-0 mt-0.5" />,
          titleColor: 'text-[#b06000]',
          accent: 'bg-[#f29900]'
        };
      case 'error':
        return {
          bg: 'bg-white',
          border: 'border-red-200',
          icon: <AlertCircle className="w-5 h-5 text-[#d93025] shrink-0 mt-0.5" />,
          titleColor: 'text-[#d93025]',
          accent: 'bg-[#d93025]'
        };
      case 'info':
      default:
        return {
          bg: 'bg-white',
          border: 'border-blue-200',
          icon: <Info className="w-5 h-5 text-[#1a73e8] shrink-0 mt-0.5" />,
          titleColor: 'text-[#1a73e8]',
          accent: 'bg-[#1a73e8]'
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full p-3.5 rounded-2xl border ${theme.border} ${theme.bg} shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-3 relative overflow-hidden animate-in fade-in slide-in-from-top-2`}
    >
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${theme.accent}`} />
      
      {theme.icon}

      <div className="flex-1 min-w-0 pr-1">
        <h5 className={`text-xs font-bold leading-tight ${theme.titleColor}`}>
          {toast.title}
        </h5>
        <p className="text-[11px] text-[#5f6368] mt-0.5 leading-relaxed break-words">
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-[#70757a] hover:text-[#202124] p-1 rounded-full hover:bg-[#f1f3f4] transition-colors cursor-pointer shrink-0"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
