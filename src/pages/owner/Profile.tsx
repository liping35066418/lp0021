import { useState, useEffect } from 'react';
import {
  User,
  User as UserIcon,
  Phone,
  Mail,
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import FormItem, { Input } from '@/components/FormItem';
import Loading, { Spinner } from '@/components/Loading';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import type { Owner } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface FormErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  property_staff: '物业工作人员',
  owner: '业主',
};

export default function OwnerProfile() {
  const { user, logout } = useAuthStore();
  const ownerId = user?.ownerId;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<Owner | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [passwordModal, setPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const res = await api.owners.get(ownerId);
      if (res.success && res.data) {
        setOwnerInfo(res.data as Owner);
      }
    } catch (error) {
      showToast('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerId]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.oldPassword) {
      errors.oldPassword = '请输入旧密码';
    }
    if (!formData.newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = '新密码长度至少6位';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validateForm() || !user) return;

    setSubmitting(true);
    try {
      const res = await api.users.changePassword(
        user.id,
        formData.oldPassword,
        formData.newPassword
      );

      if (res.success) {
        showToast('success', '密码修改成功');
        setPasswordModal(false);
        resetForm();
      } else {
        showToast('error', res.error || '修改失败');
      }
    } catch (error) {
      showToast('error', '修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setFormErrors({});
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
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
            <h1 className="text-2xl font-bold text-gray-900">个人中心</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理您的个人信息和账户设置
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
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <User className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white mt-4">
                  {user?.name}
                </h2>
                <p className="text-blue-100 mt-1">
                  {roleLabels[user?.role || ''] || user?.role}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">用户名</p>
                    <p className="text-sm font-medium text-gray-900">
                      {user?.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">电话</p>
                    <p className="text-sm font-medium text-gray-900">
                      {user?.phone || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">邮箱</p>
                    <p className="text-sm font-medium text-gray-900">
                      {user?.email || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">角色</p>
                    <p className="text-sm font-medium text-gray-900">
                      {roleLabels[user?.role || ''] || user?.role}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    resetForm();
                    setPasswordModal(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  修改密码
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                业主信息
              </h3>

              {ownerInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">姓名</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {ownerInfo.name}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">身份证号</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {ownerInfo.idCard}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">电话</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {ownerInfo.phone}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">邮箱</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {ownerInfo.email || '-'}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                    <p className="text-sm text-gray-500">地址</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {ownerInfo.address}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">状态</p>
                    <p className={`text-base font-semibold mt-1 ${
                      ownerInfo.status === 'active' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {ownerInfo.status === 'active' ? '正常' : '已归档'}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">注册时间</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {dayjs(ownerInfo.createdAt).format('YYYY-MM-DD')}
                    </p>
                  </div>

                  {ownerInfo.remark && (
                    <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                      <p className="text-sm text-gray-500">备注</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">
                        {ownerInfo.remark}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Loading text="加载业主信息..." />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={passwordModal}
        title="修改密码"
        size="md"
        onClose={() => setPasswordModal(false)}
        footer={
          <>
            <button
              onClick={() => setPasswordModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleChangePassword}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              确认修改
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormItem
            label="旧密码"
            required
            error={formErrors.oldPassword}
          >
            <div className="relative">
              <Input
                type={showOldPassword ? 'text' : 'password'}
                value={formData.oldPassword}
                onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
                placeholder="请输入旧密码"
                error={!!formErrors.oldPassword}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showOldPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormItem>

          <FormItem
            label="新密码"
            required
            error={formErrors.newPassword}
            hint="密码长度至少6位"
          >
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="请输入新密码"
                error={!!formErrors.newPassword}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormItem>

          <FormItem
            label="确认新密码"
            required
            error={formErrors.confirmPassword}
          >
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="请再次输入新密码"
                error={!!formErrors.confirmPassword}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormItem>
        </div>
      </Modal>
    </Layout>
  );
}
