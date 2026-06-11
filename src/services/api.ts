import type { ApiResponse, PaginationParams, LoginRequest, LoginResponse } from '@/types';

const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

interface RequestOptions extends RequestInit {
  params?: Record<string, unknown>;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return { success: false, error: '未登录或登录已过期' };
    }

    const data = (await response.json()) as ApiResponse<T>;
    return data;
  } catch (error) {
    console.error('Request error:', error);
    return { success: false, error: '网络请求失败' };
  }
}

export const api = {
  auth: {
    login: (data: LoginRequest) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', { method: 'POST' }),
    me: () => request<LoginResponse['user']>('/auth/me'),
  },

  owners: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/owners', { params }),
    get: (id: string) => request(`/owners/${id}`),
    create: (data: unknown) =>
      request('/owners', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/owners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: string) =>
      request(`/owners/${id}/archive`, { method: 'PUT' }),
    getHouses: (id: string) => request(`/owners/${id}/houses`),
    getParking: (id: string) => request(`/owners/${id}/parking`),
    getBills: (id: string) => request(`/owners/${id}/bills`),
    batchImport: (data: unknown[]) =>
      request('/owners/batch-import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  houses: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/houses', { params }),
    get: (id: string) => request(`/houses/${id}`),
    create: (data: unknown) =>
      request('/houses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/houses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: string) =>
      request(`/houses/${id}/archive`, { method: 'PUT' }),
    batchImport: (data: unknown[]) =>
      request('/houses/batch-import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  parking: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/parking', { params }),
    get: (id: string) => request(`/parking/${id}`),
    create: (data: unknown) =>
      request('/parking', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/parking/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: string) =>
      request(`/parking/${id}/archive`, { method: 'PUT' }),
    batchImport: (data: unknown[]) =>
      request('/parking/batch-import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  repair: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/repair', { params }),
    get: (id: string) => request(`/repair/${id}`),
    create: (data: unknown) =>
      request('/repair', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id: string, workerId: string) =>
      request(`/repair/${id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ workerId }),
      }),
    start: (id: string) => request(`/repair/${id}/start`, { method: 'PUT' }),
    complete: (id: string, workerRemark: string) =>
      request(`/repair/${id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ workerRemark }),
      }),
    accept: (id: string, rating: number, comment?: string) =>
      request(`/repair/${id}/accept`, {
        method: 'PUT',
        body: JSON.stringify({ rating, comment }),
      }),
    cancel: (id: string, cancelReason: string) =>
      request(`/repair/${id}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ cancelReason }),
      }),
    reminder: (id: string) =>
      request(`/repair/${id}/reminder`, { method: 'PUT' }),
    checkOverdue: () => request('/repair/check-overdue', { method: 'GET' }),
    statistics: () => request('/repair/statistics'),
  },

  billing: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/bills', { params }),
    get: (id: string) => request(`/bills/${id}`),
    create: (data: unknown) =>
      request('/bills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    recalculate: (id: string) =>
      request(`/bills/${id}/recalculate`, { method: 'PUT' }),
    cancel: (id: string) =>
      request(`/bills/${id}/cancel`, { method: 'PUT' }),
    generateMonthly: () =>
      request('/bills/generate-monthly', { method: 'POST' }),
    generateForOwner: (ownerId: string) =>
      request('/bills/generate-for-owner', {
        method: 'POST',
        body: JSON.stringify({ ownerId }),
      }),
    pay: (billIds: string[], paymentMethod: string) =>
      request('/bills/pay', {
        method: 'POST',
        body: JSON.stringify({ billIds, paymentMethod }),
      }),
    remind: (params?: Record<string, unknown>) =>
      request('/bills/remind', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    payments: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/bills/payments', { params }),
    getPayment: (id: string) => request(`/bills/payments/${id}`),
    exportPayments: (params?: Record<string, unknown>) =>
      request('/bills/payments/export', { params }),
    statistics: () => request('/bills/statistics'),
    overdueList: (params?: Record<string, unknown>) =>
      request('/bills/overdue-list', { params }),
  },

  workers: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/workers', { params }),
    get: (id: string) => request(`/workers/${id}`),
    create: (data: unknown) =>
      request('/workers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request(`/workers/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    remove: (id: string) =>
      request(`/workers/${id}`, { method: 'DELETE' }),
  },

  users: {
    list: (params?: Record<string, unknown> & PaginationParams) =>
      request<{ data: unknown[]; total: number }>('/users', { params }),
    get: (id: string) => request(`/users/${id}`),
    create: (data: unknown) =>
      request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (id: string, oldPassword: string, newPassword: string) =>
      request(`/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword }),
      }),
    updateStatus: (id: string, status: string) =>
      request(`/users/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    remove: (id: string) =>
      request(`/users/${id}`, { method: 'DELETE' }),
  },
};
