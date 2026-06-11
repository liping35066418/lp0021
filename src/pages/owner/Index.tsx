import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Building2,
  Car,
  Wrench,
  Receipt,
  User,
  AlertTriangle,
  Clock,
  FileText,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import Loading from '@/components/Loading';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import type { RepairOrder, Bill, House, ParkingSpot } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

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

export default function OwnerIndex() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ownerId = user?.ownerId;

  const [loading, setLoading] = useState(true);
  const [pendingRepairCount, setPendingRepairCount] = useState(0);
  const [unpaidBillCount, setUnpaidBillCount] = useState(0);
  const [unpaidAmount, setUnpaidAmount] = useState(0);
  const [recentRepairs, setRecentRepairs] = useState<RepairOrder[]>([]);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
      const [
        housesRes,
        parkingRes,
        repairsRes,
        pendingRepairsRes,
        billsRes,
        unpaidBillsRes,
      ] = await Promise.all([
        api.houses.list({ ownerId, pageSize: 100 }),
        api.parking.list({ ownerId, pageSize: 100 }),
        api.repair.list({ ownerId, pageSize: 3 }),
        api.repair.list({ ownerId, status: 'pending', pageSize: 1 }),
        api.billing.list({ ownerId, pageSize: 3 }),
        api.billing.list({ ownerId, status: 'unpaid', pageSize: 100 }),
      ]);

      setHouses((housesRes.data?.data as House[]) || []);
      setParkingSpots((parkingRes.data?.data as ParkingSpot[]) || []);
      setRecentRepairs((repairsRes.data?.data as RepairOrder[]) || []);
      setPendingRepairCount(pendingRepairsRes.total || 0);
      setRecentBills((billsRes.data?.data as Bill[]) || []);

      const unpaidBills = (unpaidBillsRes.data?.data as Bill[]) || [];
      setUnpaidBillCount(unpaidBills.length);
      setUnpaidAmount(unpaidBills.reduce((sum, bill) => sum + bill.amount, 0));
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerId]);

  const quickEntries = [
    {
      key: 'repair',
      title: '我的报修',
      icon: <Wrench className="w-6 h-6" />,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      path: '/owner/repair',
      count: pendingRepairCount,
    },
    {
      key: 'bills',
      title: '我的缴费',
      icon: <Receipt className="w-6 h-6" />,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      path: '/owner/bills',
      count: unpaidBillCount,
    },
    {
      key: 'houses',
      title: '我的房产',
      icon: <Building2 className="w-6 h-6" />,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      path: '/owner/houses',
      count: houses.length,
    },
    {
      key: 'parking',
      title: '我的车位',
      icon: <Car className="w-6 h-6" />,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      path: '/owner/parking',
      count: parkingSpots.length,
    },
  ];

  const statCards = [
    {
      title: '待处理报修',
      value: pendingRepairCount,
      icon: <Wrench className="w-5 h-5" />,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: '未缴费账单',
      value: unpaidBillCount,
      icon: <Receipt className="w-5 h-5" />,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
    {
      title: '欠费金额',
      value: `¥${unpaidAmount.toLocaleString()}`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900">
              欢迎回来，{user?.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {dayjs().format('YYYY年MM月DD日')} · 祝您生活愉快
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新数据
          </button>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.name}</h2>
              <p className="text-blue-100 mt-1">
                {houses.length} 套房产 · {parkingSpots.length} 个车位
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickEntries.map((entry) => (
            <button
              key={entry.key}
              onClick={() => navigate(entry.path)}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div className={`${entry.bgColor} ${entry.textColor} p-3 rounded-lg`}>
                  {entry.icon}
                </div>
                {entry.count > 0 && (
                  <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {entry.count}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                  {entry.title}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.textColor}`}>
                    {card.value}
                  </p>
                </div>
                <div className={`${card.bgColor} ${card.textColor} p-2.5 rounded-lg`}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">最近报修</h3>
              </div>
              <button
                onClick={() => navigate('/owner/repair')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                查看全部 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {recentRepairs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无报修记录</p>
              ) : (
                recentRepairs.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {order.title}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {order.orderNo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {dayjs(order.submitTime).format('MM-DD HH:mm')}
                        </span>
                        <span>{repairTypeLabels[order.type] || order.type}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-gray-900">最近账单</h3>
              </div>
              <button
                onClick={() => navigate('/owner/bills')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                查看全部 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {recentBills.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无账单记录</p>
              ) : (
                recentBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
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
                          <FileText className="w-3 h-3" />
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
