import { useState, useRef, useEffect, useMemo } from 'react';
import { Menu, Bell, LogOut, User, Settings, ChevronDown, Search, LayoutDashboard, Users, Building2, Car, Wrench, Receipt, HardHat, Shield, Home, X, Check, Lock, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import type { MenuItem } from '@/types';
import type { LucideIcon } from 'lucide-react';
import Modal from './Modal';
import FormItem, { Input } from './FormItem';

interface NavbarProps {
  onMenuClick: () => void;
}

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  Car,
  Wrench,
  Receipt,
  HardHat,
  Shield,
  Home,
  User,
};

const adminMenus: MenuItem[] = [
  { key: 'dashboard', label: '仪表盘', icon: 'LayoutDashboard', path: '/dashboard' },
  { key: 'owners', label: '业主管理', icon: 'Users', path: '/owners' },
  { key: 'houses', label: '房屋管理', icon: 'Building2', path: '/houses' },
  { key: 'parking', label: '车位管理', icon: 'Car', path: '/parking' },
  { key: 'repair', label: '报修管理', icon: 'Wrench', path: '/repair' },
  { key: 'billing', label: '缴费管理', icon: 'Receipt', path: '/billing' },
  { key: 'workers', label: '维修工管理', icon: 'HardHat', path: '/workers' },
  { key: 'users', label: '用户管理', icon: 'Shield', path: '/users' },
];

const ownerMenus: MenuItem[] = [
  { key: 'home', label: '首页', icon: 'Home', path: '/owner' },
  { key: 'my-houses', label: '我的房产', icon: 'Building2', path: '/owner/houses' },
  { key: 'my-parking', label: '我的车位', icon: 'Car', path: '/owner/parking' },
  { key: 'my-repair', label: '我的报修', icon: 'Wrench', path: '/owner/repair' },
  { key: 'my-bills', label: '我的缴费', icon: 'Receipt', path: '/owner/bills' },
  { key: 'profile', label: '个人中心', icon: 'User', path: '/owner/profile' },
];

interface Notification {
  id: string;
  title: string;
  content: string;
  time: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  { id: '1', title: '系统通知', content: '本月账单已生成，请及时缴费', time: '2小时前', read: false },
  { id: '2', title: '报修提醒', content: '您提交的报修单已分配维修工', time: '5小时前', read: false },
  { id: '3', title: '缴费成功', content: '您的物业费已缴纳成功', time: '1天前', read: true },
  { id: '4', title: '系统公告', content: '物业管理系统将于本周六凌晨进行维护', time: '2天前', read: true },
];

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout, isAdmin, isStaff, isOwner } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' });
  const [settingsForm, setSettingsForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({ show: false, type: 'success', message: '' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const menus = useMemo(() => {
    if (isAdmin() || isStaff()) {
      return adminMenus;
    } else if (isOwner()) {
      return ownerMenus;
    }
    return [];
  }, [isAdmin, isStaff, isOwner]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        email: (user as { email?: string }).email || '',
      });
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const results = menus.filter(menu =>
        menu.label.toLowerCase().includes(query) ||
        menu.key.toLowerCase().includes(query)
      );
      setSearchResults(results);
      setShowSearchResults(true);
      setSelectedIndex(-1);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery, menus]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 3000);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        navigateToMenu(searchResults[selectedIndex]);
      } else if (searchResults.length > 0) {
        navigateToMenu(searchResults[0]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev =>
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSearchResults(false);
    }
  };

  const navigateToMenu = (menu: MenuItem) => {
    navigate(menu.path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleProfileSubmit = () => {
    showToast('success', '个人信息修改成功');
    setShowProfileModal(false);
  };

  const handleSettingsSubmit = () => {
    if (settingsForm.newPassword !== settingsForm.confirmPassword) {
      showToast('error', '两次输入的密码不一致');
      return;
    }
    if (settingsForm.newPassword.length < 6) {
      showToast('error', '密码长度不能少于6位');
      return;
    }
    showToast('success', '密码修改成功');
    setShowSettingsModal(false);
    setSettingsForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
  };

  const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour < 6) return '凌晨好';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '深夜好';
  };

  const getRoleLabel = () => {
    if (!user) return '';
    switch (user.role) {
      case 'super_admin':
        return '超级管理员';
      case 'property_staff':
        return '物业工作人员';
      case 'owner':
        return '业主';
      default:
        return '';
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
        {toast.show && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right">
            <div
              className={cn(
                'px-4 py-3 rounded-lg shadow-lg text-sm font-medium border',
                toast.type === 'success'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              )}
            >
              {toast.message}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 md:hidden transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索功能、菜单..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                className="w-80 pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
              />
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 max-h-80 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((menu, index) => {
                      const Icon = iconMap[menu.icon] || LayoutDashboard;
                      return (
                        <button
                          key={menu.key}
                          type="button"
                          onClick={() => navigateToMenu(menu)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            index === selectedIndex
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm">{menu.label}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      没有找到相关功能
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden sm:block">
            <p className="text-sm text-gray-500">
              {getGreeting()}，<span className="font-medium text-gray-700">{user?.name}</span>
            </p>
            <p className="text-xs text-gray-400">
              {dayjs().format('YYYY年MM月DD日 dddd')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">通知中心</h3>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      全部已读
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'w-full px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors',
                          !notification.read && 'bg-blue-50/30'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                              notification.read ? 'bg-transparent' : 'bg-blue-500'
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                                  新
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                              {notification.content}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      暂无通知
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-white">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs text-gray-500">{getRoleLabel()}</p>
              </div>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-gray-400 transition-transform duration-200',
                  dropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.phone}</p>
                  <p className="text-xs text-gray-400 mt-1">{getRoleLabel()}</p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileModal(true);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    个人信息
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(true);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    账号设置
                  </button>
                </div>

                <div className="border-t border-gray-100 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <Modal
        open={showProfileModal}
        title="个人信息"
        size="md"
        onClose={() => setShowProfileModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleProfileSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              保存修改
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-2xl font-semibold text-white">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{getRoleLabel()}</p>
              <p className="text-xs text-gray-400 mt-1">
                账号：{user?.username}
              </p>
            </div>
          </div>

          <FormItem label="姓名">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="pl-9"
                placeholder="请输入姓名"
              />
            </div>
          </FormItem>

          <FormItem label="手机号">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="pl-9"
                placeholder="请输入手机号"
              />
            </div>
          </FormItem>

          <FormItem label="邮箱">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="pl-9"
                placeholder="请输入邮箱"
              />
            </div>
          </FormItem>
        </div>
      </Modal>

      <Modal
        open={showSettingsModal}
        title="账号设置"
        size="md"
        onClose={() => setShowSettingsModal(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSettingsSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              确认修改
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-700">
              <Lock className="w-4 h-4 inline mr-1" />
              修改密码后，下次登录需要使用新密码
            </p>
          </div>

          <FormItem label="当前密码">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                value={settingsForm.oldPassword}
                onChange={(e) => setSettingsForm({ ...settingsForm, oldPassword: e.target.value })}
                className="pl-9"
                placeholder="请输入当前密码"
              />
            </div>
          </FormItem>

          <FormItem label="新密码">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                value={settingsForm.newPassword}
                onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                className="pl-9"
                placeholder="请输入新密码（至少6位）"
              />
            </div>
          </FormItem>

          <FormItem label="确认新密码">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                value={settingsForm.confirmPassword}
                onChange={(e) => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                className="pl-9"
                placeholder="请再次输入新密码"
              />
            </div>
          </FormItem>
        </div>
      </Modal>
    </>
  );
}
