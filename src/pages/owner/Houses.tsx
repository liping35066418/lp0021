import { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Users,
  FileText,
  AlertTriangle,
  Clock,
  Receipt,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import type { House, RepairOrder, Bill, Owner } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const statusLabels: Record<string, string> = {
  occupied: '已入住',
  vacant: '空置',
  rented: '已出租',
  archived: '已归档',
};

const repairTypeLabels: Record<string, string> = {
  electrical: '电路',
  plumbing: '水管',
  structure: '土建',
  appliance: '家电',
  other: '其他',
};

const billTypeLabels: Record<string, string> = {
  property_fee: '物业费',
  water_fee: '水费',
  electric_fee: '电费',
  parking_fee: '停车费',
};

export default function OwnerHouses() {
  const { user } = useAuthStore();
  const ownerId = user?.ownerId;

  const [loading, setLoading] = useState(true);
  const [houses, setHouses] = useState<House[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [detailModal, setDetailModal] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [houseRepairs, setHouseRepairs] = useState<RepairOrder[]>([]);
  const [houseBills, setHouseBills] = useState<Bill[]>([]);
  const [houseOwner, setHouseOwner] = useState<Owner | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'repairs' | 'bills'>('info');

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
      const res = await api.houses.list({ ownerId, pageSize: 100 });
      if (res.success && res.data) {
        setHouses(res.data.data as House[]);
      }
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadHouseDetail = async (house: House) => {
    setDetailLoading(true);
    try {
      const [repairsRes, billsRes, ownerRes] = await Promise.all([
        api.repair.list({ houseId: house.id, pageSize: 20 }),
        api.billing.list({ houseId: house.id, pageSize: 20 }),
        house.ownerId ? api.owners.get(house.ownerId) : Promise.resolve(null),
      ]);

      setHouseRepairs((repairsRes.data?.data as RepairOrder[]) || []);
      setHouseBills((billsRes.data?.data as Bill[]) || []);
      setHouseOwner((ownerRes?.data as Owner) || null);
    } catch (error) {
      showToast('error', '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetail = (house: House) => {
    setSelectedHouse(house);
    setActiveTab('info');
    setDetailModal(true);
    loadHouseDetail(house);
  };

  const calculatePropertyFee = (area: number) => {
    return (area * 2.5).toFixed(2);
  };

  useEffect(() => {
    loadData();
  }, [ownerId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loading size="lg" text="加载中..." />
        </div>
      </Layout>
    );
  }

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
              <FileText className="w-4 h-4" />
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
            <h1 className="text-2xl font-bold text-gray-900">我的房产</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {houses.length} 套房产
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>

        {houses.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
            <Empty />
            <p className="text-gray-500 mt-4">暂无房产信息</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {houses.map((house) => (
              <div
                key={house.id}
                onClick={() => handleViewDetail(house)}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <StatusBadge status={house.status} />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {house.building}栋 {house.unit}单元 {house.roomNumber}室
                </h3>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span>{house.floor}层 · {house.area}㎡</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>{house.houseType}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">物业费</span>
                    <span className="text-sm font-semibold text-blue-600">
                      ¥{calculatePropertyFee(house.area)}/月
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-400">点击查看详情</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={detailModal}
        title="房产详情"
        size="lg"
        onClose={() => setDetailModal(false)}
      >
        {detailLoading ? (
          <div className="py-12">
            <Loading text="加载详情..." />
          </div>
        ) : selectedHouse ? (
          <div className="space-y-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setActiveTab('repairs')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'repairs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                报修记录 ({houseRepairs.length})
              </button>
              <button
                onClick={() => setActiveTab('bills')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'bills'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                账单记录 ({houseBills.length})
              </button>
            </div>

            {activeTab === 'info' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">楼栋</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedHouse.building}栋
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">单元</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedHouse.unit}单元
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">房号</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedHouse.roomNumber}室
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">楼层</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedHouse.floor}层
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">面积</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedHouse.area}㎡
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">户型</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedHouse.houseType}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">状态</p>
                    <div className="mt-1">
                      <StatusBadge status={selectedHouse.status} />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">物业费</p>
                    <p className="text-lg font-semibold text-blue-600 mt-1">
                      ¥{calculatePropertyFee(selectedHouse.area)}/月
                    </p>
                  </div>
                </div>

                {houseOwner && (
                  <div className="bg-blue-50 rounded-xl p-5">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      关联业主
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-blue-600">姓名</p>
                        <p className="text-sm font-medium text-blue-900 mt-1">
                          {houseOwner.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">电话</p>
                        <p className="text-sm font-medium text-blue-900 mt-1">
                          {houseOwner.phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">身份证号</p>
                        <p className="text-sm font-medium text-blue-900 mt-1">
                          {houseOwner.idCard}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">地址</p>
                        <p className="text-sm font-medium text-blue-900 mt-1">
                          {houseOwner.address}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedHouse.remark && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">备注</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedHouse.remark}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'repairs' && (
              <div className="space-y-3">
                {houseRepairs.length === 0 ? (
                  <div className="text-center py-8">
                    <Empty />
                    <p className="text-gray-500 mt-2">暂无报修记录</p>
                  </div>
                ) : (
                  houseRepairs.map((repair) => (
                    <div
                      key={repair.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {repair.title}
                          </span>
                          <StatusBadge status={repair.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {repair.orderNo}
                          </span>
                          <span>{repairTypeLabels[repair.type] || repair.type}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dayjs(repair.submitTime).format('YYYY-MM-DD')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'bills' && (
              <div className="space-y-3">
                {houseBills.length === 0 ? (
                  <div className="text-center py-8">
                    <Empty />
                    <p className="text-gray-500 mt-2">暂无账单记录</p>
                  </div>
                ) : (
                  houseBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {bill.title}
                          </span>
                          <StatusBadge status={bill.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Receipt className="w-3 h-3" />
                            {bill.billNo}
                          </span>
                          <span>{billTypeLabels[bill.type] || bill.type}</span>
                          <span>{bill.billingPeriod}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          ¥{bill.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}
