import { useState, useEffect } from 'react';
import {
  Users,
  Home,
  Car,
  Wrench,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
  DollarSign,
  FileText,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import Loading from '@/components/Loading';
import { api } from '@/services/api';
import type { RepairOrder, Bill } from '@/types';

interface StatsData {
  ownerCount: number;
  houseCount: number;
  parkingCount: number;
  pendingRepairCount: number;
  overdueAmount: number;
  monthlyIncome: number;
}

interface RepairStats {
  status: Record<string, number>;
  type: Record<string, number>;
  priority: Record<string, number>;
  total: number;
}

interface BillingStats {
  byType: Record<string, { count: number; amount: number }>;
  byStatus: Record<string, { count: number; amount: number }>;
  byMonth: Record<string, { count: number; amount: number; paid: number; unpaid: number }>;
  summary: {
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    paidRate: number;
  };
}

interface OverdueBill {
  bills: Bill[];
  totalOverdueAmount: number;
  totalOverdueCount: number;
}

const billTypeLabels: Record<string, string> = {
  property_fee: '物业费',
  water_fee: '水费',
  electric_fee: '电费',
  parking_fee: '停车费',
};

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  assigned: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#6b7280',
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    ownerCount: 0,
    houseCount: 0,
    parkingCount: 0,
    pendingRepairCount: 0,
    overdueAmount: 0,
    monthlyIncome: 0,
  });
  const [repairStats, setRepairStats] = useState<RepairStats | null>(null);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [recentRepairs, setRecentRepairs] = useState<RepairOrder[]>([]);
  const [overdueBills, setOverdueBills] = useState<OverdueBill | null>(null);
  const [repairTrend, setRepairTrend] = useState<{ date: string; count: number }[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        ownersRes,
        housesRes,
        parkingRes,
        repairStatsRes,
        billingStatsRes,
        recentRepairsRes,
        overdueBillsRes,
      ] = await Promise.all([
        api.owners.list({ pageSize: 1 }),
        api.houses.list({ pageSize: 1 }),
        api.parking.list({ pageSize: 1 }),
        api.repair.statistics(),
        api.billing.statistics(),
        api.repair.list({ pageSize: 5 }),
        api.billing.overdueList({ pageSize: 5 }),
      ]);

      const pendingRes = await api.repair.list({ status: 'pending', pageSize: 1 });

      const trendData: { date: string; count: number }[] = [];
      const allRepairsRes = await api.repair.list({ pageSize: 100 });
      const allRepairs = (allRepairsRes.data?.data as RepairOrder[]) || [];

      for (let i = 6; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
        const count = allRepairs.filter((r) => dayjs(r.submitTime).format('YYYY-MM-DD') === date).length;
        trendData.push({ date: dayjs().subtract(i, 'day').format('MM-DD'), count });
      }
      setRepairTrend(trendData);

      setStats({
        ownerCount: ownersRes.total || 0,
        houseCount: housesRes.total || 0,
        parkingCount: parkingRes.total || 0,
        pendingRepairCount: pendingRes.total || 0,
        overdueAmount: (overdueBillsRes.data as OverdueBill)?.totalOverdueAmount || 0,
        monthlyIncome: (billingStatsRes.data as BillingStats)?.byMonth?.[dayjs().format('YYYY-MM')]?.paid || 0,
      });

      setRepairStats(repairStatsRes.data as RepairStats);
      setBillingStats(billingStatsRes.data as BillingStats);
      setRecentRepairs((recentRepairsRes.data?.data as RepairOrder[]) || []);
      setOverdueBills(overdueBillsRes.data as OverdueBill);
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const statCards = [
    {
      title: '业主总数',
      value: stats.ownerCount,
      icon: <Users className="w-6 h-6" />,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: '房屋总数',
      value: stats.houseCount,
      icon: <Home className="w-6 h-6" />,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: '车位总数',
      value: stats.parkingCount,
      icon: <Car className="w-6 h-6" />,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: '待处理工单',
      value: stats.pendingRepairCount,
      icon: <Wrench className="w-6 h-6" />,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: '欠费金额',
      value: `¥${stats.overdueAmount.toLocaleString()}`,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
    {
      title: '本月收入',
      value: `¥${stats.monthlyIncome.toLocaleString()}`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
  ];

  const maxTrendValue = Math.max(...repairTrend.map((t) => t.count), 1);

  const renderDonutChart = () => {
    if (!repairStats) return null;
    const statuses = Object.entries(repairStats.status);
    const total = statuses.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return <div className="text-gray-500 text-sm">暂无数据</div>;

    let currentAngle = 0;
    const segments = statuses.map(([status, count]) => {
      const angle = (count / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      const endAngle = currentAngle;
      return { status, count, startAngle, endAngle, color: statusColors[status] || '#6b7280' };
    });

    const createArc = (startAngle: number, endAngle: number) => {
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;
      const r = 50;
      const cx = 60;
      const cy = 60;
      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    };

    return (
      <div className="flex items-center gap-6">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="#f3f4f6" />
          {segments.map((seg, index) => (
            <path
              key={index}
              d={createArc(seg.startAngle, seg.endAngle)}
              fill={seg.color}
            />
          ))}
          <circle cx="60" cy="60" r="30" fill="white" />
          <text x="60" y="55" textAnchor="middle" className="text-lg font-bold" fill="#1f2937">
            {total}
          </text>
          <text x="60" y="72" textAnchor="middle" className="text-xs" fill="#6b7280">
            总工单
          </text>
        </svg>
        <div className="flex-1 space-y-2">
          {segments.map((seg, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-gray-600">
                  {({
                    pending: '待处理',
                    assigned: '已派单',
                    in_progress: '处理中',
                    completed: '已完成',
                    cancelled: '已取消',
                  } as Record<string, string>)[seg.status] || seg.status}
                </span>
              </div>
              <span className="font-medium text-gray-900">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFeeTypeChart = () => {
    if (!billingStats) return null;
    const types = Object.entries(billingStats.byType);
    const total = types.reduce((sum, [, data]) => sum + data.amount, 0);
    if (total === 0) return <div className="text-gray-500 text-sm">暂无数据</div>;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

    return (
      <div className="space-y-3">
        {types.map(([type, data], index) => {
          const percentage = total > 0 ? ((data.amount / total) * 100).toFixed(1) : '0';
          return (
            <div key={type}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="text-gray-600">{billTypeLabels[type] || type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">¥{data.amount.toLocaleString()}</span>
                  <span className="text-gray-500">({percentage}%)</span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: colors[index % colors.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">管理仪表盘</h1>
            <p className="text-sm text-gray-500 mt-1">
              {dayjs().format('YYYY年MM月DD日')} · 欢迎回来
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Activity className="w-4 h-4" />
            刷新数据
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.textColor}`}>
                    {card.value}
                  </p>
                </div>
                <div className={`${card.bgColor} ${card.textColor} p-3 rounded-lg`}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">近7日报修工单趋势</h3>
              </div>
            </div>
            <div className="h-64 flex items-end justify-between gap-2">
              {repairTrend.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-500 hover:from-blue-600 hover:to-blue-500"
                      style={{
                        height: `${(item.count / maxTrendValue) * 100}%`,
                        minHeight: item.count > 0 ? '8px' : '2px',
                      }}
                    />
                    {item.count > 0 && (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-600">
                        {item.count}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{item.date}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">工单状态分布</h3>
            </div>
            {renderDonutChart()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">费用类型占比</h3>
            </div>
            {renderFeeTypeChart()}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">最近报修工单</h3>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                查看全部 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {recentRepairs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无报修工单</p>
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
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">即将到期欠费账单</h3>
              {overdueBills && overdueBills.totalOverdueCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  {overdueBills.totalOverdueCount} 笔
                </span>
              )}
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {!overdueBills || overdueBills.bills.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无欠费账单</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      账单号
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      业主
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      类型
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      金额
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      到期日期
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overdueBills.bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {bill.billNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {bill.owner?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {billTypeLabels[bill.type] || bill.type}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-red-600">
                        ¥{bill.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dayjs(bill.dueDate).format('YYYY-MM-DD')}
                        </div>
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
      </div>
    </Layout>
  );
}
