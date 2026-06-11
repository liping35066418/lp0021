import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Upload,
  Eye,
  Edit,
  Archive,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Home,
  Car,
  CreditCard,
  X,
  Check,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import DataTable, { type Column, type Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FormItem, { Input, TextArea } from '@/components/FormItem';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loading from '@/components/Loading';
import { api } from '@/services/api';
import type { Owner, House, ParkingSpot, Bill } from '@/types';
import { cn } from '@/lib/utils';

interface FormData {
  name: string;
  idCard: string;
  phone: string;
  email: string;
  address: string;
  remark: string;
}

interface FormErrors {
  name?: string;
  idCard?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface Toast {
  show: boolean;
  type: 'success' | 'error';
  message: string;
}

const initialFormData: FormData = {
  name: '',
  idCard: '',
  phone: '',
  email: '',
  address: '',
  remark: '',
};

export default function Owners() {
  const [loading, setLoading] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [ownerHouses, setOwnerHouses] = useState<House[]>([]);
  const [ownerParking, setOwnerParking] = useState<ParkingSpot[]>([]);
  const [ownerBills, setOwnerBills] = useState<Bill[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'houses' | 'parking' | 'bills'>('info');

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [toast, setToast] = useState<Toast>({ show: false, type: 'success', message: '' });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const loadOwners = useCallback(async () => {
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
      const res = await api.owners.list(params);
      if (res.success && res.data) {
        const responseData = res.data as { data?: unknown[]; total?: number } | unknown[];
        if (Array.isArray(responseData)) {
          setOwners(responseData as Owner[]);
        } else if (responseData.data) {
          setOwners(responseData.data as Owner[]);
        }
      }
    } catch (error) {
      console.error('加载业主列表失败:', error);
      showToast('error', '加载业主列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, statusFilter]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    loadOwners();
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = '请输入姓名';
    }

    if (!formData.idCard.trim()) {
      errors.idCard = '请输入身份证号';
    } else if (!/^\d{17}[\dXx]$/.test(formData.idCard)) {
      errors.idCard = '身份证号格式不正确';
    }

    if (!formData.phone.trim()) {
      errors.phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      errors.phone = '手机号格式不正确';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '邮箱格式不正确';
    }

    if (!formData.address.trim()) {
      errors.address = '请输入地址';
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

  const openEditModal = (owner: Owner) => {
    setIsEditMode(true);
    setEditingId(owner.id);
    setFormData({
      name: owner.name,
      idCard: owner.idCard,
      phone: owner.phone,
      email: owner.email || '',
      address: owner.address,
      remark: owner.remark || '',
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
        res = await api.owners.update(editingId, formData);
      } else {
        res = await api.owners.create(formData);
      }

      if (res.success) {
        showToast('success', isEditMode ? '编辑业主成功' : '新增业主成功');
        setFormModalOpen(false);
        loadOwners();
      } else {
        showToast('error', res.error || (isEditMode ? '编辑业主失败' : '新增业主失败'));
      }
    } catch (error) {
      console.error('提交表单失败:', error);
      showToast('error', isEditMode ? '编辑业主失败' : '新增业主失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openDetailModal = async (owner: Owner) => {
    setSelectedOwner(owner);
    setActiveDetailTab('info');
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const [housesRes, parkingRes, billsRes] = await Promise.all([
        api.owners.getHouses(owner.id),
        api.owners.getParking(owner.id),
        api.owners.getBills(owner.id),
      ]);

      setOwnerHouses((housesRes.data as House[]) || []);
      setOwnerParking((parkingRes.data as ParkingSpot[]) || []);
      setOwnerBills((billsRes.data as Bill[]) || []);
    } catch (error) {
      console.error('加载业主详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openArchiveDialog = (owner: Owner) => {
    setArchivingId(owner.id);
    setArchiveDialogOpen(true);
  };

  const handleArchive = async () => {
    if (!archivingId) return;

    setArchiving(true);
    try {
      const res = await api.owners.archive(archivingId);
      if (res.success) {
        showToast('success', '归档业主成功');
        setArchiveDialogOpen(false);
        loadOwners();
      } else {
        showToast('error', res.error || '归档业主失败');
      }
    } catch (error) {
      console.error('归档业主失败:', error);
      showToast('error', '归档业主失败');
    } finally {
      setArchiving(false);
    }
  };

  const handleBatchImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let data;
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else {
          const lines = text.split('\n');
          const headers = lines[0].split(',').map((h) => h.trim());
          data = lines.slice(1).filter((l) => l.trim()).map((line) => {
            const values = line.split(',');
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = values[i]?.trim() || '';
            });
            return obj;
          });
        }

        const res = await api.owners.batchImport(data);
        if (res.success) {
          const result = res.data as { imported: number; invalid: number; duplicates: number };
          showToast('success', `导入成功：新增${result.imported}条，重复${result.duplicates}条，无效${result.invalid}条`);
          loadOwners();
        } else {
          showToast('error', res.error || '导入失败');
        }
      } catch (error) {
        console.error('导入失败:', error);
        showToast('error', '导入失败，请检查文件格式');
      }
    };
    input.click();
  };

  const columns: Column<Owner>[] = [
    {
      key: 'name',
      title: '姓名',
      dataIndex: 'name',
      sortable: true,
      width: '100px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-medium text-gray-900">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'idCard',
      title: '身份证号',
      dataIndex: 'idCard',
      width: '160px',
      ellipsis: true,
      render: (value) => {
        const id = value as string;
        return id ? `${id.slice(0, 6)}********${id.slice(-4)}` : '-';
      },
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
      key: 'email',
      title: '邮箱',
      dataIndex: 'email',
      width: '160px',
      ellipsis: true,
      render: (value) => (value as string) || '-',
    },
    {
      key: 'address',
      title: '地址',
      dataIndex: 'address',
      ellipsis: true,
      render: (value) => (value as string) || '-',
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '80px',
      align: 'center',
      render: (value) => <StatusBadge status={value as 'active' | 'archived'} />,
    },
    {
      key: 'houseCount',
      title: '关联房产',
      dataIndex: 'id',
      width: '90px',
      align: 'center',
      render: () => (
        <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
          <Home className="w-3.5 h-3.5" />
          <span>{ownerHouses.length || 0}</span>
        </div>
      ),
    },
    {
      key: 'parkingCount',
      title: '关联车位',
      dataIndex: 'id',
      width: '90px',
      align: 'center',
      render: () => (
        <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
          <Car className="w-3.5 h-3.5" />
          <span>{ownerParking.length || 0}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: '160px',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const actions: Action<Owner>[] = [
    {
      key: 'view',
      label: '详情',
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: openDetailModal,
    },
    {
      key: 'edit',
      label: '编辑',
      icon: <Edit className="w-3.5 h-3.5" />,
      onClick: openEditModal,
      hidden: (record) => record.status === 'archived',
    },
    {
      key: 'archive',
      label: '归档',
      icon: <Archive className="w-3.5 h-3.5" />,
      onClick: openArchiveDialog,
      danger: true,
      hidden: (record) => record.status === 'archived',
    },
  ];

  const detailTabs = [
    { key: 'info', label: '基本信息', icon: <User className="w-4 h-4" /> },
    { key: 'houses', label: '关联房产', icon: <Home className="w-4 h-4" /> },
    { key: 'parking', label: '关联车位', icon: <Car className="w-4 h-4" /> },
    { key: 'bills', label: '最近账单', icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">业主管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理小区业主信息</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索姓名、电话、身份证号..."
                  value={searchText}
                  onChange={handleSearch}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {searchText && (
                  <button
                    onClick={() => {
                      setSearchText('');
                      setPage(1);
                      loadOwners();
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
                  { key: 'active', label: '正常' },
                  { key: 'archived', label: '已归档' },
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

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleBatchImport}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Upload className="w-4 h-4" />
                批量导入
              </button>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新增业主
              </button>
            </div>
          </div>
        </div>

        <DataTable<Owner>
          columns={columns}
          data={owners}
          loading={loading}
          rowKey="id"
          pagination={true}
          pageSize={pageSize}
          showSearch={false}
          actions={actions}
          onAdd={openAddModal}
          addButtonText="新增业主"
        />

        <Modal
          open={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          title={isEditMode ? '编辑业主' : '新增业主'}
          description={isEditMode ? '修改业主信息' : '添加新的业主信息'}
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
              <FormItem label="身份证号" name="idCard" required error={formErrors.idCard}>
                <Input
                  value={formData.idCard}
                  onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                  placeholder="请输入身份证号"
                  maxLength={18}
                  error={!!formErrors.idCard}
                />
              </FormItem>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem label="手机号" name="phone" required error={formErrors.phone}>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="请输入手机号"
                  maxLength={11}
                  error={!!formErrors.phone}
                />
              </FormItem>
              <FormItem label="邮箱" name="email" error={formErrors.email}>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="请输入邮箱（选填）"
                  error={!!formErrors.email}
                />
              </FormItem>
            </div>
            <FormItem label="地址" name="address" required error={formErrors.address}>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="请输入详细地址"
                error={!!formErrors.address}
              />
            </FormItem>
            <FormItem label="备注" name="remark">
              <TextArea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="请输入备注信息（选填）"
                rows={3}
              />
            </FormItem>
          </div>
        </Modal>

        <Modal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="业主详情"
          size="xl"
        >
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading size="lg" text="加载中..." />
            </div>
          ) : selectedOwner ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedOwner.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={selectedOwner.status} />
                    <span className="text-sm text-gray-500">
                      创建于 {dayjs(selectedOwner.createdAt).format('YYYY-MM-DD')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-200">
                <div className="flex gap-1">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveDetailTab(tab.key as typeof activeDetailTab)}
                      className={cn(
                        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                        activeDetailTab === tab.key
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeDetailTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">姓名</p>
                        <p className="text-base font-medium text-gray-900">{selectedOwner.name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">身份证号</p>
                        <p className="text-base font-medium text-gray-900">{selectedOwner.idCard}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">电话</p>
                        <p className="text-base font-medium text-gray-900">{selectedOwner.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">邮箱</p>
                        <p className="text-base font-medium text-gray-900">{selectedOwner.email || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">地址</p>
                        <p className="text-base font-medium text-gray-900">{selectedOwner.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">备注</p>
                        <p className="text-base font-medium text-gray-900">{selectedOwner.remark || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === 'houses' && (
                <div>
                  {ownerHouses.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">暂无关联房产</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              房屋信息
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              面积
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              类型
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              状态
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ownerHouses.map((house) => (
                            <tr key={house.id}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">
                                  {house.building}栋 {house.unit}单元 {house.roomNumber}
                                </p>
                                <p className="text-sm text-gray-500">{house.floor}层</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{house.area}㎡</td>
                              <td className="px-4 py-3 text-sm text-gray-700">{house.houseType}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={house.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'parking' && (
                <div>
                  {ownerParking.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">暂无关联车位</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              车位号
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              区域
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              类型
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              月费
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              状态
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ownerParking.map((spot) => (
                            <tr key={spot.id}>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {spot.spotNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{spot.area}</td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {{
                                  underground: '地下',
                                  ground: '地面',
                                  mechanical: '机械',
                                }[spot.type] || spot.type}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">¥{spot.monthlyFee}/月</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={spot.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'bills' && (
                <div>
                  {ownerBills.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">暂无账单记录</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              账单号
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              类型
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              金额
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              账期
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              到期日
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              状态
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ownerBills.slice(0, 10).map((bill) => (
                            <tr key={bill.id}>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {bill.billNo}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {{
                                  property_fee: '物业费',
                                  water_fee: '水费',
                                  electric_fee: '电费',
                                  parking_fee: '停车费',
                                }[bill.type] || bill.type}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                ¥{bill.amount.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {bill.billingPeriod}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {dayjs(bill.dueDate).format('YYYY-MM-DD')}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={bill.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </Modal>

        <ConfirmDialog
          open={archiveDialogOpen}
          onCancel={() => setArchiveDialogOpen(false)}
          onConfirm={() => {
            void handleArchive();
          }}
          title="确认归档"
          description="归档后该业主信息将被标记为已归档，且无法再进行编辑操作。确认要归档该业主吗？"
          type="danger"
          confirmText="确认归档"
          loading={archiving}
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
