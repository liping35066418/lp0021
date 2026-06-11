import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

export default function Loading({ size = 'md', className, text, fullScreen }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size], className)} />
          {text && <p className="text-sm text-gray-500">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size], className)} />
      {text && <span className="text-sm text-gray-500">{text}</span>}
    </div>
  );
}

export function Spinner({ size = 'md', className }: Omit<LoadingProps, 'text' | 'fullScreen'>) {
  return <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size], className)} />;
}
