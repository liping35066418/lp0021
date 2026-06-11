import { useState, useEffect } from 'react';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Search,
  FileText,
  CreditCard,
  Eye,
  RefreshCw,
  XCircle,
  Bell,
  Download,
  Calendar,
  ChevronRight,
  Home,
  Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type {
  Bill,
  BillStatus,
  BillType,
  PaymentRecord,
  Owner,
} from '@/types';
import DataTable, { Column, Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import FormItem, { Input, TextArea, Select } from '@/components/FormItem';
import Loading, { Spinner } from '@/components/Loading';

const statusLabels: Record<BillStatus, string> = {
  unpaid: '待支付',
  paid: '已支付',
  overdue: '已逾期',
  cancelled: '已取消',
  refunded: '已退款',
};

const statusColors: Record<BillStatus, string> = {
  unpaid: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  refunded: 'bg-purple-100 text-purple-700 border-purple-200',
};

const typeLabels: Record<BillType, string> = {
  property_fee: '物业费',
  water_fee: '水费',
  electric_fee: '电费',
  parking_fee: '停车费',
};

const typeColors: Record<BillType, string> = {
  property_fee: 'bg-blue-100 text-blue-700 border-blue-200',
  water_fee: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  electric_fee: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  parking_fee: 'bg-green-100 text-green-700 border-green-200',
};

interface BillStatistics {
  unpaid: number;
  overdue: number;
  paid: number;
  monthlyIncome: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

type TabKey = 'bills' | 'payments';

export default function Billing() {
  const [activeTab, setActiveTab] = useState<TabKey>('bills');
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<BillStatistics | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [billSearch, setBillSearch] = useState('');
  const [billTypeFilter, setBillTypeFilter] = useState<string>('');
  const [billStatusFilter, setBillStatusFilter] = useState<string>('');
  const [billPeriodFilter, setBillPeriodFilter] = useState('');
  const [billOwnerFilter, setBillOwnerFilter] = useState('');

  const [paymentOwnerFilter, setPaymentOwnerFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [paymentDateStart, setPaymentDateStart] = useState('');
  const [paymentDateEnd, setPaymentDateEnd] = useState('');

  const [detailModal, setDetailModal] = useState(false);
  const [generateModal, setGenerateModal] = useState(false);
  const [recalcModal, setRecalcModal] = useState(false);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    type: 'warning' as 'danger' | 'warning' | 'info' | 'success',
    onConfirm: () => {},
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const [statsRes, billsRes, ownersRes] = await Promise.all([
        api.billing.statistics(),
        api.billing.list(),
        api.owners.list(),
      ]);

      if (statsRes.success && statsRes.data) {
        const statsData = statsRes.data as any;
        if (statsData.byStatus) {
          setStatistics({
            unpaid: statsData.byStatus.unpaid?.count || 0,
            overdue: statsData.byStatus.overdue?.count || 0,
            paid: statsData.byStatus.paid?.count || 0,
            monthlyIncome: statsData.byMonth?.[Object.keys(statsData.byMonth)[0]]?.paid || 0,
          });
        } else {
          setStatistics(statsRes.data as BillStatistics);
        }
      }
      if (billsRes.success && billsRes.data) {
        const billsData = billsRes.data as unknown as { data: Bill[] } | Bill[];
        setBills(Array.isArray(billsData) ? billsData : billsData.data);
      }
      if (ownersRes.success && ownersRes.data) {
        const ownersData = ownersRes.data as unknown as { data: Owner[] } | Owner[];
        setOwners(Array.isArray(ownersData) ? ownersData : ownersData.data);
      }
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.billing.payments();
      if (res.success && res.data) {
        const paymentsData = res.data as unknown as { data: PaymentRecord[]; records: PaymentRecord[] } | PaymentRecord[];
        if (Array.isArray(paymentsData)) {
          setPayments(paymentsData);
        } else if (paymentsData.records) {
          setPayments(paymentsData.records);
        } else if (paymentsData.data) {
          setPayments(paymentsData.data);
        }
      }
    } catch (error) {
      showToast('error', '加载缴费记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bills') {
      fetchBills();
    } else {
      fetchPayments();
      if (owners.length === 0) {
        api.owners.list().then((res) => {
          if (res.success && res.data) {
            const ownersData = res.data as unknown as { data: Owner[] } | Owner[];
            setOwners(Array.isArray(ownersData) ? ownersData : ownersData.data);
          }
        });
      }
    }
  }, [activeTab]);

  const filteredBills = bills.filter((bill) => {
    if (billSearch) {
      const searchLower = billSearch.toLowerCase();
      const matchNo = bill.billNo.toLowerCase().includes(searchLower);
      const matchTitle = bill.title.toLowerCase().includes(searchLower);
      if (!matchNo && !matchTitle) return false;
    }
    if (billTypeFilter && bill.type !== billTypeFilter) return false;
    if (billStatusFilter && bill.status !== billStatusFilter) return false;
    if (billPeriodFilter && bill.billingPeriod !== billPeriodFilter) return false;
    if (billOwnerFilter && bill.ownerId !== billOwnerFilter) return false;
    return true;
  });

  const filteredPayments = payments.filter((payment) => {
    if (paymentOwnerFilter && payment.ownerId !== paymentOwnerFilter) return false;
    if (paymentMethodFilter && payment.paymentMethod !== paymentMethodFilter) return false;
    if (paymentDateStart) {
      const paymentDate = new Date(payment.createdAt);
      if (paymentDate < new Date(paymentDateStart)) return false;
    }
    if (paymentDateEnd) {
      const paymentDate = new Date(payment.createdAt);
      const endDate = new Date(paymentDateEnd);
      endDate.setHours(23, 59, 59);
      if (paymentDate > endDate) return false;
    }
    return true;
  });

  const handleBillDetail = (bill: Bill) => {
    setSelectedBill(bill);
    setDetailModal(true);
  };

  const handlePaymentDetail = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setDetailModal(true);
  };

  const handleGenerateMonthly = () => {
    setGenerateModal(true);
  };

  const submitGenerateMonthly = async () => {
    setGenerating(true);
    try {
      const res = await api.billing.generateMonthly();
      if (res.success) {
        showToast('success', '月度账单生成成功');
        setGenerateModal(false);
        fetchBills();
      } else {
        showToast('error', res.error || '生成失败');
      }
    } catch (error) {
      showToast('error', '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleRecalculate = (bill: Bill) => {
    setSelectedBill(bill);
    setRecalcModal(true);
  };

  const submitRecalculate = async () => {
    if (!selectedBill) return;
    setRecalculating(true);
    try {
      const res = await api.billing.recalculate(selectedBill.id);
      if (res.success) {
        showToast('success', '账单重算成功');
        setRecalcModal(false);
        fetchBills();
      } else {
        showToast('error', res.error || '重算失败');
      }
    } catch (error) {
      showToast('error', '重算失败');
    } finally {
      setRecalculating(false);
    }
  };

  const handleCancel = (bill: Bill) => {
    setConfirmDialog({
      open: true,
      title: '确认取消账单',
      description: `确定要取消账单 "${bill.title}" 吗？`,
      type: 'danger',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const res = await api.billing.cancel(bill.id);
          if (res.success) {
            showToast('success', '账单已取消');
            fetchBills();
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

  const handleRemind = (bill: Bill) => {
    setConfirmDialog({
      open: true,
      title: '确认催收',
      description: `确定要对账单 "${bill.title}" 发送催收提醒吗？`,
      type: 'warning',
      onConfirm: async () => {
        setReminding(true);
        try {
          const res = await api.billing.remind({ billIds: [bill.id] });
          if (res.success) {
            showToast('success', '催收提醒已发送');
            fetchBills();
          } else {
            showToast('error', res.error || '操作失败');
          }
        } catch (error) {
          showToast('error', '操作失败');
        } finally {
          setReminding(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleBatchRemind = () => {
    const overdueBills = filteredBills.filter((b) => b.status === 'unpaid' || b.status === 'overdue');
    if (overdueBills.length === 0) {
      showToast('error', '没有需要催收的账单');
      return;
    }
    setConfirmDialog({
      open: true,
      title: '批量催收',
      description: `确定要对 ${overdueBills.length} 条待支付/已逾期账单发送催收提醒吗？`,
      type: 'warning',
      onConfirm: async () => {
        setReminding(true);
        try {
          const res = await api.billing.remind();
          if (res.success) {
            showToast('success', '批量催收提醒已发送');
            fetchBills();
          } else {
            showToast('error', res.error || '操作失败');
          }
        } catch (error) {
          showToast('error', '操作失败');
        } finally {
          setReminding(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.billing.exportPayments({
        ownerId: paymentOwnerFilter || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        startDate: paymentDateStart || undefined,
        endDate: paymentDateEnd || undefined,
      });
      if (res.success) {
        showToast('success', '导出成功');
      } else {
        showToast('error', res.error || '导出失败');
      }
    } catch (error) {
      showToast('error', '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const billColumns: Column<Bill>[] = [
    {
      key: 'billNo',
      title: '账单号',
      dataIndex: 'billNo',
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
      width: '100px',
      render: (value) => {
        const t = value as BillType;
        return (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
              typeColors[t]
            )}
          >
            {typeLabels[t]}
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
      key: 'amount',
      title: '金额(元)',
      dataIndex: 'amount',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="text-sm font-medium text-gray-900">¥{Number(value).toFixed(2)}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      render: (value) => {
        const s = value as BillStatus;
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
      key: 'billingPeriod',
      title: '账期',
      dataIndex: 'billingPeriod',
      width: '100px',
    },
    {
      key: 'dueDate',
      title: '到期日',
      dataIndex: 'dueDate',
      width: '120px',
      render: (value) => new Date(value as string).toLocaleDateString('zh-CN'),
    },
    {
      key: 'reminderCount',
      title: '催收次数',
      dataIndex: 'reminderCount',
      width: '80px',
      align: 'center',
      render: (value) => <span className="text-sm text-gray-700">{String(value)}</span>,
    },
  ];

  const billActions: Action<Bill>[] = [
    { key: 'detail', label: '详情', icon: <Eye className="w-3 h-3" />, onClick: handleBillDetail },
    {
      key: 'recalculate',
      label: '重算',
      icon: <RefreshCw className="w-3 h-3" />,
      onClick: handleRecalculate,
      hidden: (record) => record.status !== 'unpaid',
    },
    {
      key: 'cancel',
      label: '取消',
      icon: <XCircle className="w-3 h-3" />,
      onClick: handleCancel,
      danger: true,
      hidden: (record) => record.status !== 'unpaid',
    },
    {
      key: 'remind',
      label: '催收',
      icon: <Bell className="w-3 h-3" />,
      onClick: handleRemind,
      hidden: (record) => !['unpaid', 'overdue'].includes(record.status),
    },
  ];

  const paymentColumns: Column<PaymentRecord>[] = [
    {
      key: 'recordNo',
      title: '记录号',
      dataIndex: 'recordNo',
      width: '140px',
    },
    {
      key: 'owner',
      title: '业主',
      dataIndex: 'owner',
      width: '100px',
      render: (_, record) => {
        const owner = owners.find((o) => o.id === record.ownerId);
        return owner?.name || '-';
      },
    },
    {
      key: 'amount',
      title: '金额(元)',
      dataIndex: 'amount',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="text-sm font-medium text-green-600">¥{Number(value).toFixed(2)}</span>
      ),
    },
    {
      key: 'paymentMethod',
      title: '支付方式',
      dataIndex: 'paymentMethod',
      width: '100px',
      render: (value) => {
        const methods: Record<string, string> = {
          wechat: '微信支付',
          alipay: '支付宝',
          bank: '银行转账',
          cash: '现金',
        };
        return <span className="text-sm text-gray-700">{methods[value as string] || String(value)}</span>;
      },
    },
    {
      key: 'billCount',
      title: '包含账单数',
      dataIndex: 'billIds',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className="text-sm text-gray-700">{(value as string[]).length} 条</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      render: (value) => (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
            value === 'success'
              ? 'bg-green-100 text-green-700 border-green-200'
              : value === 'failed'
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-yellow-100 text-yellow-700 border-yellow-200'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
          {value === 'success' ? '成功' : value === 'failed' ? '失败' : '处理中'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: '操作时间',
      dataIndex: 'createdAt',
      width: '160px',
      render: (value) => new Date(value as string).toLocaleString('zh-CN'),
    },
  ];

  const paymentActions: Action<PaymentRecord>[] = [
    { key: 'detail', label: '详情', icon: <Eye className="w-3 h-3" />, onClick: handlePaymentDetail },
  ];

  const billingPeriods = Array.from(new Set(bills.map((b) => b.billingPeriod))).sort();

  const paymentMethods = Array.from(new Set(payments.map((p) => p.paymentMethod)));

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
        <h1 className="text-2xl font-bold text-gray-900">缴费管理</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={cn(
              'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'bills'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <FileText className="w-4 h-4" />
            账单管理
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={cn(
              'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'payments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <CreditCard className="w-4 h-4" />
            缴费记录
          </button>
        </div>

        {activeTab === 'bills' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-yellow-100">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">待支付</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics?.unpaid || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
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
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">已支付</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics?.paid || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">本月收入</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ¥{(statistics?.monthlyIncome || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <FormItem label="搜索">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="账单号/标题"
                        value={billSearch}
                        onChange={(e) => setBillSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </FormItem>
                </div>
                <FormItem label="类型">
                  <Select
                    value={billTypeFilter}
                    onChange={(e) => setBillTypeFilter(e.target.value)}
                    options={[
                      { value: '', label: '全部' },
                      { value: 'property_fee', label: '物业费' },
                      { value: 'water_fee', label: '水费' },
                      { value: 'electric_fee', label: '电费' },
                      { value: 'parking_fee', label: '停车费' },
                    ]}
                    className="w-28"
                  />
                </FormItem>
                <FormItem label="状态">
                  <Select
                    value={billStatusFilter}
                    onChange={(e) => setBillStatusFilter(e.target.value)}
                    options={[
                      { value: '', label: '全部' },
                      { value: 'unpaid', label: '待支付' },
                      { value: 'paid', label: '已支付' },
                      { value: 'overdue', label: '已逾期' },
                      { value: 'cancelled', label: '已取消' },
                      { value: 'refunded', label: '已退款' },
                    ]}
                    className="w-28"
                  />
                </FormItem>
                <FormItem label="账期">
                  <Select
                    value={billPeriodFilter}
                    onChange={(e) => setBillPeriodFilter(e.target.value)}
                    options={[
                      { value: '', label: '全部' },
                      ...billingPeriods.map((p) => ({ value: p, label: p })),
                    ]}
                    className="w-28"
                  />
                </FormItem>
                <FormItem label="业主">
                  <Select
                    value={billOwnerFilter}
                    onChange={(e) => setBillOwnerFilter(e.target.value)}
                    options={[
                      { value: '', label: '全部' },
                      ...owners.map((o) => ({ value: o.id, label: o.name })),
                    ]}
                    className="w-28"
                  />
                </FormItem>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateMonthly}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    生成月度账单
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchRemind}
                    disabled={reminding}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
                  >
                    {reminding ? (
                      <Spinner size="sm" className="text-orange-600" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                    批量催收
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    导出
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-16">
                <Loading text="加载中..." />
              </div>
            ) : (
              <DataTable
                columns={billColumns}
                data={filteredBills}
                rowKey="id"
                showSearch={false}
                actions={billActions}
              />
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="p-6 space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex flex-wrap items-end gap-4">
                <FormItem label="业主">
                  <Select
                    value={paymentOwnerFilter}
                    onChange={(e) => setPaymentOwnerFilter(e.target.value)}
                    options={[
                      { value: '', label: '全部' },
                      ...owners.map((o) => ({ value: o.id, label: o.name })),
                    ]}
                    className="w-32"
                  />
                </FormItem>
                <FormItem label="支付方式">
                  <Select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    options={[
                      { value: '', label: '全部' },
                      ...paymentMethods.map((m) => ({
                        value: m,
                        label:
                          m === 'wechat'
                            ? '微信支付'
                            : m === 'alipay'
                            ? '支付宝'
                            : m === 'bank'
                            ? '银行转账'
                            : m === 'cash'
                            ? '现金'
                            : m,
                      })),
                    ]}
                    className="w-32"
                  />
                </FormItem>
                <FormItem label="开始日期">
                  <Input
                    type="date"
                    value={paymentDateStart}
                    onChange={(e) => setPaymentDateStart(e.target.value)}
                    className="w-40"
                  />
                </FormItem>
                <FormItem label="结束日期">
                  <Input
                    type="date"
                    value={paymentDateEnd}
                    onChange={(e) => setPaymentDateEnd(e.target.value)}
                    className="w-40"
                  />
                </FormItem>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
                >
                  {exporting ? (
                    <Spinner size="sm" className="text-gray-600" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  导出
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-16">
                <Loading text="加载中..." />
              </div>
            ) : (
              <DataTable
                columns={paymentColumns}
                data={filteredPayments}
                rowKey="id"
                showSearch={false}
                actions={paymentActions}
              />
            )}
          </div>
        )}
      </div>

      <Modal
        open={detailModal}
        title={activeTab === 'bills' ? '账单详情' : '缴费记录详情'}
        size="lg"
        onClose={() => setDetailModal(false)}
      >
        {activeTab === 'bills' && selectedBill && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">账单号</p>
                <p className="text-base font-medium text-gray-900">{selectedBill.billNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">标题</p>
                <p className="text-base font-medium text-gray-900">{selectedBill.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">类型</p>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    typeColors[selectedBill.type]
                  )}
                >
                  {typeLabels[selectedBill.type]}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">状态</p>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    statusColors[selectedBill.status]
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
                  {statusLabels[selectedBill.status]}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">金额</p>
                <p className="text-xl font-bold text-blue-600">¥{selectedBill.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">账期</p>
                <p className="text-base font-medium text-gray-900">{selectedBill.billingPeriod}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">到期日</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(selectedBill.dueDate).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">催收次数</p>
                <p className="text-base font-medium text-gray-900">
                  {selectedBill.reminderCount} 次
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">业主信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">姓名</p>
                  <p className="text-sm text-gray-700">{selectedBill.owner?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">电话</p>
                  <p className="text-sm text-gray-700">{selectedBill.owner?.phone || '-'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">关联信息</h3>
              {selectedBill.house && (
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <Home className="w-4 h-4 text-gray-400" />
                  <span>
                    {selectedBill.house.building}栋{selectedBill.house.unit}单元
                    {selectedBill.house.roomNumber}室
                  </span>
                </div>
              )}
              {selectedBill.parkingSpot && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Car className="w-4 h-4 text-gray-400" />
                  <span>
                    {selectedBill.parkingSpot.area}区 {selectedBill.parkingSpot.spotNumber} 号车位
                  </span>
                </div>
              )}
              {!selectedBill.house && !selectedBill.parkingSpot && (
                <p className="text-sm text-gray-500">无关联房屋或车位</p>
              )}
            </div>

            {selectedBill.status === 'paid' && selectedBill.paidDate && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">支付记录</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">支付金额</p>
                      <p className="text-sm font-medium text-green-600">
                        ¥{selectedBill.paidAmount?.toFixed(2) || selectedBill.amount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">支付时间</p>
                      <p className="text-sm text-gray-700">
                        {new Date(selectedBill.paidDate).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">支付方式</p>
                      <p className="text-sm text-gray-700">
                        {selectedBill.paymentMethod === 'wechat'
                          ? '微信支付'
                          : selectedBill.paymentMethod === 'alipay'
                          ? '支付宝'
                          : selectedBill.paymentMethod === 'bank'
                          ? '银行转账'
                          : selectedBill.paymentMethod === 'cash'
                          ? '现金'
                          : selectedBill.paymentMethod || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && selectedPayment && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">记录号</p>
                <p className="text-base font-medium text-gray-900">{selectedPayment.recordNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">业主</p>
                <p className="text-base font-medium text-gray-900">
                  {owners.find((o) => o.id === selectedPayment.ownerId)?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">金额</p>
                <p className="text-xl font-bold text-green-600">
                  ¥{selectedPayment.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">支付方式</p>
                <p className="text-base font-medium text-gray-900">
                  {selectedPayment.paymentMethod === 'wechat'
                    ? '微信支付'
                    : selectedPayment.paymentMethod === 'alipay'
                    ? '支付宝'
                    : selectedPayment.paymentMethod === 'bank'
                    ? '银行转账'
                    : selectedPayment.paymentMethod === 'cash'
                    ? '现金'
                    : selectedPayment.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">包含账单数</p>
                <p className="text-base font-medium text-gray-900">
                  {selectedPayment.billIds.length} 条
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">状态</p>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    selectedPayment.status === 'success'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : selectedPayment.status === 'failed'
                      ? 'bg-red-100 text-red-700 border-red-200'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
                  {selectedPayment.status === 'success'
                    ? '成功'
                    : selectedPayment.status === 'failed'
                    ? '失败'
                    : '处理中'}
                </span>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">操作时间</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(selectedPayment.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            {selectedPayment.transactionId && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">交易流水号</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg font-mono">
                  {selectedPayment.transactionId}
                </p>
              </div>
            )}

            {selectedPayment.remark && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">备注</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedPayment.remark}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={generateModal}
        title="生成月度账单"
        size="sm"
        onClose={() => setGenerateModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenerateModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitGenerateMonthly}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating && <Spinner size="sm" className="text-white" />}
              确认生成
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          确定要为本月所有业主生成月度账单吗？此操作将自动生成物业费、水费、电费、停车费等相关账单。
        </p>
      </Modal>

      <Modal
        open={recalcModal}
        title="重算账单"
        size="sm"
        onClose={() => setRecalcModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRecalcModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitRecalculate}
              disabled={recalculating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {recalculating && <Spinner size="sm" className="text-white" />}
              确认重算
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          确定要重新计算账单 "{selectedBill?.title}" 的金额吗？此操作将根据最新的收费标准重新计算账单金额。
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        loading={submitting || reminding}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
