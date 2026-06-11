import { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Eye,
  Bell,
  XCircle,
  Star,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  UserCheck,
  Play,
  RefreshCw,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import DataTable, { Column, Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import FormItem, { Input, TextArea, Select } from '@/components/FormItem';
import Loading, { Spinner } from '@/components/Loading';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import type { RepairOrder, RepairOrderType, RepairPriority, House, RepairOrderStatus } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface FormErrors {
  houseId?: string;
  type?: string;
  priority?: string;
  title?: string;
  description?: string;
  cancelReason?: string;
  rating?: string;
  comment?: string;
}

const typeOptions = [
  { value: 'electrical', label: '电路' },
  { value: 'plumbing', label: '水管' },
  { value: 'structure', label: '土建' },
  { value: 'appliance', label: '家电' },
  { value: 'other', label: '其他' },
];

const priorityOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
];

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
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

const tabs = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'in_progress', label: '处理中' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

export default function OwnerRepair() {
  const { user } = useAuthStore();
  const ownerId = user?.ownerId;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [activeTab, setActiveTab] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [acceptModal, setAcceptModal] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    type: 'warning' as 'danger' | 'warning' | 'info' | 'success',
    onConfirm: () => {},
    loading: false,
  });

  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);

  const [formData, setFormData] = useState({
    houseId: '',
    type: '' as RepairOrderType | '',
    priority: '' as RepairPriority | '',
    title: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const loadData = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [ordersRes, housesRes] = await Promise.all([
        api.repair.list({ ownerId, status: activeTab || undefined, pageSize: 100 }),
        api.houses.list({ ownerId, pageSize: 100 }),
      ]);

      setOrders((ordersRes.data?.data as RepairOrder[]) || []);
      setHouses((housesRes.data?.data as House[]) || []);
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerId, activeTab]);

  const validateCreateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.houseId) {
      errors.houseId = '请选择房屋';
    }
    if (!formData.type) {
      errors.type = '请选择报修类型';
    }
    if (!formData.priority) {
      errors.priority = '请选择优先级';
    }
    if (!formData.title.trim()) {
      errors.title = '请输入标题';
    } else if (formData.title.length < 5) {
      errors.title = '标题至少5个字符';
    }
    if (!formData.description.trim()) {
      errors.description = '请输入问题描述';
    } else if (formData.description.length < 10) {
      errors.description = '描述至少10个字符';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreateForm() || !ownerId) return;

    setSubmitting(true);
    try {
      const res = await api.repair.create({
        ...formData,
        ownerId,
        submitTime: new Date().toISOString(),
      });

      if (res.success) {
        showToast('success', '报修提交成功');
        setCreateModal(false);
        resetForm();
        loadData();
      } else {
        showToast('error', res.error || '提交失败');
      }
    } catch (error) {
      showToast('error', '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      houseId: '',
      type: '',
      priority: '',
      title: '',
      description: '',
    });
    setFormErrors({});
  };

  const handleViewDetail = (order: RepairOrder) => {
    setSelectedOrder(order);
    setDetailModal(true);
  };

  const handleReminder = (order: RepairOrder) => {
    setConfirmDialog({
      open: true,
      title: '确认催单',
      description: `确定要对工单「${order.title}」进行催单吗？催单后工作人员会优先处理。`,
      type: 'warning',
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          const res = await api.repair.reminder(order.id);
          if (res.success) {
            showToast('success', '催单成功');
            loadData();
          } else {
            showToast('error', res.error || '催单失败');
          }
        } catch (error) {
          showToast('error', '催单失败');
        } finally {
          setConfirmDialog((prev) => ({ ...prev, open: false, loading: false }));
        }
      },
    });
  };

  const handleCancel = (order: RepairOrder) => {
    setSelectedOrder(order);
    setCancelReason('');
    setCancelReasonError('');
    setCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelReasonError('请填写取消原因');
      return;
    }
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const res = await api.repair.cancel(selectedOrder.id, cancelReason);
      if (res.success) {
        showToast('success', '工单已取消');
        setCancelModal(false);
        loadData();
      } else {
        showToast('error', res.error || '取消失败');
      }
    } catch (error) {
      showToast('error', '取消失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = (order: RepairOrder) => {
    setSelectedOrder(order);
    setRating(5);
    setComment('');
    setCommentError('');
    setAcceptModal(true);
  };

  const confirmAccept = async () => {
    if (rating < 1 || rating > 5) {
      setCommentError('请选择评分');
      return;
    }
    if (!comment.trim()) {
      setCommentError('请填写评价内容');
      return;
    }
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const res = await api.repair.accept(selectedOrder.id, rating, comment);
      if (res.success) {
        showToast('success', '评价提交成功');
        setAcceptModal(false);
        loadData();
      } else {
        showToast('error', res.error || '提交失败');
      }
    } catch (error) {
      showToast('error', '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getProcessSteps = (order: RepairOrder) => {
    const steps = [
      { key: 'submit', label: '提交报修', time: order.submitTime, icon: FileText, completed: true },
      { key: 'assign', label: '工作人员接单', time: order.assignTime, icon: UserCheck, completed: !!order.assignTime },
      { key: 'start', label: '开始处理', time: order.startWorkTime, icon: Play, completed: !!order.startWorkTime },
      { key: 'complete', label: '处理完成', time: order.completeTime, icon: CheckCircle, completed: !!order.completeTime },
      { key: 'accept', label: '业主验收', time: order.acceptTime, icon: Star, completed: !!order.acceptTime },
    ];
    return steps;
  };

  const columns: Column<RepairOrder>[] = [
    {
      key: 'orderNo',
      title: '工单号',
      dataIndex: 'orderNo',
      width: '140px',
      render: (value) => (
        <span className="font-mono text-sm text-gray-600">{value as string}</span>
      ),
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
      render: (value) => String(typeLabels[value as RepairOrderType] || String(value)),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: '80px',
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[value as RepairPriority]}`}>
          {String(priorityLabels[value as RepairPriority] || String(value))}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      render: (value) => <StatusBadge status={value as RepairOrderStatus} />,
    },
    {
      key: 'submitTime',
      title: '提交时间',
      dataIndex: 'submitTime',
      width: '160px',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const actions: Action<RepairOrder>[] = [
    {
      key: 'detail',
      label: '详情',
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: handleViewDetail,
    },
    {
      key: 'reminder',
      label: '催单',
      icon: <Bell className="w-3.5 h-3.5" />,
      onClick: handleReminder,
      hidden: (record) => !['pending', 'assigned'].includes(record.status),
    },
    {
      key: 'cancel',
      label: '取消',
      icon: <XCircle className="w-3.5 h-3.5" />,
      onClick: handleCancel,
      danger: true,
      hidden: (record) => !['pending', 'assigned'].includes(record.status),
    },
    {
      key: 'accept',
      label: '评价',
      icon: <Star className="w-3.5 h-3.5" />,
      onClick: handleAccept,
      hidden: (record) => record.status !== 'completed' || !!record.acceptTime,
    },
  ];

  const houseOptions = houses.map((house) => ({
    value: house.id,
    label: `${house.building}栋${house.unit}单元${house.roomNumber}室`,
  }));

  return (
    <Layout>
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right duration-300 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">我的报修</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {orders.length} 条报修记录
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <button
              onClick={() => {
                resetForm();
                setCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              提交报修
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex border-b border-gray-200 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            <DataTable
              columns={columns}
              data={orders}
              loading={loading}
              rowKey="id"
              pagination={false}
              showSearch={false}
              actions={actions}
              emptyText="暂无报修记录"
            />
          </div>
        </div>
      </div>

      <Modal
        open={createModal}
        title="提交报修"
        size="lg"
        onClose={() => setCreateModal(false)}
        footer={
          <>
            <button
              onClick={() => setCreateModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              提交
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormItem
            label="选择房屋"
            required
            error={formErrors.houseId}
          >
            <Select
              value={formData.houseId}
              onChange={(e) => setFormData({ ...formData, houseId: e.target.value })}
              error={!!formErrors.houseId}
              options={[{ value: '', label: '请选择房屋' }, ...houseOptions]}
            />
          </FormItem>

          <div className="grid grid-cols-2 gap-4">
            <FormItem
              label="报修类型"
              required
              error={formErrors.type}
            >
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as RepairOrderType })}
                error={!!formErrors.type}
                options={[{ value: '', label: '请选择类型' }, ...typeOptions]}
              />
            </FormItem>

            <FormItem
              label="优先级"
              required
              error={formErrors.priority}
            >
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as RepairPriority })}
                error={!!formErrors.priority}
                options={[{ value: '', label: '请选择优先级' }, ...priorityOptions]}
              />
            </FormItem>
          </div>

          <FormItem
            label="标题"
            required
            error={formErrors.title}
            hint="简要描述报修问题"
          >
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="请输入报修标题"
              error={!!formErrors.title}
            />
          </FormItem>

          <FormItem
            label="问题描述"
            required
            error={formErrors.description}
            hint="详细描述问题情况，以便工作人员更好地处理"
          >
            <TextArea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="请详细描述问题情况"
              rows={5}
              error={!!formErrors.description}
            />
          </FormItem>
        </div>
      </Modal>

      <Modal
        open={detailModal}
        title="工单详情"
        size="lg"
        onClose={() => setDetailModal(false)}
      >
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">工单号</p>
                <p className="text-sm font-semibold text-gray-900 mt-1 font-mono">
                  {selectedOrder.orderNo}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">状态</p>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">类型</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {typeLabels[selectedOrder.type] || selectedOrder.type}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">优先级</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${priorityColors[selectedOrder.priority]}`}>
                  {priorityLabels[selectedOrder.priority] || selectedOrder.priority}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">标题</p>
              <p className="text-base font-semibold text-gray-900 mt-1">
                {selectedOrder.title}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">问题描述</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                {selectedOrder.description}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">处理流程</p>
              <div className="mt-4 relative">
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {getProcessSteps(selectedOrder).map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="relative flex items-start gap-4 pl-10">
                        <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          step.completed
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${
                              step.completed ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {step.label}
                            </p>
                            {step.time && (
                              <p className="text-xs text-gray-500">
                                {dayjs(step.time).format('YYYY-MM-DD HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedOrder.workerRemark && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">工作人员备注</p>
                <p className="text-sm text-blue-900 mt-1">
                  {selectedOrder.workerRemark}
                </p>
              </div>
            )}

            {selectedOrder.rating && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-yellow-700 font-medium">您的评价</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < (selectedOrder.rating || 0)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {selectedOrder.comment && (
                  <p className="text-sm text-yellow-900">{selectedOrder.comment}</p>
                )}
              </div>
            )}

            {selectedOrder.cancelReason && (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">取消原因</p>
                <p className="text-sm text-red-900 mt-1">
                  {selectedOrder.cancelReason}
                </p>
              </div>
            )}

            {selectedOrder.status === 'completed' && !selectedOrder.acceptTime && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleAccept(selectedOrder)}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  确认验收并评价
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={cancelModal}
        title="取消工单"
        size="md"
        onClose={() => setCancelModal(false)}
        footer={
          <>
            <button
              onClick={() => setCancelModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              返回
            </button>
            <button
              onClick={confirmCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认取消
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">确认取消此工单？</p>
              <p className="text-sm text-red-600 mt-1">
                工单取消后将无法恢复，请谨慎操作。
              </p>
            </div>
          </div>

          <FormItem
            label="取消原因"
            required
            error={cancelReasonError}
          >
            <TextArea
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelReasonError('');
              }}
              placeholder="请输入取消原因"
              rows={4}
              error={!!cancelReasonError}
            />
          </FormItem>
        </div>
      </Modal>

      <Modal
        open={acceptModal}
        title="验收评价"
        size="md"
        onClose={() => setAcceptModal(false)}
        footer={
          <>
            <button
              onClick={() => setAcceptModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              稍后再评
            </button>
            <button
              onClick={confirmAccept}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              提交评价
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              服务评分 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i + 1)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      i < rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 hover:text-yellow-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm text-gray-500 ml-2">
                {rating} 分
              </span>
            </div>
          </div>

          <FormItem
            label="评价内容"
            required
            error={commentError}
          >
            <TextArea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setCommentError('');
              }}
              placeholder="请描述您对本次服务的评价..."
              rows={5}
              error={!!commentError}
            />
          </FormItem>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </Layout>
  );
}
