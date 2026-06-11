import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, requireOwnerOrAdmin, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger, logOperation } from '../utils/logger.js';
import { readJsonFile, writeJsonFile } from '../utils/file.js';
import { generateBillNo, generateRecordNo, calculatePropertyFee, calculateWaterFee, calculateElectricFee, getBillingPeriod, getDueDate, isOverdue, getOwnerHouses, getOwnerParkingSpots, getOwnerById } from '../utils/business.js';
import type { Bill, PaymentRecord, House, ParkingSpot, Owner } from '../types/index.js';

const router = Router();

const billService = new CrudService<Bill>({
  filename: 'bills.json',
  idPrefix: 'bill',
  moduleName: '账单',
});

const paymentService = new CrudService<PaymentRecord>({
  filename: 'payment_records.json',
  idPrefix: 'payment',
  moduleName: '缴费记录',
});

const BILL_FUZZY_FIELDS = ['billNo', 'title', 'remark'];

const BILL_TYPE_TITLES: Record<string, string> = {
  property_fee: '物业管理费',
  water_fee: '水费',
  electric_fee: '电费',
  parking_fee: '停车管理费',
};

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ...filters } = req.query;
    const queryFilters = { ...filters } as Record<string, unknown>;

    if (req.user?.role === 'owner') {
      queryFilters.ownerId = req.user.ownerId;
    }

    const result = await billService.list(
      queryFilters,
      BILL_FUZZY_FIELDS,
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20 }
    );

    logger.info('billing', '查询账单列表', { filters: queryFilters, userId: req.user?.id });
    res.json(successResponse(result.data, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('billing', '查询账单列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询账单列表失败'));
  }
});

router.get('/statistics', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bills = readJsonFile<Bill[]>('bills.json') || [];

    const byType: Record<string, { count: number; amount: number }> = {};
    const byStatus: Record<string, { count: number; amount: number }> = {};
    const byMonth: Record<string, { count: number; amount: number; paid: number; unpaid: number }> = {};

    bills.forEach(bill => {
      if (!byType[bill.type]) {
        byType[bill.type] = { count: 0, amount: 0 };
      }
      byType[bill.type].count++;
      byType[bill.type].amount += bill.amount;

      if (!byStatus[bill.status]) {
        byStatus[bill.status] = { count: 0, amount: 0 };
      }
      byStatus[bill.status].count++;
      byStatus[bill.status].amount += bill.amount;

      const month = bill.billingPeriod;
      if (!byMonth[month]) {
        byMonth[month] = { count: 0, amount: 0, paid: 0, unpaid: 0 };
      }
      byMonth[month].count++;
      byMonth[month].amount += bill.amount;
      if (bill.status === 'paid') {
        byMonth[month].paid += bill.paidAmount || bill.amount;
      } else {
        byMonth[month].unpaid += bill.amount;
      }
    });

    const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
    const paidAmount = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.paidAmount || b.amount), 0);
    const unpaidAmount = bills.filter(b => ['unpaid', 'overdue'].includes(b.status)).reduce((sum, b) => sum + b.amount, 0);

    logger.info('billing', '查询账单统计', { userId: req.user?.id });
    res.json(successResponse({
      byType,
      byStatus,
      byMonth,
      summary: {
        totalCount: bills.length,
        totalAmount,
        paidAmount,
        unpaidAmount,
        paidRate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 10000) / 100 : 0,
      },
    }));
  } catch (error) {
    logger.error('billing', '查询账单统计失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询账单统计失败'));
  }
});

router.get('/overdue-list', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ownerId, type } = req.query;
    const bills = readJsonFile<Bill[]>('bills.json') || [];

    const overdueBills = bills.filter(b => {
      const overdue = b.status === 'overdue' || (b.status === 'unpaid' && isOverdue(b.dueDate));
      if (!overdue) return false;
      if (ownerId && b.ownerId !== ownerId) return false;
      if (type && b.type !== type) return false;
      return true;
    });

    overdueBills.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const total = overdueBills.length;
    const start = (pageNum - 1) * pageSizeNum;
    const end = start + pageSizeNum;
    const paginatedData = overdueBills.slice(start, end);

    const totalOverdueAmount = overdueBills.reduce((sum, b) => sum + b.amount, 0);

    logger.info('billing', '查询欠费账单列表', { userId: req.user?.id, count: overdueBills.length });
    res.json(successResponse({
      bills: paginatedData,
      totalOverdueAmount,
      totalOverdueCount: overdueBills.length,
    }, { total, page: pageNum, pageSize: pageSizeNum }));
  } catch (error) {
    logger.error('billing', '查询欠费账单列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询欠费账单列表失败'));
  }
});

router.get('/:id', authenticateToken, requireOwnerOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bill = await billService.getById(id);

    if (!bill) {
      logger.warn('billing', '账单不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('账单不存在'));
      return;
    }

    if (req.user?.role === 'owner' && bill.ownerId !== req.user.ownerId) {
      logger.warn('billing', '业主尝试访问其他业主账单', { userId: req.user?.id, targetOwnerId: bill.ownerId });
      res.status(403).json(errorResponse('只能访问自己的账单'));
      return;
    }

    logger.info('billing', '查询账单详情', { id, userId: req.user?.id });
    res.json(successResponse(bill));
  } catch (error) {
    logger.error('billing', '查询账单详情失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询账单详情失败'));
  }
});

router.post('/', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ownerId, houseId, parkingSpotId, type, title, amount, billingPeriod, dueDate, remark } = req.body;

    if (!ownerId || !type || !amount || !billingPeriod) {
      res.status(400).json(errorResponse('缺少必填字段'));
      return;
    }

    const owner = await getOwnerById(ownerId);
    if (!owner) {
      logger.warn('billing', '业主不存在', { ownerId, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    const billNo = generateBillNo(type);
    const billTitle = title || BILL_TYPE_TITLES[type] || '费用账单';
    const billDueDate = dueDate || getDueDate(20);

    const newBill = await billService.create(
      {
        billNo,
        ownerId,
        houseId: houseId || '',
        parkingSpotId: parkingSpotId || '',
        type,
        title: billTitle,
        amount: Number(amount),
        status: 'unpaid',
        billingPeriod,
        dueDate: billDueDate,
        reminderCount: 0,
        remark,
      },
      req.user?.id
    );

    logger.info('billing', '手动创建账单成功', { billId: newBill.id, billNo, userId: req.user?.id });
    res.status(201).json(successResponse(newBill));
  } catch (error) {
    logger.error('billing', '创建账单失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('创建账单失败'));
  }
});

router.put('/:id', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, amount, billingPeriod, dueDate, status, remark } = req.body;

    const existingBill = await billService.getById(id);
    if (!existingBill) {
      logger.warn('billing', '账单不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('账单不存在'));
      return;
    }

    if (existingBill.status === 'paid' && amount !== undefined && amount !== existingBill.amount) {
      logger.warn('billing', '已支付账单不能修改金额', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('已支付账单不能修改金额'));
      return;
    }

    const updateData: Partial<Bill> = {};
    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (billingPeriod !== undefined) updateData.billingPeriod = billingPeriod;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (status !== undefined) updateData.status = status;
    if (remark !== undefined) updateData.remark = remark;

    const updatedBill = await billService.update(id, updateData, req.user?.id);

    logger.info('billing', '更新账单成功', { id, userId: req.user?.id });
    res.json(successResponse(updatedBill));
  } catch (error) {
    logger.error('billing', '更新账单失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('更新账单失败'));
  }
});

router.put('/:id/recalculate', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingBill = await billService.getById(id);
    if (!existingBill) {
      logger.warn('billing', '账单不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('账单不存在'));
      return;
    }

    if (existingBill.status === 'paid') {
      logger.warn('billing', '已支付账单不能重算', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('已支付账单不能重算'));
      return;
    }

    let newAmount = existingBill.amount;
    const houses = readJsonFile<House[]>('houses.json') || [];
    const parkingSpots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];

    if (existingBill.type === 'property_fee' && existingBill.houseId) {
      const house = houses.find(h => h.id === existingBill.houseId);
      if (house) {
        newAmount = calculatePropertyFee(house.area, 2.5);
      }
    } else if (existingBill.type === 'water_fee') {
      newAmount = calculateWaterFee(9.16, 5.0);
    } else if (existingBill.type === 'electric_fee') {
      newAmount = calculateElectricFee(229.5, 0.56);
    } else if (existingBill.type === 'parking_fee' && existingBill.parkingSpotId) {
      const spot = parkingSpots.find(p => p.id === existingBill.parkingSpotId);
      if (spot) {
        newAmount = spot.monthlyFee;
      }
    }

    const oldAmount = existingBill.amount;
    const updatedBill = await billService.update(id, { amount: newAmount }, req.user?.id);

    logOperation('billing', 'recalculate', req.user?.id, {
      id,
      billNo: existingBill.billNo,
      oldAmount,
      newAmount,
    });

    logger.info('billing', '账单重算成功', { id, oldAmount, newAmount, userId: req.user?.id });
    res.json(successResponse({
      ...updatedBill,
      oldAmount,
      newAmount,
    }));
  } catch (error) {
    logger.error('billing', '账单重算失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('账单重算失败'));
  }
});

router.put('/:id/cancel', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingBill = await billService.getById(id);
    if (!existingBill) {
      logger.warn('billing', '账单不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('账单不存在'));
      return;
    }

    if (existingBill.status === 'paid' || existingBill.status === 'refunded') {
      logger.warn('billing', '已支付/已退款账单不能取消', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('已支付/已退款账单不能取消'));
      return;
    }

    if (existingBill.status === 'cancelled') {
      logger.warn('billing', '账单已取消', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('账单已取消'));
      return;
    }

    const cancelledBill = await billService.update(id, { status: 'cancelled' }, req.user?.id);

    logOperation('billing', 'cancel', req.user?.id, {
      id,
      billNo: existingBill.billNo,
      amount: existingBill.amount,
    });

    logger.info('billing', '取消账单成功', { id, userId: req.user?.id });
    res.json(successResponse(cancelledBill));
  } catch (error) {
    logger.error('billing', '取消账单失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('取消账单失败'));
  }
});

router.post('/generate-monthly', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const billingPeriod = getBillingPeriod();
    const dueDate = getDueDate(20);
    const now = new Date().toISOString();

    const houses = readJsonFile<House[]>('houses.json') || [];
    const parkingSpots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];
    const existingBills = readJsonFile<Bill[]>('bills.json') || [];

    const existingBillsForPeriod = existingBills.filter(b => b.billingPeriod === billingPeriod);

    const generatedBills: Bill[] = [];
    const skippedBills: { type: string; ownerId: string; reason: string }[] = [];

    const occupiedHouses = houses.filter(h => h.status === 'occupied');

    for (const house of occupiedHouses) {
      const exists = existingBillsForPeriod.find(
        b => b.ownerId === house.ownerId && b.houseId === house.id && b.type === 'property_fee'
      );
      if (exists) {
        skippedBills.push({ type: 'property_fee', ownerId: house.ownerId, reason: '当期已生成' });
        continue;
      }

      const amount = calculatePropertyFee(house.area, 2.5);
      const newBill: Bill = {
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('property_fee'),
        ownerId: house.ownerId,
        houseId: house.id,
        type: 'property_fee',
        title: `${billingPeriod}月物业管理费`,
        amount,
        status: 'unpaid',
        billingPeriod,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      generatedBills.push(newBill);
    }

    for (const house of occupiedHouses) {
      const exists = existingBillsForPeriod.find(
        b => b.ownerId === house.ownerId && b.houseId === house.id && b.type === 'water_fee'
      );
      if (exists) {
        skippedBills.push({ type: 'water_fee', ownerId: house.ownerId, reason: '当期已生成' });
        continue;
      }

      const amount = calculateWaterFee(9.16, 5.0);
      const newBill: Bill = {
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('water_fee'),
        ownerId: house.ownerId,
        houseId: house.id,
        type: 'water_fee',
        title: `${billingPeriod}月水费`,
        amount,
        status: 'unpaid',
        billingPeriod,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      generatedBills.push(newBill);
    }

    for (const house of occupiedHouses) {
      const exists = existingBillsForPeriod.find(
        b => b.ownerId === house.ownerId && b.houseId === house.id && b.type === 'electric_fee'
      );
      if (exists) {
        skippedBills.push({ type: 'electric_fee', ownerId: house.ownerId, reason: '当期已生成' });
        continue;
      }

      const amount = calculateElectricFee(229.5, 0.56);
      const newBill: Bill = {
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('electric_fee'),
        ownerId: house.ownerId,
        houseId: house.id,
        type: 'electric_fee',
        title: `${billingPeriod}月电费`,
        amount,
        status: 'unpaid',
        billingPeriod,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      generatedBills.push(newBill);
    }

    const occupiedSpots = parkingSpots.filter(s => s.status === 'occupied' && s.ownerId);
    for (const spot of occupiedSpots) {
      const exists = existingBillsForPeriod.find(
        b => b.ownerId === spot.ownerId && b.parkingSpotId === spot.id && b.type === 'parking_fee'
      );
      if (exists) {
        skippedBills.push({ type: 'parking_fee', ownerId: spot.ownerId!, reason: '当期已生成' });
        continue;
      }

      const newBill: Bill = {
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('parking_fee'),
        ownerId: spot.ownerId!,
        parkingSpotId: spot.id,
        type: 'parking_fee',
        title: `${billingPeriod}月停车管理费`,
        amount: spot.monthlyFee,
        status: 'unpaid',
        billingPeriod,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      generatedBills.push(newBill);
    }

    const allBills = [...existingBills, ...generatedBills];
    writeJsonFile('bills.json', allBills);

    logOperation('billing', 'generate-monthly', req.user?.id, {
      billingPeriod,
      generated: generatedBills.length,
      skipped: skippedBills.length,
    });

    logger.info('billing', '生成月度账单成功', {
      billingPeriod,
      generated: generatedBills.length,
      skipped: skippedBills.length,
      userId: req.user?.id,
    });

    res.json(successResponse({
      billingPeriod,
      dueDate,
      generated: generatedBills.length,
      skipped: skippedBills.length,
      generatedBills,
      skippedBills,
    }));
  } catch (error) {
    logger.error('billing', '生成月度账单失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('生成月度账单失败'));
  }
});

router.post('/generate-for-owner', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ownerId, billingPeriod } = req.body;

    if (!ownerId) {
      res.status(400).json(errorResponse('缺少业主ID'));
      return;
    }

    const owner = await getOwnerById(ownerId);
    if (!owner) {
      logger.warn('billing', '业主不存在', { ownerId, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    const period = billingPeriod || getBillingPeriod();
    const dueDate = getDueDate(20);
    const now = new Date().toISOString();

    const ownerHouses = await getOwnerHouses(ownerId);
    const ownerParking = await getOwnerParkingSpots(ownerId);
    const existingBills = readJsonFile<Bill[]>('bills.json') || [];

    const existingBillsForPeriod = existingBills.filter(b => b.billingPeriod === period && b.ownerId === ownerId);

    const generatedBills: Bill[] = [];
    const skippedBills: { type: string; reason: string }[] = [];

    const occupiedHouses = ownerHouses.filter(h => h.status === 'occupied');

    for (const house of occupiedHouses) {
      const exists = existingBillsForPeriod.find(b => b.houseId === house.id && b.type === 'property_fee');
      if (exists) {
        skippedBills.push({ type: 'property_fee', reason: '当期已生成' });
        continue;
      }
      const amount = calculatePropertyFee(house.area, 2.5);
      generatedBills.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('property_fee'),
        ownerId,
        houseId: house.id,
        type: 'property_fee',
        title: `${period}月物业管理费`,
        amount,
        status: 'unpaid',
        billingPeriod: period,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const house of occupiedHouses) {
      const exists = existingBillsForPeriod.find(b => b.houseId === house.id && b.type === 'water_fee');
      if (exists) {
        skippedBills.push({ type: 'water_fee', reason: '当期已生成' });
        continue;
      }
      const amount = calculateWaterFee(9.16, 5.0);
      generatedBills.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('water_fee'),
        ownerId,
        houseId: house.id,
        type: 'water_fee',
        title: `${period}月水费`,
        amount,
        status: 'unpaid',
        billingPeriod: period,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const house of occupiedHouses) {
      const exists = existingBillsForPeriod.find(b => b.houseId === house.id && b.type === 'electric_fee');
      if (exists) {
        skippedBills.push({ type: 'electric_fee', reason: '当期已生成' });
        continue;
      }
      const amount = calculateElectricFee(229.5, 0.56);
      generatedBills.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('electric_fee'),
        ownerId,
        houseId: house.id,
        type: 'electric_fee',
        title: `${period}月电费`,
        amount,
        status: 'unpaid',
        billingPeriod: period,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const spot of ownerParking) {
      if (spot.status !== 'occupied') continue;
      const exists = existingBillsForPeriod.find(b => b.parkingSpotId === spot.id && b.type === 'parking_fee');
      if (exists) {
        skippedBills.push({ type: 'parking_fee', reason: '当期已生成' });
        continue;
      }
      generatedBills.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        billNo: generateBillNo('parking_fee'),
        ownerId,
        parkingSpotId: spot.id,
        type: 'parking_fee',
        title: `${period}月停车管理费`,
        amount: spot.monthlyFee,
        status: 'unpaid',
        billingPeriod: period,
        dueDate,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const allBills = [...existingBills, ...generatedBills];
    writeJsonFile('bills.json', allBills);

    logOperation('billing', 'generate-for-owner', req.user?.id, {
      ownerId,
      billingPeriod: period,
      generated: generatedBills.length,
      skipped: skippedBills.length,
    });

    logger.info('billing', '为业主生成账单成功', {
      ownerId,
      generated: generatedBills.length,
      skipped: skippedBills.length,
      userId: req.user?.id,
    });

    res.json(successResponse({
      ownerId,
      billingPeriod: period,
      dueDate,
      generated: generatedBills.length,
      skipped: skippedBills.length,
      generatedBills,
      skippedBills,
    }));
  } catch (error) {
    logger.error('billing', '为业主生成账单失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('为业主生成账单失败'));
  }
});

router.post('/pay', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { billIds, paymentMethod = 'online' } = req.body;

    if (!Array.isArray(billIds) || billIds.length === 0) {
      res.status(400).json(errorResponse('请选择要支付的账单'));
      return;
    }

    const bills = readJsonFile<Bill[]>('bills.json') || [];
    const billsToPay = bills.filter(b => billIds.includes(b.id));

    if (billsToPay.length !== billIds.length) {
      const missingIds = billIds.filter(id => !billsToPay.find(b => b.id === id));
      logger.warn('billing', '部分账单不存在', { missingIds, userId: req.user?.id });
      res.status(404).json(errorResponse(`账单不存在: ${missingIds.join(', ')}`));
      return;
    }

    const ownerId = billsToPay[0].ownerId;
    const allSameOwner = billsToPay.every(b => b.ownerId === ownerId);
    if (!allSameOwner) {
      logger.warn('billing', '账单不属于同一业主', { userId: req.user?.id });
      res.status(400).json(errorResponse('只能同时支付同一业主的账单'));
      return;
    }

    if (req.user?.role === 'owner' && req.user.ownerId !== ownerId) {
      logger.warn('billing', '业主尝试支付其他业主账单', { userId: req.user?.id, targetOwnerId: ownerId });
      res.status(403).json(errorResponse('只能支付自己的账单'));
      return;
    }

    const invalidBills = billsToPay.filter(b => !['unpaid', 'overdue'].includes(b.status));
    if (invalidBills.length > 0) {
      const invalidNos = invalidBills.map(b => b.billNo).join(', ');
      logger.warn('billing', '包含不可支付的账单', { invalidNos, userId: req.user?.id });
      res.status(400).json(errorResponse(`包含不可支付的账单: ${invalidNos}`));
      return;
    }

    const totalAmount = billsToPay.reduce((sum, b) => sum + b.amount, 0);
    const paidDate = new Date().toISOString();
    const recordNo = generateRecordNo();

    const updatedBills = bills.map(b => {
      if (billIds.includes(b.id)) {
        return {
          ...b,
          status: 'paid' as const,
          paidAmount: b.amount,
          paidDate,
          paymentMethod,
          updatedAt: paidDate,
        };
      }
      return b;
    });

    writeJsonFile('bills.json', updatedBills);

    const paymentRecord: PaymentRecord = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      recordNo,
      billIds,
      ownerId,
      amount: totalAmount,
      paymentMethod,
      status: 'success',
      operatorId: req.user?.id,
      createdAt: paidDate,
      updatedAt: paidDate,
    };

    const paymentRecords = readJsonFile<PaymentRecord[]>('payment_records.json') || [];
    paymentRecords.push(paymentRecord);
    writeJsonFile('payment_records.json', paymentRecords);

    logOperation('billing', 'pay', req.user?.id, {
      recordNo,
      billIds,
      totalAmount,
      paymentMethod,
    });

    logger.info('billing', '支付成功', {
      recordNo,
      billIds,
      totalAmount,
      userId: req.user?.id,
    });

    res.json(successResponse({
      recordNo,
      totalAmount,
      paidDate,
      paymentMethod,
      billCount: billIds.length,
      paidBills: billsToPay.map(b => ({
        id: b.id,
        billNo: b.billNo,
        type: b.type,
        title: b.title,
        amount: b.amount,
      })),
    }));
  } catch (error) {
    logger.error('billing', '支付失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('支付失败'));
  }
});

router.post('/remind', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { billIds, ownerId, type } = req.body;

    const bills = readJsonFile<Bill[]>('bills.json') || [];
    const now = new Date().toISOString();

    let billsToRemind: Bill[] = [];

    if (Array.isArray(billIds) && billIds.length > 0) {
      billsToRemind = bills.filter(b =>
        billIds.includes(b.id) && ['unpaid', 'overdue'].includes(b.status)
      );
    } else {
      billsToRemind = bills.filter(b => {
        if (!['unpaid', 'overdue'].includes(b.status)) return false;
        if (ownerId && b.ownerId !== ownerId) return false;
        if (type && b.type !== type) return false;
        return true;
      });
    }

    if (billsToRemind.length === 0) {
      logger.info('billing', '没有需要催收的账单', { userId: req.user?.id });
      res.json(successResponse({ reminded: 0, message: '没有需要催收的账单' }));
      return;
    }

    const updatedBills = bills.map(b => {
      if (billsToRemind.find(br => br.id === b.id)) {
        return {
          ...b,
          reminderCount: (b.reminderCount || 0) + 1,
          lastReminderTime: now,
          updatedAt: now,
        };
      }
      return b;
    });

    writeJsonFile('bills.json', updatedBills);

    logOperation('billing', 'remind', req.user?.id, {
      count: billsToRemind.length,
      billIds: billsToRemind.map(b => b.id),
    });

    logger.info('billing', '欠费催收完成', { count: billsToRemind.length, userId: req.user?.id });

    res.json(successResponse({
      reminded: billsToRemind.length,
      remindedBills: billsToRemind.map(b => ({
        id: b.id,
        billNo: b.billNo,
        ownerId: b.ownerId,
        amount: b.amount,
        dueDate: b.dueDate,
        newReminderCount: (b.reminderCount || 0) + 1,
      })),
    }));
  } catch (error) {
    logger.error('billing', '欠费催收失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('欠费催收失败'));
  }
});

router.get('/payments', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ownerId, paymentMethod, status, startDate, endDate } = req.query;
    const payments = readJsonFile<PaymentRecord[]>('payment_records.json') || [];

    let filteredPayments = payments;

    if (req.user?.role === 'owner') {
      filteredPayments = filteredPayments.filter(p => p.ownerId === req.user?.ownerId);
    } else if (ownerId) {
      filteredPayments = filteredPayments.filter(p => p.ownerId === ownerId);
    }

    if (paymentMethod) {
      filteredPayments = filteredPayments.filter(p => p.paymentMethod === paymentMethod);
    }

    if (status) {
      filteredPayments = filteredPayments.filter(p => p.status === status);
    }

    if (startDate) {
      filteredPayments = filteredPayments.filter(p => new Date(p.createdAt) >= new Date(startDate as string));
    }

    if (endDate) {
      filteredPayments = filteredPayments.filter(p => new Date(p.createdAt) <= new Date(endDate as string));
    }

    filteredPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const total = filteredPayments.length;
    const start = (pageNum - 1) * pageSizeNum;
    const end = start + pageSizeNum;
    const paginatedData = filteredPayments.slice(start, end);

    const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    logger.info('billing', '查询缴费记录列表', { count: filteredPayments.length, userId: req.user?.id });
    res.json(successResponse({
      records: paginatedData,
      totalAmount,
      totalCount: filteredPayments.length,
    }, { total, page: pageNum, pageSize: pageSizeNum }));
  } catch (error) {
    logger.error('billing', '查询缴费记录列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询缴费记录列表失败'));
  }
});

router.get('/payments/export', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ownerId, paymentMethod, status, startDate, endDate } = req.query;
    const payments = readJsonFile<PaymentRecord[]>('payment_records.json') || [];
    const bills = readJsonFile<Bill[]>('bills.json') || [];
    const owners = readJsonFile<Owner[]>('owners.json') || [];

    let filteredPayments = payments;

    if (ownerId) {
      filteredPayments = filteredPayments.filter(p => p.ownerId === ownerId);
    }
    if (paymentMethod) {
      filteredPayments = filteredPayments.filter(p => p.paymentMethod === paymentMethod);
    }
    if (status) {
      filteredPayments = filteredPayments.filter(p => p.status === status);
    }
    if (startDate) {
      filteredPayments = filteredPayments.filter(p => new Date(p.createdAt) >= new Date(startDate as string));
    }
    if (endDate) {
      filteredPayments = filteredPayments.filter(p => new Date(p.createdAt) <= new Date(endDate as string));
    }

    const exportData = filteredPayments.map(p => {
      const owner = owners.find(o => o.id === p.ownerId);
      const paidBills = bills.filter(b => p.billIds.includes(b.id));
      return {
        支付记录号: p.recordNo,
        业主姓名: owner?.name || '',
        业主电话: owner?.phone || '',
        支付金额: p.amount,
        支付方式: p.paymentMethod,
        支付状态: p.status,
        支付时间: p.createdAt,
        账单数量: paidBills.length,
        账单明细: paidBills.map(b => `${b.billNo}-${b.title}`).join('; '),
        备注: p.remark || '',
      };
    });

    logOperation('billing', 'export-payments', req.user?.id, { count: exportData.length });
    logger.info('billing', '导出缴费记录', { count: exportData.length, userId: req.user?.id });

    res.json(successResponse({
      total: exportData.length,
      data: exportData,
    }));
  } catch (error) {
    logger.error('billing', '导出缴费记录失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('导出缴费记录失败'));
  }
});

router.get('/payments/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payments = readJsonFile<PaymentRecord[]>('payment_records.json') || [];
    const payment = payments.find(p => p.id === id);

    if (!payment) {
      logger.warn('billing', '缴费记录不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('缴费记录不存在'));
      return;
    }

    if (req.user?.role === 'owner' && payment.ownerId !== req.user.ownerId) {
      logger.warn('billing', '业主尝试访问其他业主缴费记录', { userId: req.user?.id, targetOwnerId: payment.ownerId });
      res.status(403).json(errorResponse('只能访问自己的缴费记录'));
      return;
    }

    const bills = readJsonFile<Bill[]>('bills.json') || [];
    const paidBills = bills.filter(b => payment.billIds.includes(b.id));

    logger.info('billing', '查询缴费记录详情', { id, userId: req.user?.id });
    res.json(successResponse({
      ...payment,
      paidBills: paidBills.map(b => ({
        id: b.id,
        billNo: b.billNo,
        type: b.type,
        title: b.title,
        amount: b.amount,
      })),
    }));
  } catch (error) {
    logger.error('billing', '查询缴费记录详情失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询缴费记录详情失败'));
  }
});

export default router;
