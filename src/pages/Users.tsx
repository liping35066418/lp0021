import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Power,
  User,
  Users as UsersIcon,
  Shield,
  Building2,
  Home,
  Key,
  X,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '@/components/Layout';
import DataTable, { type Column, type Action } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FormItem, { Input, Select } from '@/components/FormItem';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loading from '@/components/Loading';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type { User as UserType, Owner } from '@/types';
import { cn } from '@/lib/utils';

interface FormData {
  username: string;
  password: string;
  name: string;
  role: 'super_admin' | 'property_staff' | 'owner';
  phone: string;
  email: string;
  ownerId: string;
  status: 'active' | 'inactive';
}

interface FormErrors {
  username?: string;
  password?: string;
  name?: string;
  phone?: string;
  email?: string;
}

interface PasswordFormData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordFormErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface Toast {
  show: boolean;
  type: 'success' | 'error';
  message: string;
}

interface Statistics {
  total: number;
  admin: number;
  staff: number;
  owner: number;
}

const initialFormData: FormData = {
  username: '',
  password: '',
  name: '',
  role: 'property_staff',
  phone: '',
  email: '',
  ownerId: '',
  status: 'active',
};

const initialPasswordFormData: PasswordFormData = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const roleOptions = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'property_staff', label: '物业人员' },
  { value: 'owner', label: '业主' },
];

const statusOptions = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '禁用' },
];

export default function Users() {
  const { isAdmin, user: currentUser } = useAuthStore();
  const isCurrentUserAdmin = isAdmin();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    admin: 0,
    staff: 0,
    owner: 0,
  });

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [passwordFormData, setPasswordFormData] = useState<PasswordFormData>(initialPasswordFormData);
  const [passwordFormErrors, setPasswordFormErrors] = useState<PasswordFormErrors>({});
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordUserName, setPasswordUserName] = useState<string>('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusUser, setStatusUser] = useState<UserType | null>(null);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [toast, setToast] = useState<Toast>({ show: false, type: 'success', message: '' });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const loadOwners = useCallback(async () => {
    try {
      const res = await api.owners.list({ pageSize: 1000 });
      if (res.success && res.data) {
        const responseData = res.data as { data?: unknown[]; total?: number } | unknown[];
        let ownerList: Owner[] = [];
        if (Array.isArray(responseData)) {
          ownerList = responseData as Owner[];
        } else if (responseData.data) {
          ownerList = responseData.data as Owner[];
        }
        setOwners(ownerList.filter((o) => o.status === 'active'));
      }
    } catch (error) {
      console.error('加载业主列表失败:', error);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize,
      };
      if (searchText) {
        params.search = searchText;
      }
      if (roleFilter !== 'all') {
        params.role = roleFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await api.users.list(params);
      if (res.success && res.data) {
        const responseData = res.data as { data?: unknown[]; total?: number } | unknown[];
        let userList: UserType[] = [];
        if (Array.isArray(responseData)) {
          userList = responseData as UserType[];
        } else if (responseData.data) {
          userList = responseData.data as UserType[];
        }
        setUsers(userList);
        setStatistics({
          total: userList.length,
          admin: userList.filter((u) => u.role === 'super_admin').length,
          staff: userList.filter((u) => u.role === 'property_staff').length,
          owner: userList.filter((u) => u.role === 'owner').length,
        });
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
      showToast('error', '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
    loadOwners();
  }, [loadUsers, loadOwners]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.username.trim()) {
      errors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      errors.username = '用户名至少3个字符';
    }

    if (!isEditMode && !formData.password) {
      errors.password = '请输入密码';
    } else if (!isEditMode && formData.password.length < 6) {
      errors.password = '密码至少6个字符';
    }

    if (!formData.name.trim()) {
      errors.name = '请输入姓名';
    }

    if (!formData.phone.trim()) {
      errors.phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      errors.phone = '手机号格式不正确';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '邮箱格式不正确';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const errors: PasswordFormErrors = {};

    if (!isCurrentUserAdmin && !passwordFormData.oldPassword) {
      errors.oldPassword = '请输入旧密码';
    }

    if (!passwordFormData.newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (passwordFormData.newPassword.length < 6) {
      errors.newPassword = '新密码至少6个字符';
    }

    if (!passwordFormData.confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      errors.confirmPassword = '两次密码输入不一致';
    }

    setPasswordFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData(initialFormData);
    setFormErrors({});
    setFormModalOpen(true);
  };

  const openEditModal = (user: UserType) => {
    setIsEditMode(true);
    setEditingId(user.id);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      phone: user.phone,
      email: user.email || '',
      ownerId: user.ownerId || '',
      status: user.status,
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const submitData = { ...formData };
      if (isEditMode && !submitData.password) {
        delete submitData.password;
      }
      if (submitData.role !== 'owner') {
        delete submitData.ownerId;
      }

      let res;
      if (isEditMode && editingId) {
        res = await api.users.update(editingId, submitData);
      } else {
        res = await api.users.create(submitData);
      }

      if (res.success) {
        showToast('success', isEditMode ? '编辑用户成功' : '新增用户成功');
        setFormModalOpen(false);
        loadUsers();
      } else {
        showToast('error', res.error || (isEditMode ? '编辑用户失败' : '新增用户失败'));
      }
    } catch (error) {
      console.error('提交表单失败:', error);
      showToast('error', isEditMode ? '编辑用户失败' : '新增用户失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openPasswordModal = (user: UserType) => {
    setPasswordUserId(user.id);
    setPasswordUserName(user.name);
    setPasswordFormData(initialPasswordFormData);
    setPasswordFormErrors({});
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm() || !passwordUserId) return;

    setPasswordSubmitting(true);
    try {
      const res = await api.users.changePassword(
        passwordUserId,
        passwordFormData.oldPassword,
        passwordFormData.newPassword
      );
      if (res.success) {
        showToast('success', '密码修改成功');
        setPasswordModalOpen(false);
      } else {
        showToast('error', res.error || '密码修改失败');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      showToast('error', '密码修改失败');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const openStatusDialog = (user: UserType) => {
    setStatusUser(user);
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    setNewStatus(nextStatus);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!statusUser) return;

    setUpdatingStatus(true);
    try {
      const res = await api.users.updateStatus(statusUser.id, newStatus);
      if (res.success) {
        showToast('success', '状态更新成功');
        setStatusDialogOpen(false);
        loadUsers();
      } else {
        showToast('error', res.error || '状态更新失败');
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      showToast('error', '状态更新失败');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDeleteDialog = (user: UserType) => {
    setDeletingId(user.id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setDeleting(true);
    try {
      const res = await api.users.remove(deletingId);
      if (res.success) {
        showToast('success', '删除用户成功');
        setDeleteDialogOpen(false);
        loadUsers();
      } else {
        showToast('error', res.error || '删除用户失败');
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      showToast('error', '删除用户失败');
    } finally {
      setDeleting(false);
    }
  };

  const renderRoleBadge = (role: string) => {
    const colorMap: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-700 border-red-200',
      property_staff: 'bg-blue-100 text-blue-700 border-blue-200',
      owner: 'bg-green-100 text-green-700 border-green-200',
    };
    const labelMap: Record<string, string> = {
      super_admin: '超级管理员',
      property_staff: '物业人员',
      owner: '业主',
    };
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
          colorMap[role] || 'bg-gray-100 text-gray-700 border-gray-200'
        )}
      >
        {labelMap[role] || role}
      </span>
    );
  };

  const getOwnerName = (ownerId?: string) => {
    if (!ownerId) return '-';
    const owner = owners.find((o) => o.id === ownerId);
    return owner ? owner.name : '-';
  };

  const columns: Column<UserType>[] = [
    {
      key: 'username',
      title: '用户名',
      dataIndex: 'username',
      sortable: true,
      width: '120px',
      render: (value) => (
        <span className="font-medium text-gray-900">{value as string}</span>
      ),
    },
    {
      key: 'name',
      title: '姓名',
      dataIndex: 'name',
      sortable: true,
      width: '100px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <User className="w-4 h-4 text-purple-600" />
          </div>
          <span className="font-medium text-gray-900">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'role',
      title: '角色',
      dataIndex: 'role',
      width: '100px',
      align: 'center',
      render: (value) => renderRoleBadge(value as string),
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
      key: 'ownerId',
      title: '关联业主',
      dataIndex: 'ownerId',
      width: '100px',
      render: (value) => getOwnerName(value as string),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: '80px',
      align: 'center',
      render: (value) => <StatusBadge status={value as 'active' | 'inactive'} />,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: '160px',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const actions: Action<UserType>[] = [
    {
      key: 'edit',
      label: '编辑',
      icon: <Edit className="w-3.5 h-3.5" />,
      onClick: openEditModal,
    },
    {
      key: 'password',
      label: '修改密码',
      icon: <Key className="w-3.5 h-3.5" />,
      onClick: openPasswordModal,
    },
    {
      key: 'status',
      label: '状态切换',
      icon: <Power className="w-3.5 h-3.5" />,
      onClick: openStatusDialog,
      hidden: (record) => currentUser?.id === record.id,
    },
    {
      key: 'delete',
      label: '删除',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: openDeleteDialog,
      danger: true,
      hidden: (record) => currentUser?.id === record.id,
    },
  ];

  const statCards = [
    {
      label: '总用户数',
      value: statistics.total,
      icon: <UsersIcon className="w-5 h-5" />,
      className: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      label: '超级管理员',
      value: statistics.admin,
      icon: <Shield className="w-5 h-5" />,
      className: 'bg-red-50 text-red-600',
      iconBg: 'bg-red-100',
    },
    {
      label: '物业人员',
      value: statistics.staff,
      icon: <Building2 className="w-5 h-5" />,
      className: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      label: '业主',
      value: statistics.owner,
      icon: <Home className="w-5 h-5" />,
      className: 'bg-green-50 text-green-600',
      iconBg: 'bg-green-100',
    },
  ];

  const ownerOptions = owners.map((o) => ({
    value: o.id,
    label: o.name,
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理系统用户信息</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-lg', stat.iconBg)}>
                  <span className={stat.className}>{stat.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索用户名、姓名、电话..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
                  className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {searchText && (
                  <button
                    onClick={() => {
                      setSearchText('');
                      setPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">角色：</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'super_admin', label: '超级管理员' },
                  { key: 'property_staff', label: '物业人员' },
                  { key: 'owner', label: '业主' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setRoleFilter(item.key);
                      setPage(1);
                    }}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      roleFilter === item.key
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">状态：</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'active', label: '启用' },
                  { key: 'inactive', label: '禁用' },
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

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ml-auto"
            >
              <Plus className="w-4 h-4" />
              新增用户
            </button>
          </div>
        </div>

        <DataTable<UserType>
          columns={columns}
          data={users}
          loading={loading}
          rowKey="id"
          pagination={true}
          pageSize={pageSize}
          showSearch={false}
          actions={actions}
          onAdd={openAddModal}
          addButtonText="新增用户"
        />

        <Modal
          open={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          title={isEditMode ? '编辑用户' : '新增用户'}
          description={isEditMode ? '修改用户信息' : '添加新的系统用户'}
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
              <FormItem label="用户名" name="username" required error={formErrors.username}>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="请输入用户名"
                  error={!!formErrors.username}
                  disabled={isEditMode}
                />
              </FormItem>
              {!isEditMode && (
                <FormItem label="密码" name="password" required error={formErrors.password}>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="请输入密码（至少6位）"
                    error={!!formErrors.password}
                  />
                </FormItem>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem label="姓名" name="name" required error={formErrors.name}>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入姓名"
                  error={!!formErrors.name}
                />
              </FormItem>
              <FormItem label="角色" name="role" required>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as FormData['role'] })}
                  options={roleOptions}
                />
              </FormItem>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem label="电话" name="phone" required error={formErrors.phone}>
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
            {formData.role === 'owner' && (
              <FormItem label="关联业主" name="ownerId">
                <Select
                  value={formData.ownerId}
                  onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                  options={[{ value: '', label: '请选择关联业主' }, ...ownerOptions]}
                />
              </FormItem>
            )}
            <FormItem label="状态" name="status" required>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData['status'] })}
                options={statusOptions}
              />
            </FormItem>
          </div>
        </Modal>

        <Modal
          open={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          title="修改密码"
          description={`修改 ${passwordUserName} 的登录密码`}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={passwordSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {passwordSubmitting && <Loading size="sm" />}
                确认修改
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {!isCurrentUserAdmin && (
              <FormItem label="旧密码" name="oldPassword" required error={passwordFormErrors.oldPassword}>
                <div className="relative">
                  <Input
                    type={showOldPassword ? 'text' : 'password'}
                    value={passwordFormData.oldPassword}
                    onChange={(e) => setPasswordFormData({ ...passwordFormData, oldPassword: e.target.value })}
                    placeholder="请输入旧密码"
                    error={!!passwordFormErrors.oldPassword}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormItem>
            )}
            <FormItem label="新密码" name="newPassword" required error={passwordFormErrors.newPassword}>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  placeholder="请输入新密码（至少6位）"
                  error={!!passwordFormErrors.newPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormItem>
            <FormItem label="确认新密码" name="confirmPassword" required error={passwordFormErrors.confirmPassword}>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  placeholder="请再次输入新密码"
                  error={!!passwordFormErrors.confirmPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormItem>
          </div>
        </Modal>

        <ConfirmDialog
          open={statusDialogOpen}
          onCancel={() => setStatusDialogOpen(false)}
          onConfirm={() => {
            void handleUpdateStatus();
          }}
          title="确认切换状态"
          description={`确定要将 ${statusUser?.name} 的状态切换为 ${newStatus === 'active' ? '启用' : '禁用'} 吗？`}
          type="info"
          confirmText="确认切换"
          loading={updatingStatus}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={() => {
            void handleDelete();
          }}
          title="确认删除"
          description="删除后该用户信息将无法恢复。确认要删除该用户吗？"
          type="danger"
          confirmText="确认删除"
          loading={deleting}
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
