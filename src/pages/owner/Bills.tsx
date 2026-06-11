import { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Eye,
  CreditCard,
  AlertTriangle,
  FileText,
  Clock,
  Calendar,
  CheckCircle,
  RefreshCw,
  Check,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import DataTable, { Column, Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import FormItem, { Select } from '@/components/FormItem';
import Loading, { Spinner } from '@/components/Loading';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import type { Bill, BillType, BillStatus, PaymentRecord } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const billTypeLabels: Record<BillType, string> = {
  property_fee: '物业费',
  water_fee: '水费',
  electric_fee: '电费',
  parking_fee: '停车费',
};

const paymentMethodOptions = [
  { value: 'wechat', label: '微信支付' },
  { value: 'alipay', label: '支付宝' },
  { value: 'bank', label: '银行卡' },
];

const paymentMethodLabels: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  bank: '银行卡',
};

const tabs = [
  { key: '', label: '全部' },
  { key: 'unpaid', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'overdue', label: '已逾期' },
];

export default function OwnerBills() {
  const { user } = useAuthStore();
  const ownerId = user?.ownerId;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [activeTab, setActiveTab] = useState('');

  const [detailModal, setDetailModal] = useState(false);
  const [payModal, setPayModal] = useState(false);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

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
      const res = await api.billing.list({ ownerId, status: activeTab || undefined, pageSize: 100 });
      if (res.success && res.data) {
        setBills(res.data.data as Bill[]);
      }
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerId, activeTab]);

  const statistics = useMemo(() => {
    const unpaid = bills.filter((b) => b.status === 'unpaid');
    const paid = bills.filter((b) => b.status === 'paid');
    const overdue = bills.filter((b) => b.status === 'overdue');

    return {
      unpaidAmount: unpaid.reduce((sum, b) => sum + b.amount, 0),
      paidAmount: paid.reduce((sum, b) => sum + b.amount, 0),
      overdueAmount: overdue.reduce((sum, b) => sum + b.amount, 0),
      unpaidCount: unpaid.length,
      paidCount: paid.length,
      overdueCount: overdue.length,
    };
  }, [bills]);

  const selectedBillsData = useMemo(() => {
    return bills.filter((b) => selectedBills.includes(b.id));
  }, [bills, selectedBills]);

  const totalAmount = useMemo(() => {
    return selectedBillsData.reduce((sum, b) => sum + b.amount, 0);
  }, [selectedBillsData]);

  const handleViewDetail = async (bill: Bill) => {
    setSelectedBill(bill);
    setDetailLoading(true);
    setDetailModal(true);

    try {
      const res = await api.billing.payments({ ownerId, billIds: [bill.id], pageSize: 20 });
      if (res.success && res.data) {
        setPaymentRecords(res.data.data as PaymentRecord[]);
      }
    } catch (error) {
      showToast('error', '加载支付记录失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePay = (bill?: Bill) => {
    if (bill) {
      setSelectedBills([bill.id]);
    } else {
      const unpaidBills = bills.filter((b) => b.status === 'unpaid' || b.status === 'overdue');
      setSelectedBills(unpaidBills.map((b) => b.id));
    }
    setPaymentMethod('');
    setPayModal(true);
  };

  const toggleBillSelection = (billId: string) => {
    setSelectedBills((prev) =>
      prev.includes(billId)
        ? prev.filter((id) => id !== billId)
        : [...prev, billId]
    );
  };

  const handleSelectAll = () => {
    const payableBills = bills.filter(
      (b) => b.status === 'unpaid' || b.status === 'overdue'
    );
    if (selectedBills.length === payableBills.length) {
      setSelectedBills([]);
    } else {
      setSelectedBills(payableBills.map((b) => b.id));
    }
  };

  const confirmPay = async () => {
    if (!paymentMethod) {
      showToast('error', '请选择支付方式');
      return;
    }
    if (selectedBills.length === 0) {
      showToast('error', '请选择要支付的账单');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.billing.pay(selectedBills, paymentMethod);
      if (res.success) {
        showToast('success', '支付成功');
        setPayModal(false);
        setSelectedBills([]);
        loadData();
      } else {
        showToast('error', res.error || '支付失败');
      }
    } catch (error) {
      showToast('error', '支付失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Bill>[] = [
    {
      key: 'select',
      title: '选择',
      dataIndex: 'id',
      width: '50px',
      align: 'center',
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedBills.includes(record.id)}
          onChange={() => toggleBillSelection(record.id)}
          disabled={record.status !== 'unpaid' && record.status !== 'overdue'}
          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ),
    },
    {
      key: 'billNo',
      title: '账单号',
      dataIndex: 'billNo',
      width: '140px',
      render: (value) => (
        <span className="font-mono text-sm text-gray-600">{String(value)}</span>
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
      render: (value) => String(billTypeLabels[value as BillType] || String(value)),
    },
    {
      key: 'amount',
      title: '金额',
      dataIndex: 'amount',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="font-semibold text-gray-900">
          ¥{(value as number).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '100px',
      render: (value) => <StatusBadge status={value as BillStatus} />,
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
      render: (value) => dayjs(value as string).format('YYYY-MM-DD'),
    },
  ];

  const actions: Action<Bill>[] = [
    {
      key: 'detail',
      label: '详情',
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: handleViewDetail,
    },
    {
      key: 'pay',
      label: '支付',
      icon: <CreditCard className="w-3.5 h-3.5" />,
      onClick: handlePay,
      hidden: (record) => record.status !== 'unpaid' && record.status !== 'overdue',
    },
  ];

  const statCards = [
    {
      title: '待支付金额',
      value: `¥${statistics.unpaidAmount.toLocaleString()}`,
      subValue: `${statistics.unpaidCount} 笔`,
      icon: <Clock className="w-5 h-5" />,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      borderColor: 'border-yellow-200',
    },
    {
      title: '已支付金额',
      value: `¥${statistics.paidAmount.toLocaleString()}`,
      subValue: `${statistics.paidCount} 笔`,
      icon: <CheckCircle className="w-5 h-5" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      borderColor: 'border-green-200',
    },
    {
      title: '已逾期金额',
      value: `¥${statistics.overdueAmount.toLocaleString()}`,
      subValue: `${statistics.overdueCount} 笔`,
      icon: <AlertTriangle className="w-5 h-5" />,
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      borderColor: 'border-red-200',
    },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900">我的缴费</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {bills.length} 条账单记录
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
            {bills.some((b) => b.status === 'unpaid' || b.status === 'overdue') && (
              <button
                onClick={() => handlePay()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                合并支付
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map((card, index) => (
            <div
              key={index}
              className={`bg-white rounded-xl p-5 shadow-sm border ${card.borderColor}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.textColor}`}>
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{card.subValue}</p>
                </div>
                <div className={`${card.bgColor} ${card.textColor} p-2.5 rounded-lg`}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex border-b border-gray-200 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-600'
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
              data={bills}
              loading={loading}
              rowKey="id"
              pagination={false}
              showSearch={false}
              actions={actions}
              emptyText="暂无账单记录"
            />
          </div>
        </div>
      </div>

      <Modal
        open={detailModal}
        title="账单详情"
        size="lg"
        onClose={() => setDetailModal(false)}
      >
        {detailLoading ? (
          <div className="py-12">
            <Loading text="加载详情..." />
          </div>
        ) : selectedBill ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">账单号</p>
                <p className="text-sm font-semibold text-gray-900 mt-1 font-mono">
                  {selectedBill.billNo}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">状态</p>
                <div className="mt-1">
                  <StatusBadge status={selectedBill.status} />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">类型</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {billTypeLabels[selectedBill.type] || selectedBill.type}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">金额</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                  ¥{selectedBill.amount.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">账期</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {selectedBill.billingPeriod}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">到期日</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {dayjs(selectedBill.dueDate).format('YYYY-MM-DD')}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">标题</p>
              <p className="text-base font-semibold text-gray-900 mt-1">
                {selectedBill.title}
              </p>
            </div>

            {selectedBill.paidAmount && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">已支付金额</p>
                <p className="text-lg font-bold text-green-700 mt-1">
                  ¥{selectedBill.paidAmount.toLocaleString()}
                </p>
                {selectedBill.paidDate && (
                  <p className="text-sm text-green-600 mt-1">
                    支付时间：{dayjs(selectedBill.paidDate).format('YYYY-MM-DD HH:mm')}
                  </p>
                )}
                {selectedBill.paymentMethod && (
                  <p className="text-sm text-green-600">
                    支付方式：{paymentMethodLabels[selectedBill.paymentMethod] || selectedBill.paymentMethod}
                  </p>
                )}
              </div>
            )}

            {selectedBill.remark && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">备注</p>
                <p className="text-sm text-gray-700 mt-1">
                  {selectedBill.remark}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">支付记录</h4>
              {paymentRecords.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">暂无支付记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          record.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {record.status === 'success' ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {record.recordNo}
                          </p>
                          <p className="text-xs text-gray-500">
                            {paymentMethodLabels[record.paymentMethod] || record.paymentMethod}
                            {' · '}
                            {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          ¥{record.amount.toLocaleString()}
                        </p>
                        <span className={`text-xs ${
                          record.status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {record.status === 'success' ? '支付成功' : '支付失败'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(selectedBill.status === 'unpaid' || selectedBill.status === 'overdue') && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setDetailModal(false);
                    handlePay(selectedBill);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  立即支付
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={payModal}
        title="支付账单"
        size="lg"
        onClose={() => setPayModal(false)}
        footer={
          <>
            <button
              onClick={() => setPayModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={confirmPay}
              disabled={submitting || selectedBills.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认支付 ¥{totalAmount.toLocaleString()}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="bg-emerald-50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">支付金额</p>
                <p className="text-3xl font-bold text-emerald-700 mt-1">
                  ¥{totalAmount.toLocaleString()}
                </p>
                <p className="text-sm text-emerald-600 mt-1">
                  共 {selectedBills.length} 笔账单
                </p>
              </div>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Receipt className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              选择支付方式 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {paymentMethodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    paymentMethod === option.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2 ${
                    paymentMethod === option.value ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    <CreditCard className={`w-5 h-5 ${
                      paymentMethod === option.value ? 'text-emerald-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <p className={`text-sm font-medium ${
                    paymentMethod === option.value ? 'text-emerald-700' : 'text-gray-700'
                  }`}>
                    {option.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                已选账单 ({selectedBills.length})
              </h4>
              <button
                onClick={() => {
                  const payableBills = bills.filter(
                    (b) => b.status === 'unpaid' || b.status === 'overdue'
                  );
                  setSelectedBills(payableBills.map((b) => b.id));
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700"
              >
                全选
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bills
                .filter((b) => b.status === 'unpaid' || b.status === 'overdue')
                .map((bill) => (
                  <div
                    key={bill.id}
                    onClick={() => toggleBillSelection(bill.id)}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedBills.includes(bill.id)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedBills.includes(bill.id)}
                        onChange={() => toggleBillSelection(bill.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {bill.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {bill.billNo} · {bill.billingPeriod}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        ¥{bill.amount.toLocaleString()}
                      </p>
                      <StatusBadge status={bill.status} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
