import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Loading';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const iconMap = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const colorMap = {
  danger: 'bg-red-100 text-red-600',
  warning: 'bg-yellow-100 text-yellow-600',
  info: 'bg-blue-100 text-blue-600',
  success: 'bg-green-100 text-green-600',
};

const buttonColorMap = {
  danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
  info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
};

export default function ConfirmDialog({
  open,
  title,
  description,
  type = 'warning',
  confirmText = '确认',
  cancelText = '取消',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const Icon = iconMap[type];

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('flex-shrink-0 p-3 rounded-full', colorMap[type])}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 pt-0.5">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {description && (
                <p className="mt-2 text-sm text-gray-500">{description}</p>
              )}
            </div>
            <button
              type="button"
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onCancel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
              buttonColorMap[type]
            )}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner size="sm" className="text-white" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
