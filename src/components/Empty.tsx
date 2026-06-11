import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface EmptyProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export default function Empty({
  icon,
  title = '暂无数据',
  description,
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || <Inbox className="w-8 h-8 text-gray-400" />}
      </div>
      <h3 className="text-base font-medium text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-xs">{description}</p>
      )}
    </div>
  );
}
