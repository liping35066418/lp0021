import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger, logOperation } from '../utils/logger.js';
import { readJsonFile, writeJsonFile } from '../utils/file.js';
import { cleanImportData } from '../utils/business.js';
import type { Owner, House, ParkingSpot, Bill, RepairOrder } from '../types/index.js';

const router = Router();

const ownerService = new CrudService<Owner>({
  filename: 'owners.json',
  idPrefix: 'owner',
  moduleName: '业主',
});

const FUZZY_FIELDS = ['name', 'idCard', 'phone', 'address', 'remark'];

router.get('/', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ...filters } = req.query;
    const result = await ownerService.list(
      filters as Record<string, unknown>,
      FUZZY_FIELDS,
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20 }
    );
    logger.info('owners', '查询业主列表', { filters, userId: req.user?.id });
    res.json(successResponse(result.data, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('owners', '查询业主列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询业主列表失败'));
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const owner = await ownerService.getById(id);

    if (!owner) {
      logger.warn('owners', '业主不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    if (req.user?.role === 'owner' && req.user.ownerId !== id) {
      logger.warn('owners', '业主尝试访问其他业主数据', { userId: req.user?.id, targetOwnerId: id });
      res.status(403).json(errorResponse('只能访问自己的数据'));
      return;
    }

    logger.info('owners', '查询业主详情', { id, userId: req.user?.id });
    res.json(successResponse(owner));
  } catch (error) {
    logger.error('owners', '查询业主详情失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询业主详情失败'));
  }
});

router.post('/', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, idCard, phone, email, address, remark } = req.body;

    if (!name || !idCard || !phone || !address) {
      res.status(400).json(errorResponse('缺少必填字段'));
      return;
    }

    const existingOwners = readJsonFile<Owner[]>('owners.json') || [];
    const duplicate = existingOwners.find(o => o.idCard === idCard && o.status !== 'archived');

    if (duplicate) {
      logger.warn('owners', '身份证号已存在', { idCard, userId: req.user?.id });
      res.status(400).json(errorResponse('身份证号已存在'));
      return;
    }

    const newOwner = await ownerService.create(
      { name, idCard, phone, email, address, status: 'active', remark },
      req.user?.id
    );

    logger.info('owners', '新增业主成功', { ownerId: newOwner.id, userId: req.user?.id });
    res.status(201).json(successResponse(newOwner));
  } catch (error) {
    logger.error('owners', '新增业主失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('新增业主失败'));
  }
});

router.put('/:id', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, idCard, phone, email, address, status, remark } = req.body;

    const existingOwner = await ownerService.getById(id);
    if (!existingOwner) {
      logger.warn('owners', '业主不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    if (idCard && idCard !== existingOwner.idCard) {
      const existingOwners = readJsonFile<Owner[]>('owners.json') || [];
      const duplicate = existingOwners.find(o => o.idCard === idCard && o.id !== id && o.status !== 'archived');
      if (duplicate) {
        logger.warn('owners', '身份证号已存在', { idCard, userId: req.user?.id });
        res.status(400).json(errorResponse('身份证号已存在'));
        return;
      }
    }

    const updatedOwner = await ownerService.update(
      id,
      { name, idCard, phone, email, address, status, remark },
      req.user?.id
    );

    logger.info('owners', '更新业主信息成功', { id, userId: req.user?.id });
    res.json(successResponse(updatedOwner));
  } catch (error) {
    logger.error('owners', '更新业主信息失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('更新业主信息失败'));
  }
});

router.put('/:id/archive', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingOwner = await ownerService.getById(id);
    if (!existingOwner) {
      logger.warn('owners', '业主不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    if (existingOwner.status === 'archived') {
      logger.warn('owners', '业主已归档', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('业主已归档'));
      return;
    }

    const repairOrders = readJsonFile<RepairOrder[]>('repair_orders.json') || [];
    const hasUnfinishedOrders = repairOrders.some(
      o => o.ownerId === id && !['completed', 'cancelled', 'archived'].includes(o.status)
    );

    if (hasUnfinishedOrders) {
      logger.warn('owners', '业主存在未完成工单，无法归档', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('业主存在未完成工单，无法归档'));
      return;
    }

    const bills = readJsonFile<Bill[]>('bills.json') || [];
    const hasUnpaidBills = bills.some(
      b => b.ownerId === id && ['unpaid', 'overdue'].includes(b.status)
    );

    if (hasUnpaidBills) {
      logger.warn('owners', '业主存在欠费账单，无法归档', { id, userId: req.user?.id });
      res.status(400).json(errorResponse('业主存在欠费账单，无法归档'));
      return;
    }

    const archivedOwner = await ownerService.archive(id, req.user?.id);

    logOperation('owners', 'archive', req.user?.id, { id });
    logger.info('owners', '归档业主成功', { id, userId: req.user?.id });
    res.json(successResponse(archivedOwner));
  } catch (error) {
    logger.error('owners', '归档业主失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('归档业主失败'));
  }
});

router.post('/batch-import', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data)) {
      res.status(400).json(errorResponse('导入数据格式错误'));
      return;
    }

    const requiredFields = ['name', 'idCard', 'phone', 'address'];
    const { valid, invalid } = cleanImportData<Record<string, unknown>>(data, requiredFields);

    const existingOwners = readJsonFile<Owner[]>('owners.json') || [];
    const existingIdCards = existingOwners
      .filter(o => o.status !== 'archived')
      .map(o => o.idCard);

    const duplicates: Record<string, unknown>[] = [];
    const toImport: Omit<Owner, keyof import('../types/index.js').BaseEntity>[] = [];

    valid.forEach(row => {
      const rowData = row as Partial<Owner>;
      if (existingIdCards.includes(rowData.idCard as string)) {
        duplicates.push(row);
      } else if (!existingIdCards.includes(rowData.idCard as string)) {
        existingIdCards.push(rowData.idCard as string);
        toImport.push({
          name: rowData.name as string,
          idCard: rowData.idCard as string,
          phone: rowData.phone as string,
          email: rowData.email as string,
          address: rowData.address as string,
          status: 'active',
          remark: rowData.remark as string,
        });
      }
    });

    const now = new Date().toISOString();
    const importedOwners: Owner[] = [];

    for (const item of toImport) {
      const newOwner: Owner = {
        ...item,
        id: `owner_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        createdAt: now,
        updatedAt: now,
      };
      importedOwners.push(newOwner);
    }

    const allOwners = [...existingOwners, ...importedOwners];
    writeJsonFile('owners.json', allOwners);

    logOperation('owners', 'batch-import', req.user?.id, {
      total: data.length,
      imported: importedOwners.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
    });

    logger.info('owners', '批量导入业主数据', {
      total: data.length,
      imported: importedOwners.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      userId: req.user?.id,
    });

    res.json(successResponse({
      total: data.length,
      imported: importedOwners.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      invalidRows: invalid,
      duplicateRows: duplicates,
    }));
  } catch (error) {
    logger.error('owners', '批量导入业主数据失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('批量导入业主数据失败'));
  }
});

router.get('/:id/houses', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.role === 'owner' && req.user.ownerId !== id) {
      logger.warn('owners', '业主尝试访问其他业主房屋数据', { userId: req.user?.id, targetOwnerId: id });
      res.status(403).json(errorResponse('只能访问自己的数据'));
      return;
    }

    const owner = await ownerService.getById(id);
    if (!owner) {
      logger.warn('owners', '业主不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    const houses = readJsonFile<House[]>('houses.json') || [];
    const ownerHouses = houses.filter(h => h.ownerId === id && h.status !== 'archived');

    logger.info('owners', '查询业主房屋列表', { ownerId: id, count: ownerHouses.length, userId: req.user?.id });
    res.json(successResponse(ownerHouses));
  } catch (error) {
    logger.error('owners', '查询业主房屋列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询业主房屋列表失败'));
  }
});

router.get('/:id/parking', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.role === 'owner' && req.user.ownerId !== id) {
      logger.warn('owners', '业主尝试访问其他业主车位数据', { userId: req.user?.id, targetOwnerId: id });
      res.status(403).json(errorResponse('只能访问自己的数据'));
      return;
    }

    const owner = await ownerService.getById(id);
    if (!owner) {
      logger.warn('owners', '业主不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    const parkingSpots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];
    const ownerParking = parkingSpots.filter(p => p.ownerId === id && p.status !== 'archived');

    logger.info('owners', '查询业主车位列表', { ownerId: id, count: ownerParking.length, userId: req.user?.id });
    res.json(successResponse(ownerParking));
  } catch (error) {
    logger.error('owners', '查询业主车位列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询业主车位列表失败'));
  }
});

router.get('/:id/bills', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.role === 'owner' && req.user.ownerId !== id) {
      logger.warn('owners', '业主尝试访问其他业主账单数据', { userId: req.user?.id, targetOwnerId: id });
      res.status(403).json(errorResponse('只能访问自己的数据'));
      return;
    }

    const owner = await ownerService.getById(id);
    if (!owner) {
      logger.warn('owners', '业主不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('业主不存在'));
      return;
    }

    const bills = readJsonFile<Bill[]>('bills.json') || [];
    const ownerBills = bills.filter(b => b.ownerId === id);

    logger.info('owners', '查询业主账单列表', { ownerId: id, count: ownerBills.length, userId: req.user?.id });
    res.json(successResponse(ownerBills));
  } catch (error) {
    logger.error('owners', '查询业主账单列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询业主账单列表失败'));
  }
});

export default router;
