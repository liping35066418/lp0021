import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Upload, Eye, Edit, Archive, Home, User, Car, FileText, X } from 'lucide-react';
import DataTable, { Column, Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormItem, { Input, TextArea, Select } from '@/components/FormItem';
import StatusBadge from '@/components/StatusBadge';
import { api } from '@/services/api';
import type { House, Owner, Bill, ParkingSpot } from '@/types';
import { cn } from '@/lib/utils';

interface HouseFormData {
  building: string;
  unit: string;
  roomNumber: string;
  floor: string;
  area: string;
  houseType: string;
  ownerId: string;
  status: House['status'];
  remark: string;
}

interface FormErrors {
  building?: string;
  unit?: string;
  roomNumber?: string;
  floor?: string;
  area?: string;
  houseType?: string;
}

const houseStatusOptions = [
  { value: '', label: '全部' },
  { value: 'occupied', label: '已入住' },
  { value: 'vacant', label: '空置' },
  { value: 'rented', label: '出租中' },
  { value: 'archived', label: '已归档' },
];

const houseFormStatusOptions = [
  { value: 'occupied', label: '已入住' },
  { value: 'vacant', label: '空置' },
  { value: 'rented', label: '出租中' },
];

const houseTypeOptions = [
  { value: '', label: '请选择户型' },
  { value: '一室一厅', label: '一室一厅' },
  { value: '两室一厅', label: '两室一厅' },
  { value: '两室两厅', label: '两室两厅' },
  { value: '三室一厅', label: '三室一厅' },
  { value: '三室两厅', label: '三室两厅' },
  { value: '四室两厅', label: '四室两厅' },
  { value: '复式', label: '复式' },
  { value: '别墅', label: '别墅' },
];

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

export default function Houses() {
  const [loading, setLoading] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [formData, setFormData] = useState<HouseFormData>({
    building: '',
    unit: '',
    roomNumber: '',
    floor: '',
    area: '',
    houseType: '',
    ownerId: '',
    status: 'vacant',
    remark: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [houseDetail, setHouseDetail] = useState<House | null>(null);
  const [houseBills, setHouseBills] = useState<Bill[]>([]);
  const [houseParking, setHouseParking] = useState<ParkingSpot[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingHouse, setArchivingHouse] = useState<House | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const fetchHouses = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (searchKeyword) params.keyword = searchKeyword;
      if (statusFilter) params.status = statusFilter;
      if (ownerFilter) params.ownerId = ownerFilter;

      const res = await api.houses.list(params);
      if (res.success) {
        setHouses((res.data as { data: House[] }).data || []);
        setPagination((prev) => ({
          ...prev,
          total: (res.data as { total: number }).total || 0,
        }));
      } else {
        toast(res.error || '获取房屋列表失败', 'error');
      }
    } catch {
      toast('获取房屋列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, searchKeyword, statusFilter, ownerFilter]);

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
    fetchHouses();
    fetchOwners();
  }, [fetchHouses, fetchOwners]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleReset = () => {
    setSearchKeyword('');
    setStatusFilter('');
    setOwnerFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const openAddModal = () => {
    setEditingHouse(null);
    setFormData({
      building: '',
      unit: '',
      roomNumber: '',
      floor: '',
      area: '',
      houseType: '',
      ownerId: '',
      status: 'vacant',
      remark: '',
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const openEditModal = (house: House) => {
    setEditingHouse(house);
    setFormData({
      building: house.building,
      unit: house.unit,
      roomNumber: house.roomNumber,
      floor: String(house.floor),
      area: String(house.area),
      houseType: house.houseType,
      ownerId: house.ownerId || '',
      status: house.status,
      remark: house.remark || '',
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.building.trim()) errors.building = '请输入楼栋';
    if (!formData.unit.trim()) errors.unit = '请输入单元';
    if (!formData.roomNumber.trim()) errors.roomNumber = '请输入房号';
    if (!formData.floor.trim()) errors.floor = '请输入楼层';
    else if (isNaN(Number(formData.floor))) errors.floor = '楼层必须是数字';
    if (!formData.area.trim()) errors.area = '请输入面积';
    else if (isNaN(Number(formData.area))) errors.area = '面积必须是数字';
    if (!formData.houseType.trim()) errors.houseType = '请选择户型';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const submitData = {
        building: formData.building.trim(),
        unit: formData.unit.trim(),
        roomNumber: formData.roomNumber.trim(),
        floor: Number(formData.floor),
        area: Number(formData.area),
        houseType: formData.houseType,
        ownerId: formData.ownerId || undefined,
        status: formData.status,
        remark: formData.remark || undefined,
      };

      let res;
      if (editingHouse) {
        res = await api.houses.update(editingHouse.id, submitData);
      } else {
        res = await api.houses.create(submitData);
      }

      if (res.success) {
        toast(editingHouse ? '编辑成功' : '新增成功', 'success');
        setFormModalOpen(false);
        fetchHouses();
      } else {
        toast(res.error || '操作失败', 'error');
      }
    } catch {
      toast('操作失败', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openDetailModal = async (house: House) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const [detailRes, billsRes, parkingRes] = await Promise.all([
        api.houses.get(house.id),
        api.billing.list({ houseId: house.id, pageSize: 100 }),
        api.parking.list({ ownerId: house.ownerId, pageSize: 100 }),
      ]);

      if (detailRes.success) {
        setHouseDetail(detailRes.data as House);
      }
      if (billsRes.success) {
        setHouseBills(((billsRes.data as { data: Bill[] }).data || []) as Bill[]);
      }
      if (parkingRes.success) {
        setHouseParking(((parkingRes.data as { data: ParkingSpot[] }).data || []) as ParkingSpot[]);
      }
    } catch {
      toast('获取详情失败', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const openArchiveDialog = (house: House) => {
    setArchivingHouse(house);
    setArchiveDialogOpen(true);
  };

  const handleArchive = async () => {
    if (!archivingHouse) return;
    setArchiveLoading(true);
    try {
      const res = await api.houses.archive(archivingHouse.id);
      if (res.success) {
        toast('归档成功', 'success');
        setArchiveDialogOpen(false);
        fetchHouses();
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

      const res = await api.houses.batchImport(data);
      if (res.success) {
        const result = res.data as {
          total: number;
          success: number;
          duplicate: number;
          invalid: number;
        };
        toast(
          `导入完成：共${result.total}条，成功${result.success}条，重复${result.duplicate}条，无效${result.invalid}条`,
          'success'
        );
        setImportModalOpen(false);
        setImportText('');
        fetchHouses();
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

  const getPropertyFee = (area: number) => {
    return (area * 2.5).toFixed(2);
  };

  const columns: Column<House>[] = [
    { key: 'building', title: '楼栋', dataIndex: 'building', width: '80px', align: 'center' },
    { key: 'unit', title: '单元', dataIndex: 'unit', width: '80px', align: 'center' },
    { key: 'roomNumber', title: '房号', dataIndex: 'roomNumber', width: '80px', align: 'center' },
    { key: 'floor', title: '楼层', dataIndex: 'floor', width: '80px', align: 'center' },
    { key: 'area', title: '面积(㎡)', dataIndex: 'area', width: '100px', align: 'right' },
    { key: 'houseType', title: '户型', dataIndex: 'houseType', width: '100px', align: 'center' },
    {
      key: 'owner',
      title: '业主',
      dataIndex: 'ownerId',
      width: '100px',
      align: 'center',
      render: (value) => getOwnerName(value as string),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      align: 'center',
      render: (value) => <StatusBadge status={value as House['status']} />,
    },
    {
      key: 'propertyFee',
      title: '物业费(元/月)',
      dataIndex: 'area',
      width: '120px',
      align: 'right',
      render: (value) => getPropertyFee(value as number),
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

  const actions: Action<House>[] = [
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
        <h1 className="text-2xl font-bold text-gray-900">房屋管理</h1>
        <p className="mt-1 text-sm text-gray-500">管理小区内所有房屋信息</p>
      </div>

      <div className="mb-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="楼栋/单元/房号模糊搜索"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={houseStatusOptions}
            className="w-36"
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
            新增房屋
          </button>
        </div>
      </div>

      <DataTable<House>
        columns={columns}
        data={houses}
        loading={loading}
        rowKey="id"
        pagination
        pageSize={pagination.pageSize}
        showSearch={false}
        actions={actions}
        emptyText="暂无房屋数据"
      />

      <Modal
        open={formModalOpen}
        title={editingHouse ? '编辑房屋' : '新增房屋'}
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
          <FormItem label="楼栋" required error={formErrors.building}>
            <Input
              value={formData.building}
              onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              error={!!formErrors.building}
              placeholder="请输入楼栋"
            />
          </FormItem>
          <FormItem label="单元" required error={formErrors.unit}>
            <Input
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              error={!!formErrors.unit}
              placeholder="请输入单元"
            />
          </FormItem>
          <FormItem label="房号" required error={formErrors.roomNumber}>
            <Input
              value={formData.roomNumber}
              onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
              error={!!formErrors.roomNumber}
              placeholder="请输入房号"
            />
          </FormItem>
          <FormItem label="楼层" required error={formErrors.floor}>
            <Input
              value={formData.floor}
              onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
              error={!!formErrors.floor}
              placeholder="请输入楼层"
              type="number"
            />
          </FormItem>
          <FormItem label="面积(㎡)" required error={formErrors.area}>
            <Input
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              error={!!formErrors.area}
              placeholder="请输入面积"
              type="number"
              step="0.01"
            />
          </FormItem>
          <FormItem label="户型" required error={formErrors.houseType}>
            <Select
              value={formData.houseType}
              onChange={(e) => setFormData({ ...formData, houseType: e.target.value })}
              options={houseTypeOptions}
              error={!!formErrors.houseType}
            />
          </FormItem>
          <FormItem label="业主">
            <Select
              value={formData.ownerId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ownerId: e.target.value,
                  status: e.target.value ? 'occupied' : 'vacant',
                })
              }
              options={ownerFormOptions}
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as House['status'] })}
              options={houseFormStatusOptions}
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
        title="房屋详情"
        size="xl"
        onClose={() => setDetailModalOpen(false)}
      >
        {detailLoading ? (
          <div className="py-12 text-center text-gray-500">加载中...</div>
        ) : houseDetail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">房屋信息</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">楼栋：</span>
                    <span className="font-medium">{houseDetail.building}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">单元：</span>
                    <span className="font-medium">{houseDetail.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">房号：</span>
                    <span className="font-medium">{houseDetail.roomNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">楼层：</span>
                    <span className="font-medium">{houseDetail.floor}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">面积：</span>
                    <span className="font-medium">{houseDetail.area} ㎡</span>
                  </div>
                  <div>
                    <span className="text-gray-500">户型：</span>
                    <span className="font-medium">{houseDetail.houseType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">物业费：</span>
                    <span className="font-medium">{getPropertyFee(houseDetail.area)} 元/月</span>
                  </div>
                  <div>
                    <span className="text-gray-500">状态：</span>
                    <StatusBadge status={houseDetail.status} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">业主信息</h3>
                </div>
                {houseDetail.owner ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">姓名：</span>
                      <span className="font-medium">{houseDetail.owner.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">电话：</span>
                      <span className="font-medium">{houseDetail.owner.phone}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">身份证：</span>
                      <span className="font-medium">{houseDetail.owner.idCard}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">地址：</span>
                      <span className="font-medium">{houseDetail.owner.address}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暂无业主信息</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">关联车位</h3>
              </div>
              {houseParking.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {houseParking.map((spot) => (
                    <div key={spot.id} className="p-3 bg-white rounded-lg">
                      <div className="font-medium">{spot.spotNumber}</div>
                      <div className="text-gray-500 text-xs mt-1">{spot.area}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂无关联车位</p>
              )}
            </div>

            <div className="p-4 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">历史账单</h3>
              </div>
              {houseBills.length > 0 ? (
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
                      {houseBills.slice(0, 10).map((bill) => (
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

            {houseDetail.remark && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">备注</h3>
                <p className="text-sm text-gray-600">{houseDetail.remark}</p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={archiveDialogOpen}
        title="确认归档"
        description={`确定要归档房屋 ${archivingHouse?.building}栋${archivingHouse?.unit}单元${archivingHouse?.roomNumber} 吗？归档后将无法恢复。`}
        type="danger"
        confirmText="确认归档"
        loading={archiveLoading}
        onConfirm={handleArchive}
        onCancel={() => setArchiveDialogOpen(false)}
      />

      <Modal
        open={importModalOpen}
        title="批量导入房屋"
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
            <p>请粘贴JSON数组格式数据，必填字段：building、unit、roomNumber、floor、area、houseType</p>
            <p className="mt-1 text-xs text-blue-600">
              示例：[{'{'}"building": "1", "unit": "1", "roomNumber": "101", "floor": 1, "area": 89.5, "houseType": "两室一厅"{'}'}]
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
