import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Power,
  Wrench,
  Users,
  Radio,
  X,
  Check,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import DataTable, { type Column, type Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FormItem, { Input, Select } from '@/components/FormItem';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loading from '@/components/Loading';
import { api } from '@/services/api';
import type { RepairWorker } from '@/types';
import { cn } from '@/lib/utils';

interface FormData {
  name: string;
  phone: string;
  specialty: string[];
  status: 'available' | 'busy' | 'offline';
}

interface FormErrors {
  name?: string;
  phone?: string;
  specialty?: string;
}

interface Toast {
  show: boolean;
  type: 'success' | 'error';
  message: string;
}

interface Statistics {
  total: number;
  online: number;
  busy: number;
  offline: number;
}

const initialFormData: FormData = {
  name: '',
  phone: '',
  specialty: [],
  status: 'available',
};

const specialtyOptions = [
  { value: 'electrical', label: '电工' },
  { value: 'plumbing', label: '水暖工' },
  { value: 'structure', label: '结构维修' },
  { value: 'appliance', label: '家电维修' },
  { value: 'other', label: '其他' },
];

const statusOptions = [
  { value: 'available', label: '空闲' },
  { value: 'busy', label: '忙碌' },
  { value: 'offline', label: '离线' },
];

export default function Workers() {
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<RepairWorker[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    online: 0,
    busy: 0,
    offline: 0,
  });

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusWorker, setStatusWorker] = useState<RepairWorker | null>(null);
  const [newStatus, setNewStatus] = useState<'available' | 'busy' | 'offline'>('available');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [toast, setToast] = useState<Toast>({ show: false, type: 'success', message: '' });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize,
      };
      if (searchText) {
        params.search = searchText;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (specialtyFilter !== 'all') {
        params.specialty = specialtyFilter;
      }
      const res = await api.workers.list(params);
      if (res.success && res.data) {
        const responseData = res.data as { data?: unknown[]; total?: number } | unknown[];
        let workerList: RepairWorker[] = [];
        if (Array.isArray(responseData)) {
          workerList = responseData as RepairWorker[];
        } else if (responseData.data) {
          workerList = responseData.data as RepairWorker[];
        }
        setWorkers(workerList);
        setStatistics({
          total: workerList.length,
          online: workerList.filter((w) => w.status === 'available').length,
          busy: workerList.filter((w) => w.status === 'busy').length,
          offline: workerList.filter((w) => w.status === 'offline').length,
        });
      }
    } catch (error) {
      console.error('加载维修工列表失败:', error);
      showToast('error', '加载维修工列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, statusFilter, specialtyFilter]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = '请输入姓名';
    }

    if (!formData.phone.trim()) {
      errors.phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      errors.phone = '手机号格式不正确';
    }

    if (formData.specialty.length === 0) {
      errors.specialty = '请至少选择一个专业';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData(initialFormData);
    setFormErrors({});
    setFormModalOpen(true);
  };

  const openEditModal = (worker: RepairWorker) => {
    setIsEditMode(true);
    setEditingId(worker.id);
    setFormData({
      name: worker.name,
      phone: worker.phone,
      specialty: worker.specialty,
      status: worker.status,
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      let res;
      if (isEditMode && editingId) {
        res = await api.workers.update(editingId, formData);
      } else {
        res = await api.workers.create(formData);
      }

      if (res.success) {
        showToast('success', isEditMode ? '编辑维修工成功' : '新增维修工成功');
        setFormModalOpen(false);
        loadWorkers();
      } else {
        showToast('error', res.error || (isEditMode ? '编辑维修工失败' : '新增维修工失败'));
      }
    } catch (error) {
      console.error('提交表单失败:', error);
      showToast('error', isEditMode ? '编辑维修工失败' : '新增维修工失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openStatusDialog = (worker: RepairWorker) => {
    setStatusWorker(worker);
    const nextStatus = worker.status === 'available' ? 'busy' : worker.status === 'busy' ? 'offline' : 'available';
    setNewStatus(nextStatus);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!statusWorker) return;

    setUpdatingStatus(true);
    try {
      const res = await api.workers.updateStatus(statusWorker.id, newStatus);
      if (res.success) {
        showToast('success', '状态更新成功');
        setStatusDialogOpen(false);
        loadWorkers();
      } else {
        showToast('error', res.error || '状态更新失败');
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      showToast('error', '状态更新失败');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDeleteDialog = (worker: RepairWorker) => {
    setDeletingId(worker.id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setDeleting(true);
    try {
      const res = await api.workers.remove(deletingId);
      if (res.success) {
        showToast('success', '删除维修工成功');
        setDeleteDialogOpen(false);
        loadWorkers();
      } else {
        showToast('error', res.error || '删除维修工失败');
      }
    } catch (error) {
      console.error('删除维修工失败:', error);
      showToast('error', '删除维修工失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleSpecialtyChange = (specialty: string) => {
    setFormData((prev) => ({
      ...prev,
      specialty: prev.specialty.includes(specialty)
        ? prev.specialty.filter((s) => s !== specialty)
        : [...prev.specialty, specialty],
    }));
  };

  const renderSpecialtyTags = (specialties: string[]) => {
    const labelMap: Record<string, string> = {
      electrical: '电工',
      plumbing: '水暖工',
      structure: '结构维修',
      appliance: '家电维修',
      other: '其他',
    };
    const colorMap: Record<string, string> = {
      electrical: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      plumbing: 'bg-blue-100 text-blue-700 border-blue-200',
      structure: 'bg-orange-100 text-orange-700 border-orange-200',
      appliance: 'bg-purple-100 text-purple-700 border-purple-200',
      other: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return (
      <div className="flex flex-wrap gap-1">
        {specialties.map((s) => (
          <span
            key={s}
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
              colorMap[s] || 'bg-gray-100 text-gray-700 border-gray-200'
            )}
          >
            {labelMap[s] || s}
          </span>
        ))}
      </div>
    );
  };

  const columns: Column<RepairWorker>[] = [
    {
      key: 'name',
      title: '姓名',
      dataIndex: 'name',
      sortable: true,
      width: '100px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-medium text-gray-900">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      title: '电话',
      dataIndex: 'phone',
      width: '120px',
      render: (value) => {
        const phone = value as string;
        return phone ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '-';
      },
    },
    {
      key: 'specialty',
      title: '专业',
      dataIndex: 'specialty',
      render: (value) => renderSpecialtyTags(value as string[]),
    },
    {
      key: 'currentOrderCount',
      title: '当前工单数',
      dataIndex: 'currentOrderCount',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className={cn(
          'font-medium',
          (value as number) > 0 ? 'text-orange-600' : 'text-gray-500'
        )}>
          {value as number}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '80px',
      align: 'center',
      render: (value) => <StatusBadge status={value as 'available' | 'busy' | 'offline'} />,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: '160px',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const actions: Action<RepairWorker>[] = [
    {
      key: 'edit',
      label: '编辑',
      icon: <Edit className="w-3.5 h-3.5" />,
      onClick: openEditModal,
    },
    {
      key: 'status',
      label: '状态切换',
      icon: <Power className="w-3.5 h-3.5" />,
      onClick: openStatusDialog,
    },
    {
      key: 'delete',
      label: '删除',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: openDeleteDialog,
      danger: true,
    },
  ];

  const statCards = [
    {
      label: '总维修工数',
      value: statistics.total,
      icon: <Users className="w-5 h-5" />,
      className: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      label: '空闲',
      value: statistics.online,
      icon: <Radio className="w-5 h-5" />,
      className: 'bg-green-50 text-green-600',
      iconBg: 'bg-green-100',
    },
    {
      label: '忙碌',
      value: statistics.busy,
      icon: <Wrench className="w-5 h-5" />,
      className: 'bg-orange-50 text-orange-600',
      iconBg: 'bg-orange-100',
    },
    {
      label: '离线',
      value: statistics.offline,
      icon: <Power className="w-5 h-5" />,
      className: 'bg-gray-50 text-gray-600',
      iconBg: 'bg-gray-100',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">维修工管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理维修工人信息</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-lg', stat.iconBg)}>
                  <span className={stat.className}>{stat.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索姓名、电话..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
                  className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {searchText && (
                  <button
                    onClick={() => {
                      setSearchText('');
                      setPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">状态：</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'available', label: '空闲' },
                  { key: 'busy', label: '忙碌' },
                  { key: 'offline', label: '离线' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setStatusFilter(item.key);
                      setPage(1);
                    }}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      statusFilter === item.key
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">专业：</span>
              <select
                value={specialtyFilter}
                onChange={(e) => {
                  setSpecialtyFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">全部</option>
                {specialtyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ml-auto"
            >
              <Plus className="w-4 h-4" />
              新增维修工
            </button>
          </div>
        </div>

        <DataTable<RepairWorker>
          columns={columns}
          data={workers}
          loading={loading}
          rowKey="id"
          pagination={true}
          pageSize={pageSize}
          showSearch={false}
          actions={actions}
          onAdd={openAddModal}
          addButtonText="新增维修工"
        />

        <Modal
          open={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          title={isEditMode ? '编辑维修工' : '新增维修工'}
          description={isEditMode ? '修改维修工信息' : '添加新的维修工人'}
          size="md"
          footer={
            <>
              <button
                onClick={() => setFormModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={formSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {formSubmitting && <Loading size="sm" />}
                {isEditMode ? '保存修改' : '新增'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem label="姓名" name="name" required error={formErrors.name}>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入姓名"
                  error={!!formErrors.name}
                />
              </FormItem>
              <FormItem label="电话" name="phone" required error={formErrors.phone}>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="请输入手机号"
                  maxLength={11}
                  error={!!formErrors.phone}
                />
              </FormItem>
            </div>
            <FormItem label="专业" name="specialty" required error={formErrors.specialty}>
              <div className="flex flex-wrap gap-2">
                {specialtyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSpecialtyChange(opt.value)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                      formData.specialty.includes(opt.value)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormItem>
            <FormItem label="状态" name="status" required>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData['status'] })}
                options={statusOptions}
              />
            </FormItem>
          </div>
        </Modal>

        <ConfirmDialog
          open={statusDialogOpen}
          onCancel={() => setStatusDialogOpen(false)}
          onConfirm={() => {
            void handleUpdateStatus();
          }}
          title="确认切换状态"
          description={`确定要将 ${statusWorker?.name} 的状态切换为 ${statusOptions.find((s) => s.value === newStatus)?.label} 吗？`}
          type="info"
          confirmText="确认切换"
          loading={updatingStatus}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={() => {
            void handleDelete();
          }}
          title="确认删除"
          description="删除后该维修工信息将无法恢复。确认要删除该维修工吗？"
          type="danger"
          confirmText="确认删除"
          loading={deleting}
        />

        {toast.show && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border',
                toast.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              )}
            >
              {toast.type === 'success' ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
