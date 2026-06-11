export interface BaseEntity {
  [key: string]: unknown;
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'super_admin' | 'property_staff' | 'owner';

export interface User extends BaseEntity {
  username: string;
  role: UserRole;
  name: string;
  phone: string;
  email?: string;
  ownerId?: string;
  status: 'active' | 'inactive';
}

export interface Owner extends BaseEntity {
  name: string;
  idCard: string;
  phone: string;
  email?: string;
  address: string;
  status: 'active' | 'archived';
  remark?: string;
  houses?: House[];
  parkingSpots?: ParkingSpot[];
}

export interface House extends BaseEntity {
  building: string;
  unit: string;
  roomNumber: string;
  floor: number;
  area: number;
  houseType: string;
  ownerId: string;
  owner?: Owner;
  status: 'occupied' | 'vacant' | 'rented' | 'archived';
  remark?: string;
}

export interface ParkingSpot extends BaseEntity {
  spotNumber: string;
  area: string;
  type: 'underground' | 'ground' | 'mechanical';
  ownerId?: string;
  owner?: Owner;
  status: 'available' | 'occupied' | 'archived';
  monthlyFee: number;
  remark?: string;
}

export type RepairOrderType = 'electrical' | 'plumbing' | 'structure' | 'appliance' | 'other';
export type RepairOrderStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'archived';
export type RepairPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RepairOrder extends BaseEntity {
  orderNo: string;
  ownerId: string;
  houseId: string;
  owner?: Owner;
  house?: House;
  type: RepairOrderType;
  title: string;
  description: string;
  images?: string[];
  status: RepairOrderStatus;
  priority: RepairPriority;
  workerId?: string;
  worker?: RepairWorker;
  assignTime?: string;
  startWorkTime?: string;
  completeTime?: string;
  acceptTime?: string;
  submitTime: string;
  isOverdue: boolean;
  overdueReminderCount: number;
  rating?: number;
  comment?: string;
  workerRemark?: string;
  cancelReason?: string;
}

export interface RepairWorker extends BaseEntity {
  name: string;
  phone: string;
  specialty: string[];
  status: 'available' | 'busy' | 'offline';
  currentOrderCount: number;
}

export type BillType = 'property_fee' | 'water_fee' | 'electric_fee' | 'parking_fee';
export type BillStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface Bill extends BaseEntity {
  billNo: string;
  ownerId: string;
  houseId?: string;
  parkingSpotId?: string;
  owner?: Owner;
  house?: House;
  parkingSpot?: ParkingSpot;
  type: BillType;
  title: string;
  amount: number;
  paidAmount?: number;
  status: BillStatus;
  billingPeriod: string;
  dueDate: string;
  paidDate?: string;
  reminderCount: number;
  lastReminderTime?: string;
  paymentMethod?: string;
  remark?: string;
}

export interface PaymentRecord extends BaseEntity {
  recordNo: string;
  billIds: string[];
  ownerId: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  status: 'success' | 'failed' | 'pending';
  operatorId?: string;
  remark?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface MenuItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  roles?: UserRole[];
  children?: MenuItem[];
}
