import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from './ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Owners from '@/pages/Owners';
import Houses from '@/pages/Houses';
import Parking from '@/pages/Parking';
import Repair from '@/pages/Repair';
import Billing from '@/pages/Billing';
import Workers from '@/pages/Workers';
import Users from '@/pages/Users';
import OwnerIndex from '@/pages/owner/Index';
import OwnerHouses from '@/pages/owner/Houses';
import OwnerParking from '@/pages/owner/Parking';
import OwnerRepair from '@/pages/owner/Repair';
import OwnerBills from '@/pages/owner/Bills';
import OwnerProfile from '@/pages/owner/Profile';

function RootRedirect() {
  const { isAuthenticated, isStaff, isOwner } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isStaff()) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isOwner()) {
    return <Navigate to="/owner" replace />;
  }

  return <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute roles={['super_admin', 'property_staff']}>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owners',
    element: (
      <ProtectedRoute roles={['super_admin', 'property_staff']}>
        <Owners />
      </ProtectedRoute>
    ),
  },
  {
    path: '/houses',
    element: (
      <ProtectedRoute roles={['super_admin', 'property_staff']}>
        <Houses />
      </ProtectedRoute>
    ),
  },
  {
    path: '/parking',
    element: (
      <ProtectedRoute roles={['super_admin', 'property_staff']}>
        <Parking />
      </ProtectedRoute>
    ),
  },
  {
    path: '/repair',
    element: (
      <ProtectedRoute roles={['super_admin', 'property_staff']}>
        <Repair />
      </ProtectedRoute>
    ),
  },
  {
    path: '/billing',
    element: (
      <ProtectedRoute roles={['super_admin', 'property_staff']}>
        <Billing />
      </ProtectedRoute>
    ),
  },
  {
    path: '/workers',
    element: (
      <ProtectedRoute roles={['super_admin']}>
        <Workers />
      </ProtectedRoute>
    ),
  },
  {
    path: '/users',
    element: (
      <ProtectedRoute roles={['super_admin']}>
        <Users />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner',
    element: (
      <ProtectedRoute roles={['owner']}>
        <OwnerIndex />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/houses',
    element: (
      <ProtectedRoute roles={['owner']}>
        <OwnerHouses />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/parking',
    element: (
      <ProtectedRoute roles={['owner']}>
        <OwnerParking />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/repair',
    element: (
      <ProtectedRoute roles={['owner']}>
        <OwnerRepair />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/bills',
    element: (
      <ProtectedRoute roles={['owner']}>
        <OwnerBills />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner/profile',
    element: (
      <ProtectedRoute roles={['owner']}>
        <OwnerProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
