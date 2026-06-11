import { NavLink, useLocation } from 'react-router-dom';
import {
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
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { MenuItem } from '@/types';
import type { LucideIcon } from 'lucide-react';

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

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { isAdmin, isStaff, isOwner, user } = useAuthStore();
  const location = useLocation();

  let menus: MenuItem[] = [];
  if (isAdmin() || isStaff()) {
    menus = adminMenus;
  } else if (isOwner()) {
    menus = ownerMenus;
  }

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/owner') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full')}>
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold">物业管理系统</span>
              <span className="text-xs text-gray-400">Property Management</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors md:block hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onMobileClose}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors md:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {user && !collapsed && (
        <div className="mx-4 my-4 p-4 bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold">{user.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {user.role === 'super_admin'
                  ? '超级管理员'
                  : user.role === 'property_staff'
                  ? '物业工作人员'
                  : '业主'}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menus.map((menu) => {
            const Icon = iconMap[menu.icon] || LayoutDashboard;
            const active = isActive(menu.path);
            return (
              <li key={menu.key}>
                <NavLink
                  to={menu.path}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                    collapsed && 'justify-center'
                  )}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', active && 'text-white')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-sm font-medium">{menu.label}</span>
                      {active && <ChevronRight className="w-4 h-4" />}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-gray-800">
          <div className="p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl">
            <p className="text-xs text-gray-400">版本</p>
            <p className="text-sm font-medium text-white">v1.0.0</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen bg-gray-900 transition-all duration-300 flex-shrink-0',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {SidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-gray-900 shadow-2xl animate-in slide-in-from-left duration-300">
            {SidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
