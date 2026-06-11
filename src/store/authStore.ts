import { create } from 'zustand';
import type { User, LoginRequest, UserRole } from '@/types';
import { api } from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  isStaff: () => boolean;
  isOwner: () => boolean;
}

type AuthStore = AuthState & AuthActions;

const getStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  return localStorage.getItem('token');
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  loading: false,
  error: null,

  login: async (credentials: LoginRequest): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const response = await api.auth.login(credentials);
      if (response.success && response.data) {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, token, isAuthenticated: true, loading: false });
        return true;
      } else {
        set({ error: response.error || '登录失败', loading: false });
        return false;
      }
    } catch (error) {
      set({ error: '网络错误', loading: false });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  fetchCurrentUser: async (): Promise<void> => {
    set({ loading: true });
    try {
      const response = await api.auth.me();
      if (response.success && response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        set({ user: response.data, loading: false });
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false, loading: false });
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  },

  clearError: (): void => {
    set({ error: null });
  },

  hasRole: (...roles: UserRole[]): boolean => {
    const { user } = get();
    if (!user) return false;
    return roles.includes(user.role);
  },

  isAdmin: (): boolean => {
    return get().hasRole('super_admin');
  },

  isStaff: (): boolean => {
    return get().hasRole('super_admin', 'property_staff');
  },

  isOwner: (): boolean => {
    return get().hasRole('owner');
  },
}));
