import dayjs from 'dayjs';
import { readJsonFile, writeJsonFile } from './file.js';
import type { RepairWorker, Owner, House, ParkingSpot, RepairOrder } from '../types/index.js';

export function generateOrderNo(prefix: string): string {
  const date = dayjs().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date}${random}`;
}

export function generateBillNo(type: string): string {
  const prefixMap: Record<string, string> = {
    property_fee: 'WY',
    water_fee: 'SD',
    electric_fee: 'DD',
    parking_fee: 'TC',
  };
  const prefix = prefixMap[type] || 'QT';
  const date = dayjs().format('YYYYMM');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date}${random}`;
}

export function generateRecordNo(): string {
  const date = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ZF${date}${random}`;
}

export async function autoAssignWorker(
  orderType: string,
  houseId: string
): Promise<string | null> {
  const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];

  const specialized = workers.filter(
    w => w.status === 'available' && w.specialty.includes(orderType)
  );

  if (specialized.length === 0) {
    const available = workers.filter(w => w.status === 'available');
    if (available.length === 0) return null;
    available.sort((a, b) => a.currentOrderCount - b.currentOrderCount);
    return available[0].id;
  }

  specialized.sort((a, b) => a.currentOrderCount - b.currentOrderCount);
  return specialized[0].id;
}

export function calculatePropertyFee(area: number, unitPrice: number = 2.5): number {
  return Math.round(area * unitPrice * 100) / 100;
}

export function calculateWaterFee(usage: number, unitPrice: number = 5.0): number {
  return Math.round(usage * unitPrice * 100) / 100;
}

export function calculateElectricFee(usage: number, unitPrice: number = 0.56): number {
  return Math.round(usage * unitPrice * 100) / 100;
}

export function getBillingPeriod(): string {
  return dayjs().format('YYYY-MM');
}

export function getDueDate(days: number = 20): string {
  return dayjs().endOf('month').add(days, 'day').format('YYYY-MM-DD');
}

export function isOverdue(dueDate: string): boolean {
  return dayjs().isAfter(dayjs(dueDate), 'day');
}

export function checkRepairOverdue(submitTime: string, priority: string): boolean {
  const timeLimits: Record<string, number> = {
    low: 72,
    medium: 48,
    high: 24,
    urgent: 2,
  };
  const limitHours = timeLimits[priority] || 24;
  return dayjs().diff(dayjs(submitTime), 'hour') > limitHours;
}

export async function validateOwnerHouseRelation(
  ownerId: string,
  houseId: string
): Promise<boolean> {
  const houses = readJsonFile<House[]>('houses.json') || [];
  const house = houses.find(h => h.id === houseId);
  return !!house && house.ownerId === ownerId;
}

export async function getOwnerHouses(ownerId: string): Promise<House[]> {
  const houses = readJsonFile<House[]>('houses.json') || [];
  return houses.filter(h => h.ownerId === ownerId && h.status !== 'archived');
}

export async function getOwnerParkingSpots(ownerId: string): Promise<ParkingSpot[]> {
  const spots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];
  return spots.filter(s => s.ownerId === ownerId && s.status !== 'archived');
}

export async function getOwnerById(ownerId: string): Promise<Owner | undefined> {
  const owners = readJsonFile<Owner[]>('owners.json') || [];
  return owners.find(o => o.id === ownerId);
}

export function detectDuplicateRepairOrder(
  ownerId: string,
  houseId: string,
  title: string,
  description: string,
  hours: number = 24
): boolean {
  const orders = readJsonFile<any[]>('repair_orders.json') || [];
  const recentOrders = orders.filter(
    o =>
      o.ownerId === ownerId &&
      o.houseId === houseId &&
      o.status !== 'cancelled' &&
      o.status !== 'archived' &&
      dayjs().diff(dayjs(o.submitTime), 'hour') < hours
  );

  return recentOrders.some(
    o =>
      o.title === title ||
      (o.description.includes(description.substring(0, 20)) && description.length > 20)
  );
}

export function cleanImportData<T extends Record<string, unknown>>(
  data: T[],
  requiredFields: string[]
): { valid: T[]; invalid: { row: T; errors: string[]; rowIndex: number }[] } {
  const valid: T[] = [];
  const invalid: { row: T; errors: string[]; rowIndex: number }[] = [];

  data.forEach((row, index) => {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        errors.push(`缺失必填字段: ${field}`);
      }
    }

    if (errors.length > 0) {
      invalid.push({ row, errors, rowIndex: index });
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid };
}

export interface WorkerStats {
  completedCount: number;
  averageRating: number | undefined;
  effectiveStatus: 'available' | 'busy' | 'offline';
}

export function getWorkerStats(workerId: string): WorkerStats {
  const orders = readJsonFile<RepairOrder[]>('repair_orders.json') || [];
  const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];
  const worker = workers.find(w => w.id === workerId);

  const finishedOrders = orders.filter(
    o => o.workerId === workerId && (o.status === 'completed' || o.status === 'archived')
  );

  const completedCount = finishedOrders.length;

  const ratedOrders = finishedOrders.filter(o => typeof o.rating === 'number');
  let averageRating: number | undefined;
  if (ratedOrders.length > 0) {
    const total = ratedOrders.reduce((sum, o) => sum + (o.rating as number), 0);
    averageRating = Math.round((total / ratedOrders.length) * 100) / 100;
  }

  let effectiveStatus: 'available' | 'busy' | 'offline' = 'available';
  if (worker) {
    if (worker.status === 'offline') {
      effectiveStatus = 'offline';
    } else if (worker.currentOrderCount > 0) {
      effectiveStatus = 'busy';
    } else {
      effectiveStatus = 'available';
    }
  }

  return { completedCount, averageRating, effectiveStatus };
}

export function enrichWorkerWithStats<T extends RepairWorker>(worker: T): T & WorkerStats {
  const stats = getWorkerStats(worker.id);
  return {
    ...worker,
    ...stats,
    status: stats.effectiveStatus,
  };
}

export function syncWorkerStatusToDb(workerId: string): void {
  const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];
  const index = workers.findIndex(w => w.id === workerId);
  if (index !== -1) {
    const stats = getWorkerStats(workerId);
    if (workers[index].status !== 'offline') {
      workers[index].status = stats.effectiveStatus;
      writeJsonFile('repair_workers.json', workers);
    }
  }
}
