import { useState, useEffect } from 'react';
import {
  Car,
  MapPin,
  Users,
  FileText,
  AlertTriangle,
  Clock,
  Receipt,
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
import type { ParkingSpot, Bill, Owner } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const typeLabels: Record<string, string> = {
  underground: '地下车位',
  ground: '地面车位',
  mechanical: '机械车位',
};

const billTypeLabels: Record<string, string> = {
  property_fee: '物业费',
  water_fee: '水费',
  electric_fee: '电费',
  parking_fee: '停车费',
};

export default function OwnerParking() {
  const { user } = useAuthStore();
  const ownerId = user?.ownerId;

  const [loading, setLoading] = useState(true);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [detailModal, setDetailModal] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [spotBills, setSpotBills] = useState<Bill[]>([]);
  const [spotOwner, setSpotOwner] = useState<Owner | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'bills'>('info');

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
      const res = await api.parking.list({ ownerId, pageSize: 100 });
      if (res.success && res.data) {
        setParkingSpots(res.data.data as ParkingSpot[]);
      }
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSpotDetail = async (spot: ParkingSpot) => {
    setDetailLoading(true);
    try {
      const [billsRes, ownerRes] = await Promise.all([
        api.billing.list({ parkingSpotId: spot.id, pageSize: 20 }),
        spot.ownerId ? api.owners.get(spot.ownerId) : Promise.resolve(null),
      ]);

      setSpotBills((billsRes.data?.data as Bill[]) || []);
      setSpotOwner((ownerRes?.data as Owner) || null);
    } catch (error) {
      showToast('error', '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetail = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    setActiveTab('info');
    setDetailModal(true);
    loadSpotDetail(spot);
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
            <h1 className="text-2xl font-bold text-gray-900">我的车位</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {parkingSpots.length} 个车位
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

        {parkingSpots.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
            <Empty />
            <p className="text-gray-500 mt-4">暂无车位信息</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parkingSpots.map((spot) => (
              <div
                key={spot.id}
                onClick={() => handleViewDetail(spot)}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Car className="w-6 h-6 text-purple-600" />
                  </div>
                  <StatusBadge status={spot.status} />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                  {spot.spotNumber}
                </h3>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span>{spot.area}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Car className="w-4 h-4" />
                    <span>{typeLabels[spot.type] || spot.type}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">月租金</span>
                    <span className="text-sm font-semibold text-purple-600">
                      ¥{spot.monthlyFee.toLocaleString()}/月
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-400">点击查看详情</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={detailModal}
        title="车位详情"
        size="lg"
        onClose={() => setDetailModal(false)}
      >
        {detailLoading ? (
          <div className="py-12">
            <Loading text="加载详情..." />
          </div>
        ) : selectedSpot ? (
          <div className="space-y-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setActiveTab('bills')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'bills'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                停车费账单 ({spotBills.length})
              </button>
            </div>

            {activeTab === 'info' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">车位号</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedSpot.spotNumber}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">区域</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedSpot.area}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">类型</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {typeLabels[selectedSpot.type] || selectedSpot.type}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">状态</p>
                    <div className="mt-1">
                      <StatusBadge status={selectedSpot.status} />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 col-span-2">
                    <p className="text-sm text-gray-500">月租金</p>
                    <p className="text-lg font-semibold text-purple-600 mt-1">
                      ¥{selectedSpot.monthlyFee.toLocaleString()}/月
                    </p>
                  </div>
                </div>

                {spotOwner && (
                  <div className="bg-purple-50 rounded-xl p-5">
                    <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      关联业主
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-purple-600">姓名</p>
                        <p className="text-sm font-medium text-purple-900 mt-1">
                          {spotOwner.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600">电话</p>
                        <p className="text-sm font-medium text-purple-900 mt-1">
                          {spotOwner.phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600">身份证号</p>
                        <p className="text-sm font-medium text-purple-900 mt-1">
                          {spotOwner.idCard}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600">地址</p>
                        <p className="text-sm font-medium text-purple-900 mt-1">
                          {spotOwner.address}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedSpot.remark && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">备注</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedSpot.remark}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bills' && (
              <div className="space-y-3">
                {spotBills.length === 0 ? (
                  <div className="text-center py-8">
                    <Empty />
                    <p className="text-gray-500 mt-2">暂无账单记录</p>
                  </div>
                ) : (
                  spotBills.map((bill) => (
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
