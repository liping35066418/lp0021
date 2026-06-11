import { useState, useEffect } from 'react';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  UserCheck,
  Play,
  CheckSquare,
  ThumbsUp,
  XCircle,
  Bell,
  Star,
  Image,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type {
  RepairOrder,
  RepairOrderStatus,
  RepairOrderType,
  RepairPriority,
  Owner,
  RepairWorker,
} from '@/types';
import DataTable, { Column, Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import FormItem, { Input, TextArea, Select } from '@/components/FormItem';
import Loading, { Spinner } from '@/components/Loading';

const statusLabels: Record<RepairOrderStatus, string> = {
  pending: '待派单',
  assigned: '已派单',
  in_progress: '处理中',
  completed: '已完成',
  cancelled: '已取消',
  archived: '已归档',
};

const statusColors: Record<RepairOrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-orange-100 text-orange-700 border-orange-200',
};

const typeLabels: Record<RepairOrderType, string> = {
  electrical: '电路',
  plumbing: '水管',
  structure: '土建',
  appliance: '家电',
  other: '其他',
};

const priorityLabels: Record<RepairPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

const priorityColors: Record<RepairPriority, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

interface Statistics {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export default function Repair() {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [workers, setWorkers] = useState<RepairWorker[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [workerFilter, setWorkerFilter] = useState<string>('');

  const [detailModal, setDetailModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  const [acceptModal, setAcceptModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    type: 'warning' as 'danger' | 'warning' | 'info' | 'success',
    onConfirm: () => {},
  });

  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [workerRemark, setWorkerRemark] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [checkingOverdue, setCheckingOverdue] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes, ownersRes, workersRes] = await Promise.all([
        api.repair.statistics(),
        api.repair.list(),
        api.owners.list(),
        api.workers.list(),
      ]);

      if (statsRes.success && statsRes.data) {
        setStatistics(statsRes.data as Statistics);
      }
      if (ordersRes.success && ordersRes.data) {
        const ordersData = ordersRes.data as unknown as { data: RepairOrder[] } | RepairOrder[];
        setOrders(Array.isArray(ordersData) ? ordersData : ordersData.data);
      }
      if (ownersRes.success && ownersRes.data) {
        const ownersData = ownersRes.data as unknown as { data: Owner[] } | Owner[];
        setOwners(Array.isArray(ownersData) ? ownersData : ownersData.data);
      }
      if (workersRes.success && workersRes.data) {
        const workersData = workersRes.data as unknown as { data: RepairWorker[] } | RepairWorker[];
        setWorkers(Array.isArray(workersData) ? workersData : workersData.data);
      }
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const matchNo = order.orderNo.toLowerCase().includes(searchLower);
      const matchTitle = order.title.toLowerCase().includes(searchLower);
      if (!matchNo && !matchTitle) return false;
    }
    if (statusFilter && order.status !== statusFilter) return false;
    if (typeFilter && order.type !== typeFilter) return false;
    if (priorityFilter && order.priority !== priorityFilter) return false;
    if (ownerFilter && order.ownerId !== ownerFilter) return false;
    if (workerFilter && order.workerId !== workerFilter) return false;
    return true;
  });

  const handleCheckOverdue = async () => {
    setCheckingOverdue(true);
    try {
      const res = await api.repair.checkOverdue();
      if (res.success) {
        showToast('success', '超时检查完成');
        fetchData();
      } else {
        showToast('error', res.error || '检查超时失败');
      }
    } catch (error) {
      showToast('error', '检查超时失败');
    } finally {
      setCheckingOverdue(false);
    }
  };

  const handleDetail = (order: RepairOrder) => {
    setSelectedOrder(order);
    setDetailModal(true);
  };

  const handleAssign = (order: RepairOrder) => {
    setSelectedOrder(order);
    setSelectedWorker('');
    setAssignModal(true);
  };

  const handleStart = (order: RepairOrder) => {
    setConfirmDialog({
      open: true,
      title: '确认开始处理',
      description: `确定要开始处理工单 "${order.title}" 吗？`,
      type: 'info',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const res = await api.repair.start(order.id);
          if (res.success) {
            showToast('success', '已开始处理');
            fetchData();
          } else {
            showToast('error', res.error || '操作失败');
          }
        } catch (error) {
          showToast('error', '操作失败');
        } finally {
          setSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleComplete = (order: RepairOrder) => {
    setSelectedOrder(order);
    setWorkerRemark('');
    setCompleteModal(true);
  };

  const handleAccept = (order: RepairOrder) => {
    setSelectedOrder(order);
    setRating(5);
    setComment('');
    setAcceptModal(true);
  };

  const handleCancel = (order: RepairOrder) => {
    setSelectedOrder(order);
    setCancelReason('');
    setCancelModal(true);
  };

  const handleReminder = (order: RepairOrder) => {
    setConfirmDialog({
      open: true,
      title: '确认催单',
      description: `确定要对工单 "${order.title}" 发送催单提醒吗？`,
      type: 'warning',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const res = await api.repair.reminder(order.id);
          if (res.success) {
            showToast('success', '催单提醒已发送');
            fetchData();
          } else {
            showToast('error', res.error || '操作失败');
          }
        } catch (error) {
          showToast('error', '操作失败');
        } finally {
          setSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const submitAssign = async () => {
    if (!selectedOrder || !selectedWorker) return;
    setSubmitting(true);
    try {
      const res = await api.repair.assign(selectedOrder.id, selectedWorker);
      if (res.success) {
        showToast('success', '派单成功');
        setAssignModal(false);
        fetchData();
      } else {
        showToast('error', res.error || '派单失败');
      }
    } catch (error) {
      showToast('error', '派单失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitComplete = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await api.repair.complete(selectedOrder.id, workerRemark);
      if (res.success) {
        showToast('success', '工单已完成');
        setCompleteModal(false);
        fetchData();
      } else {
        showToast('error', res.error || '操作失败');
      }
    } catch (error) {
      showToast('error', '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAccept = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await api.repair.accept(selectedOrder.id, rating, comment);
      if (res.success) {
        showToast('success', '验收完成');
        setAcceptModal(false);
        fetchData();
      } else {
        showToast('error', res.error || '操作失败');
      }
    } catch (error) {
      showToast('error', '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await api.repair.cancel(selectedOrder.id, cancelReason);
      if (res.success) {
        showToast('success', '工单已取消');
        setCancelModal(false);
        fetchData();
      } else {
        showToast('error', res.error || '操作失败');
      }
    } catch (error) {
      showToast('error', '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<RepairOrder>[] = [
    {
      key: 'orderNo',
      title: '工单号',
      dataIndex: 'orderNo',
      width: '120px',
    },
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: '80px',
      render: (value) => (
        <span className="text-sm text-gray-700">{typeLabels[value as RepairOrderType]}</span>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: '80px',
      render: (value) => {
        const p = value as RepairPriority;
        return (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
              priorityColors[p]
            )}
          >
            {priorityLabels[p]}
          </span>
        );
      },
    },
    {
      key: 'owner',
      title: '业主',
      dataIndex: 'owner',
      width: '100px',
      render: (_, record) => record.owner?.name || '-',
    },
    {
      key: 'house',
      title: '房屋',
      dataIndex: 'house',
      width: '120px',
      render: (_, record) =>
        record.house
          ? `${record.house.building}-${record.house.unit}-${record.house.roomNumber}`
          : '-',
    },
    {
      key: 'worker',
      title: '维修工',
      dataIndex: 'worker',
      width: '100px',
      render: (_, record) => record.worker?.name || '-',
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      render: (value) => {
        const s = value as RepairOrderStatus;
        return (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
              statusColors[s]
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
            {statusLabels[s]}
          </span>
        );
      },
    },
    {
      key: 'isOverdue',
      title: '是否超时',
      dataIndex: 'isOverdue',
      width: '80px',
      align: 'center',
      render: (value) =>
        value ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
            已超时
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            正常
          </span>
        ),
    },
    {
      key: 'submitTime',
      title: '提交时间',
      dataIndex: 'submitTime',
      width: '160px',
      render: (value) => new Date(value as string).toLocaleString('zh-CN'),
    },
  ];

  const actions: Action<RepairOrder>[] = [
    { key: 'detail', label: '详情', icon: <Eye className="w-3 h-3" />, onClick: handleDetail },
    {
      key: 'assign',
      label: '派单',
      icon: <UserCheck className="w-3 h-3" />,
      onClick: handleAssign,
      hidden: (record) => record.status !== 'pending',
    },
    {
      key: 'start',
      label: '开始处理',
      icon: <Play className="w-3 h-3" />,
      onClick: handleStart,
      hidden: (record) => record.status !== 'assigned',
    },
    {
      key: 'complete',
      label: '完成',
      icon: <CheckSquare className="w-3 h-3" />,
      onClick: handleComplete,
      hidden: (record) => record.status !== 'in_progress',
    },
    {
      key: 'accept',
      label: '验收',
      icon: <ThumbsUp className="w-3 h-3" />,
      onClick: handleAccept,
      hidden: (record) => record.status !== 'completed',
    },
    {
      key: 'cancel',
      label: '取消',
      icon: <XCircle className="w-3 h-3" />,
      onClick: handleCancel,
      danger: true,
      hidden: (record) => !['pending', 'assigned', 'in_progress'].includes(record.status),
    },
    {
      key: 'reminder',
      label: '催单',
      icon: <Bell className="w-3 h-3" />,
      onClick: handleReminder,
      hidden: (record) => !['assigned', 'in_progress'].includes(record.status),
    },
  ];

  const renderTimeline = () => {
    if (!selectedOrder) return null;
    const events = [
      { time: selectedOrder.submitTime, label: '提交', status: true },
      { time: selectedOrder.assignTime, label: '派单', status: !!selectedOrder.assignTime },
      {
        time: selectedOrder.startWorkTime,
        label: '开始处理',
        status: !!selectedOrder.startWorkTime,
      },
      {
        time: selectedOrder.completeTime,
        label: '完成',
        status: !!selectedOrder.completeTime,
      },
      {
        time: selectedOrder.acceptTime,
        label: '验收',
        status: !!selectedOrder.acceptTime,
      },
    ];

    return (
      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-3 h-3 rounded-full border-2',
                  event.status
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-gray-200 border-gray-300'
                )}
              />
              {index < events.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 h-8 mt-1',
                    event.status ? 'bg-blue-200' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    event.status ? 'text-gray-900' : 'text-gray-400'
                  )}
                >
                  {event.label}
                </span>
                {event.time && (
                  <span className="text-xs text-gray-500">
                    {new Date(event.time).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
              {index === 1 && selectedOrder.worker && (
                <p className="text-xs text-gray-500 mt-1">
                  维修工：{selectedOrder.worker.name}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right',
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">报修管理</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待派单</p>
              <p className="text-2xl font-bold text-gray-900">{statistics?.pending || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <Wrench className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">处理中</p>
              <p className="text-2xl font-bold text-gray-900">{statistics?.inProgress || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已完成</p>
              <p className="text-2xl font-bold text-gray-900">{statistics?.completed || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已逾期</p>
              <p className="text-2xl font-bold text-gray-900">{statistics?.overdue || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <FormItem label="搜索">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="工单号/标题"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-9"
                />
              </div>
            </FormItem>
          </div>
          <FormItem label="状态">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: '全部' },
                { value: 'pending', label: '待派单' },
                { value: 'assigned', label: '已派单' },
                { value: 'in_progress', label: '处理中' },
                { value: 'completed', label: '已完成' },
                { value: 'cancelled', label: '已取消' },
                { value: 'archived', label: '已归档' },
              ]}
              className="w-32"
            />
          </FormItem>
          <FormItem label="类型">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: '', label: '全部' },
                { value: 'electrical', label: '电路' },
                { value: 'plumbing', label: '水管' },
                { value: 'structure', label: '土建' },
                { value: 'appliance', label: '家电' },
                { value: 'other', label: '其他' },
              ]}
              className="w-28"
            />
          </FormItem>
          <FormItem label="优先级">
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: '', label: '全部' },
                { value: 'low', label: '低' },
                { value: 'medium', label: '中' },
                { value: 'high', label: '高' },
                { value: 'urgent', label: '紧急' },
              ]}
              className="w-24"
            />
          </FormItem>
          <FormItem label="业主">
            <Select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              options={[
                { value: '', label: '全部' },
                ...owners.map((o) => ({ value: o.id, label: o.name })),
              ]}
              className="w-28"
            />
          </FormItem>
          <FormItem label="维修工">
            <Select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              options={[
                { value: '', label: '全部' },
                ...workers.map((w) => ({ value: w.id, label: w.name })),
              ]}
              className="w-28"
            />
          </FormItem>
          <button
            type="button"
            onClick={handleCheckOverdue}
            disabled={checkingOverdue}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
          >
            {checkingOverdue ? (
              <Spinner size="sm" className="text-orange-600" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            检查超时
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <Loading text="加载中..." />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredOrders}
          rowKey="id"
          showSearch={false}
          actions={actions}
        />
      )}

      <Modal
        open={detailModal}
        title="工单详情"
        size="lg"
        onClose={() => setDetailModal(false)}
        footer={
          selectedOrder && (
            <div className="flex justify-end gap-2">
              {selectedOrder.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal(false);
                    handleAssign(selectedOrder);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  派单
                </button>
              )}
              {selectedOrder.status === 'assigned' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal(false);
                    handleStart(selectedOrder);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                >
                  开始处理
                </button>
              )}
              {selectedOrder.status === 'in_progress' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal(false);
                    handleComplete(selectedOrder);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  完成
                </button>
              )}
              {selectedOrder.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal(false);
                    handleAccept(selectedOrder);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  验收
                </button>
              )}
              {['pending', 'assigned', 'in_progress'].includes(selectedOrder.status) && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal(false);
                    handleCancel(selectedOrder);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  取消
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">工单号</p>
                <p className="text-base font-medium text-gray-900">{selectedOrder.orderNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">标题</p>
                <p className="text-base font-medium text-gray-900">{selectedOrder.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">类型</p>
                <p className="text-base font-medium text-gray-900">
                  {typeLabels[selectedOrder.type]}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">优先级</p>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    priorityColors[selectedOrder.priority]
                  )}
                >
                  {priorityLabels[selectedOrder.priority]}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">状态</p>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    statusColors[selectedOrder.status]
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
                  {statusLabels[selectedOrder.status]}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">是否超时</p>
                {selectedOrder.isOverdue ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                    已超时
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    正常
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">报修内容</h3>
              <p className="text-sm text-gray-700 mb-3">{selectedOrder.description}</p>
              {selectedOrder.images && selectedOrder.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden"
                    >
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">业主信息</h3>
                <p className="text-sm text-gray-700">
                  姓名：{selectedOrder.owner?.name || '-'}
                </p>
                <p className="text-sm text-gray-700">
                  电话：{selectedOrder.owner?.phone || '-'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">房屋信息</h3>
                <p className="text-sm text-gray-700">
                  {selectedOrder.house
                    ? `${selectedOrder.house.building}栋${selectedOrder.house.unit}单元${selectedOrder.house.roomNumber}室`
                    : '-'}
                </p>
                <p className="text-sm text-gray-700">
                  面积：{selectedOrder.house?.area || '-'} ㎡
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">处理流程</h3>
              {renderTimeline()}
            </div>

            {selectedOrder.workerRemark && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">维修工备注</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedOrder.workerRemark}
                </p>
              </div>
            )}

            {selectedOrder.rating && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">业主评价</h3>
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-4 h-4',
                        i < (selectedOrder.rating || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      )}
                    />
                  ))}
                </div>
                {selectedOrder.comment && (
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {selectedOrder.comment}
                  </p>
                )}
              </div>
            )}

            {selectedOrder.cancelReason && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">取消原因</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedOrder.cancelReason}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={assignModal}
        title="派单"
        size="sm"
        onClose={() => setAssignModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAssignModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitAssign}
              disabled={!selectedWorker || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认派单
            </button>
          </div>
        }
      >
        <FormItem label="选择维修工" required>
          <Select
            value={selectedWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            options={[
              { value: '', label: '请选择维修工（按在手单少、评分高优先）' },
              ...workers
                .filter((w) => w.status !== 'offline')
                .sort((a, b) => {
                  if (a.currentOrderCount !== b.currentOrderCount) {
                    return a.currentOrderCount - b.currentOrderCount;
                  }
                  const ar = a.averageRating ?? -1;
                  const br = b.averageRating ?? -1;
                  return br - ar;
                })
                .map((w) => {
                  const ratingText = w.averageRating !== undefined && w.averageRating !== null
                    ? `⭐${w.averageRating.toFixed(1)}分`
                    : '暂无评分';
                  const statusText = w.currentOrderCount === 0 ? '空闲' : '忙碌';
                  return {
                    value: w.id,
                    label: `${w.name} | ${statusText} | 在手${w.currentOrderCount}单 | ${ratingText}`,
                  };
                }),
            ]}
          />
        </FormItem>
      </Modal>

      <Modal
        open={completeModal}
        title="完成工单"
        size="sm"
        onClose={() => setCompleteModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCompleteModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitComplete}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认完成
            </button>
          </div>
        }
      >
        <FormItem label="维修工备注">
          <TextArea
            value={workerRemark}
            onChange={(e) => setWorkerRemark(e.target.value)}
            placeholder="请输入维修完成情况说明"
            rows={4}
          />
        </FormItem>
      </Modal>

      <Modal
        open={acceptModal}
        title="工单验收"
        size="sm"
        onClose={() => setAcceptModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAcceptModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitAccept}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认验收
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormItem label="评分" required>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i + 1)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={cn(
                      'w-8 h-8',
                      i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>
          </FormItem>
          <FormItem label="评价内容">
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入您的评价"
              rows={4}
            />
          </FormItem>
        </div>
      </Modal>

      <Modal
        open={cancelModal}
        title="取消工单"
        size="sm"
        onClose={() => setCancelModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCancelModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitCancel}
              disabled={!cancelReason.trim() || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认取消
            </button>
          </div>
        }
      >
        <FormItem label="取消原因" required>
          <TextArea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="请输入取消原因"
            rows={4}
          />
        </FormItem>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        loading={submitting}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
