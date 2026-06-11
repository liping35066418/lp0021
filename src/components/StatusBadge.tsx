import { cn } from '@/lib/utils';

export type UserStatus = 'active' | 'inactive' | 'archived';
export type HouseStatus = 'occupied' | 'vacant' | 'rented' | 'archived';
export type ParkingStatus = 'available' | 'occupied' | 'archived';
export type RepairStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'archived';
export type BillStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type WorkerStatus = 'available' | 'busy' | 'offline';

export type StatusType =
  | UserStatus
  | HouseStatus
  | ParkingStatus
  | RepairStatus
  | BillStatus
  | WorkerStatus;

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  active: { label: '正常', className: 'bg-green-100 text-green-700 border-green-200' },
  inactive: { label: '禁用', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  archived: { label: '已归档', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  occupied: { label: '已入住', className: 'bg-green-100 text-green-700 border-green-200' },
  vacant: { label: '空置', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  rented: { label: '已出租', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  available: { label: '空闲', className: 'bg-green-100 text-green-700 border-green-200' },
  pending: { label: '待处理', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  assigned: { label: '已派单', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_progress: { label: '处理中', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  completed: { label: '已完成', className: 'bg-green-100 text-green-700 border-green-200' },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  unpaid: { label: '未支付', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  paid: { label: '已支付', className: 'bg-green-100 text-green-700 border-green-200' },
  overdue: { label: '已逾期', className: 'bg-red-100 text-red-700 border-red-200' },
  refunded: { label: '已退款', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  busy: { label: '忙碌', className: 'bg-red-100 text-red-700 border-red-200' },
  offline: { label: '离线', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {config.label}
    </span>
  );
}
