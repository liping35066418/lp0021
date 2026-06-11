import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Upload, Eye, Edit, Archive, Car, User, FileText, X } from 'lucide-react';
import DataTable, { Column, Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormItem, { Input, TextArea, Select } from '@/components/FormItem';
import StatusBadge from '@/components/StatusBadge';
import { api } from '@/services/api';
import type { ParkingSpot, Owner, Bill } from '@/types';
import { cn } from '@/lib/utils';

interface ParkingFormData {
  spotNumber: string;
  area: string;
  type: ParkingSpot['type'] | '';
  monthlyFee: string;
  ownerId: string;
  status: ParkingSpot['status'];
  remark: string;
}

interface FormErrors {
  spotNumber?: string;
  area?: string;
  type?: string;
  monthlyFee?: string;
}

const typeOptions = [
  { value: '', label: '全部' },
  { value: 'underground', label: '地下' },
  { value: 'ground', label: '地面' },
  { value: 'mechanical', label: '机械' },
];

const formTypeOptions = [
  { value: 'underground', label: '地下' },
  { value: 'ground', label: '地面' },
  { value: 'mechanical', label: '机械' },
];

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'available', label: '可用' },
  { value: 'occupied', label: '已占用' },
  { value: 'archived', label: '已归档' },
];

const formStatusOptions = [
  { value: 'available', label: '可用' },
  { value: 'occupied', label: '已占用' },
];

const typeLabels: Record<string, string> = {
  underground: '地下',
  ground: '地面',
  mechanical: '机械',
};

function toast(message: string, type: 'success' | 'error' = 'success') {
  const toastEl = document.createElement('div');
  toastEl.className = cn(
    'fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-white font-medium animate-in slide-in-from-right duration-300',
    type === 'success' ? 'bg-green-500' : 'bg-red-500'
  );
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    toastEl.remove();
  }, 3000);
}

export default function Parking() {
  const [loading, setLoading] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<ParkingSpot | null>(null);
  const [formData, setFormData] = useState<ParkingFormData>({
    spotNumber: '',
    area: '',
    type: '',
    monthlyFee: '',
    ownerId: '',
    status: 'available',
    remark: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [spotDetail, setSpotDetail] = useState<ParkingSpot | null>(null);
  const [spotBills, setSpotBills] = useState<Bill[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingSpot, setArchivingSpot] = useState<ParkingSpot | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const fetchParkingSpots = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (searchKeyword) params.keyword = searchKeyword;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (ownerFilter) params.ownerId = ownerFilter;

      const res = await api.parking.list(params);
      if (res.success) {
        setParkingSpots((res.data as { data: ParkingSpot[] }).data || []);
        setPagination((prev) => ({
          ...prev,
          total: (res.data as { total: number }).total || 0,
        }));
      } else {
        toast(res.error || '获取车位列表失败', 'error');
      }
    } catch {
      toast('获取车位列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, searchKeyword, typeFilter, statusFilter, ownerFilter]);

  const fetchOwners = useCallback(async () => {
    try {
      const res = await api.owners.list({ pageSize: 100 });
      if (res.success) {
        setOwners((res.data as { data: Owner[] }).data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchParkingSpots();
    fetchOwners();
  }, [fetchParkingSpots, fetchOwners]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleReset = () => {
    setSearchKeyword('');
    setTypeFilter('');
    setStatusFilter('');
    setOwnerFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const openAddModal = () => {
    setEditingSpot(null);
    setFormData({
      spotNumber: '',
      area: '',
      type: '',
      monthlyFee: '',
      ownerId: '',
      status: 'available',
      remark: '',
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const openEditModal = (spot: ParkingSpot) => {
    setEditingSpot(spot);
    setFormData({
      spotNumber: spot.spotNumber,
      area: spot.area,
      type: spot.type,
      monthlyFee: String(spot.monthlyFee),
      ownerId: spot.ownerId || '',
      status: spot.status,
      remark: spot.remark || '',
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.spotNumber.trim()) errors.spotNumber = '请输入车位号';
    if (!formData.area.trim()) errors.area = '请输入区域';
    if (!formData.type) errors.type = '请选择类型';
    if (!formData.monthlyFee.trim()) errors.monthlyFee = '请输入月租金';
    else if (isNaN(Number(formData.monthlyFee))) errors.monthlyFee = '月租金必须是数字';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const submitData = {
        spotNumber: formData.spotNumber.trim(),
        area: formData.area.trim(),
        type: formData.type as ParkingSpot['type'],
        monthlyFee: Number(formData.monthlyFee),
        ownerId: formData.ownerId || undefined,
        status: formData.status,
        remark: formData.remark || undefined,
      };

      let res;
      if (editingSpot) {
        res = await api.parking.update(editingSpot.id, submitData);
      } else {
        res = await api.parking.create(submitData);
      }

      if (res.success) {
        toast(editingSpot ? '编辑成功' : '新增成功', 'success');
        setFormModalOpen(false);
        fetchParkingSpots();
      } else {
        toast(res.error || '操作失败', 'error');
      }
    } catch {
      toast('操作失败', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openDetailModal = async (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const [detailRes, billsRes] = await Promise.all([
        api.parking.get(spot.id),
        api.billing.list({ parkingSpotId: spot.id, pageSize: 100 }),
      ]);

      if (detailRes.success) {
        setSpotDetail(detailRes.data as ParkingSpot);
      }
      if (billsRes.success) {
        setSpotBills(((billsRes.data as { data: Bill[] }).data || []) as Bill[]);
      }
    } catch {
      toast('获取详情失败', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const openArchiveDialog = (spot: ParkingSpot) => {
    setArchivingSpot(spot);
    setArchiveDialogOpen(true);
  };

  const handleArchive = async () => {
    if (!archivingSpot) return;
    setArchiveLoading(true);
    try {
      const res = await api.parking.archive(archivingSpot.id);
      if (res.success) {
        toast('归档成功', 'success');
        setArchiveDialogOpen(false);
        fetchParkingSpots();
      } else {
        toast(res.error || '归档失败', 'error');
      }
    } catch {
      toast('归档失败', 'error');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleBatchImport = async () => {
    if (!importText.trim()) {
      toast('请输入导入数据', 'error');
      return;
    }
    setImportLoading(true);
    try {
      let data;
      try {
        data = JSON.parse(importText);
      } catch {
        toast('JSON格式错误', 'error');
        return;
      }

      if (!Array.isArray(data)) {
        toast('数据必须是数组格式', 'error');
        return;
      }

      const res = await api.parking.batchImport(data);
      if (res.success) {
        const result = res.data as {
          total: number;
          imported: number;
          duplicates: number;
          invalid: number;
        };
        toast(
          `导入完成：共${result.total}条，成功${result.imported}条，重复${result.duplicates}条，无效${result.invalid}条`,
          'success'
        );
        setImportModalOpen(false);
        setImportText('');
        fetchParkingSpots();
      } else {
        toast(res.error || '导入失败', 'error');
      }
    } catch {
      toast('导入失败', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const getOwnerName = (ownerId?: string) => {
    if (!ownerId) return '-';
    const owner = owners.find((o) => o.id === ownerId);
    return owner?.name || '-';
  };

  const columns: Column<ParkingSpot>[] = [
    { key: 'spotNumber', title: '车位号', dataIndex: 'spotNumber', width: '120px', align: 'center' },
    { key: 'area', title: '区域', dataIndex: 'area', width: '120px', align: 'center' },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: '100px',
      align: 'center',
      render: (value) => typeLabels[value as string] || (value as string),
    },
    {
      key: 'owner',
      title: '业主',
      dataIndex: 'ownerId',
      width: '100px',
      align: 'center',
      render: (value) => getOwnerName(value as string),
    },
    {
      key: 'monthlyFee',
      title: '月租金(元)',
      dataIndex: 'monthlyFee',
      width: '120px',
      align: 'right',
      render: (value) => Number(value).toFixed(2),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      align: 'center',
      render: (value) => <StatusBadge status={value as ParkingSpot['status']} />,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: '180px',
      align: 'center',
      render: (value) => new Date(value as string).toLocaleString('zh-CN'),
    },
  ];

  const actions: Action<ParkingSpot>[] = [
    { key: 'view', label: '查看', icon: <Eye className="w-3.5 h-3.5" />, onClick: openDetailModal },
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

  const ownerOptions = [
    { value: '', label: '全部业主' },
    ...owners.map((o) => ({ value: o.id, label: o.name })),
  ];

  const ownerFormOptions = [
    { value: '', label: '请选择业主' },
    ...owners.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">车位管理</h1>
        <p className="mt-1 text-sm text-gray-500">管理小区内所有车位信息</p>
      </div>

      <div className="mb-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="车位号/区域模糊搜索"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={typeOptions}
            className="w-32"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="w-32"
          />
          <Select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            options={ownerOptions}
            className="w-36"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            重置
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增车位
          </button>
        </div>
      </div>

      <DataTable<ParkingSpot>
        columns={columns}
        data={parkingSpots}
        loading={loading}
        rowKey="id"
        pagination
        pageSize={pagination.pageSize}
        showSearch={false}
        actions={actions}
        emptyText="暂无车位数据"
      />

      <Modal
        open={formModalOpen}
        title={editingSpot ? '编辑车位' : '新增车位'}
        size="lg"
        onClose={() => setFormModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={formSubmitting}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={formSubmitting}
            >
              {formSubmitting ? '提交中...' : '提交'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormItem label="车位号" required error={formErrors.spotNumber}>
            <Input
              value={formData.spotNumber}
              onChange={(e) => setFormData({ ...formData, spotNumber: e.target.value })}
              error={!!formErrors.spotNumber}
              placeholder="请输入车位号"
            />
          </FormItem>
          <FormItem label="区域" required error={formErrors.area}>
            <Input
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              error={!!formErrors.area}
              placeholder="请输入区域"
            />
          </FormItem>
          <FormItem label="类型" required error={formErrors.type}>
            <Select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as ParkingSpot['type'] })}
              options={[{ value: '', label: '请选择类型' }, ...formTypeOptions]}
              error={!!formErrors.type}
            />
          </FormItem>
          <FormItem label="月租金(元)" required error={formErrors.monthlyFee}>
            <Input
              value={formData.monthlyFee}
              onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
              error={!!formErrors.monthlyFee}
              placeholder="请输入月租金"
              type="number"
              step="0.01"
            />
          </FormItem>
          <FormItem label="业主">
            <Select
              value={formData.ownerId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ownerId: e.target.value,
                  status: e.target.value ? 'occupied' : 'available',
                })
              }
              options={ownerFormOptions}
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ParkingSpot['status'] })}
              options={formStatusOptions}
            />
          </FormItem>
          <FormItem label="备注" className="col-span-2">
            <TextArea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              placeholder="请输入备注"
              rows={3}
            />
          </FormItem>
        </div>
      </Modal>

      <Modal
        open={detailModalOpen}
        title="车位详情"
        size="xl"
        onClose={() => setDetailModalOpen(false)}
      >
        {detailLoading ? (
          <div className="py-12 text-center text-gray-500">加载中...</div>
        ) : spotDetail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Car className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">车位信息</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">车位号：</span>
                    <span className="font-medium">{spotDetail.spotNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">区域：</span>
                    <span className="font-medium">{spotDetail.area}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">类型：</span>
                    <span className="font-medium">{typeLabels[spotDetail.type] || spotDetail.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">月租金：</span>
                    <span className="font-medium">¥{spotDetail.monthlyFee.toFixed(2)}/月</span>
                  </div>
                  <div>
                    <span className="text-gray-500">状态：</span>
                    <StatusBadge status={spotDetail.status} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">业主信息</h3>
                </div>
                {spotDetail.owner ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">姓名：</span>
                      <span className="font-medium">{spotDetail.owner.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">电话：</span>
                      <span className="font-medium">{spotDetail.owner.phone}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">身份证：</span>
                      <span className="font-medium">{spotDetail.owner.idCard}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">地址：</span>
                      <span className="font-medium">{spotDetail.owner.address}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暂无业主信息</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">历史停车费账单</h3>
              </div>
              {spotBills.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orange-200">
                        <th className="py-2 px-3 text-left font-medium text-gray-600">账单号</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">类型</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">账期</th>
                        <th className="py-2 px-3 text-right font-medium text-gray-600">金额</th>
                        <th className="py-2 px-3 text-center font-medium text-gray-600">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spotBills.slice(0, 10).map((bill) => (
                        <tr key={bill.id} className="border-b border-orange-100">
                          <td className="py-2 px-3">{bill.billNo}</td>
                          <td className="py-2 px-3">{bill.title}</td>
                          <td className="py-2 px-3">{bill.billingPeriod}</td>
                          <td className="py-2 px-3 text-right font-medium">¥{bill.amount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <StatusBadge status={bill.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂无历史账单</p>
              )}
            </div>

            {spotDetail.remark && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">备注</h3>
                <p className="text-sm text-gray-600">{spotDetail.remark}</p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={archiveDialogOpen}
        title="确认归档"
        description={`确定要归档车位 ${archivingSpot?.spotNumber} 吗？归档后将无法恢复。`}
        type="danger"
        confirmText="确认归档"
        loading={archiveLoading}
        onConfirm={handleArchive}
        onCancel={() => setArchiveDialogOpen(false)}
      />

      <Modal
        open={importModalOpen}
        title="批量导入车位"
        size="lg"
        onClose={() => setImportModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={importLoading}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleBatchImport}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={importLoading}
            >
              {importLoading ? '导入中...' : '导入'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">导入格式说明：</p>
            <p>请粘贴JSON数组格式数据，必填字段：spotNumber、area、type、monthlyFee</p>
            <p className="mt-1 text-xs text-blue-600">
              示例：[{'{'}"spotNumber": "A001", "area": "A区地下", "type": "underground", "monthlyFee": 300{'}'}]
            </p>
          </div>
          <div className="relative">
            <TextArea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="请粘贴JSON数据..."
              rows={12}
              className="font-mono text-xs"
            />
            {importText && (
              <button
                type="button"
                onClick={() => setImportText('')}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
