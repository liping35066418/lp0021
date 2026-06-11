import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">权限不足</h2>
          <p className="text-gray-500 mb-6">您没有权限访问此页面</p>
          <p className="text-sm text-gray-400">当前角色：{user?.role || '未知'}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
