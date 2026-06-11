import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, requireOwnerOrAdmin, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger } from '../utils/logger.js';
import { readJsonFile, writeJsonFile } from '../utils/file.js';
import { cleanImportData } from '../utils/business.js';
import type { ParkingSpot, Owner } from '../types/index.js';

const router = Router();

const parkingService = new CrudService<ParkingSpot>({
  filename: 'parking_spots.json',
  idPrefix: 'parking',
  moduleName: '车位',
});

const fuzzyFields = ['spotNumber', 'area', 'remark'];
const requiredImportFields = ['spotNumber', 'area', 'type', 'monthlyFee'];

router.use(authenticateToken);

router.get('/', requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { spotNumber, area, type, status, ownerId, page, pageSize } = req.query;
    const filters: Record<string, unknown> = {};
    
    if (spotNumber) filters.spotNumber = spotNumber;
    if (area) filters.area = area;
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (ownerId) filters.ownerId = ownerId;

    const result = await parkingService.list(
      filters,
      fuzzyFields,
      { page: Number(page), pageSize: Number(pageSize) }
    );

    res.json(successResponse(result.data, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('parking', '查询车位列表失败', { error });
    res.status(500).json(errorResponse('查询车位列表失败'));
  }
});

router.get('/:id', requireOwnerOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const spot = await parkingService.getById(id);

    if (!spot) {
      res.status(404).json(errorResponse('车位不存在'));
      return;
    }

    if (req.user?.role === 'owner' && spot.ownerId !== req.user.ownerId) {
      res.status(403).json(errorResponse('只能访问自己的车位信息'));
      return;
    }

    res.json(successResponse(spot));
  } catch (error) {
    logger.error('parking', '查询车位详情失败', { error });
    res.status(500).json(errorResponse('查询车位详情失败'));
  }
});

router.post('/', requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { spotNumber, area, type, ownerId, monthlyFee, remark } = req.body;

    if (!spotNumber || !area || !type || monthlyFee === undefined) {
      res.status(400).json(errorResponse('缺少必要字段'));
      return;
    }

    const existingSpots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];
    if (existingSpots.find(s => s.spotNumber === spotNumber && s.status !== 'archived')) {
      res.status(400).json(errorResponse('车位号已存在'));
      return;
    }

    if (ownerId) {
      const owners = readJsonFile<Owner[]>('owners.json') || [];
      if (!owners.find(o => o.id === ownerId)) {
        res.status(400).json(errorResponse('关联的业主不存在'));
        return;
      }
    }

    const status = ownerId ? 'occupied' : 'available';

    const newSpot = await parkingService.create(
      { spotNumber, area, type, ownerId, status, monthlyFee, remark },
      req.user?.id
    );

    res.status(201).json(successResponse(newSpot));
  } catch (error) {
    logger.error('parking', '新增车位失败', { error });
    res.status(500).json(errorResponse('新增车位失败'));
  }
});

router.put('/:id', requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { spotNumber, area, type, ownerId, status, monthlyFee, remark } = req.body;

    const existingSpot = await parkingService.getById(id);
    if (!existingSpot) {
      res.status(404).json(errorResponse('车位不存在'));
      return;
    }

    if (spotNumber && spotNumber !== existingSpot.spotNumber) {
      const allSpots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];
      if (allSpots.find(s => s.spotNumber === spotNumber && s.id !== id && s.status !== 'archived')) {
        res.status(400).json(errorResponse('车位号已存在'));
        return;
      }
    }

    if (ownerId && ownerId !== existingSpot.ownerId) {
      const owners = readJsonFile<Owner[]>('owners.json') || [];
      if (!owners.find(o => o.id === ownerId)) {
        res.status(400).json(errorResponse('关联的业主不存在'));
        return;
      }
    }

    const updateData: Partial<ParkingSpot> = {};
    if (spotNumber !== undefined) updateData.spotNumber = spotNumber;
    if (area !== undefined) updateData.area = area;
    if (type !== undefined) updateData.type = type;
    if (ownerId !== undefined) updateData.ownerId = ownerId;
    if (status !== undefined) updateData.status = status;
    if (monthlyFee !== undefined) updateData.monthlyFee = monthlyFee;
    if (remark !== undefined) updateData.remark = remark;

    if (ownerId !== undefined && !ownerId && !status) {
      updateData.status = 'available';
    }

    if (ownerId && !status && existingSpot.status === 'available') {
      updateData.status = 'occupied';
    }

    const updatedSpot = await parkingService.update(id, updateData, req.user?.id);
    res.json(successResponse(updatedSpot));
  } catch (error) {
    logger.error('parking', '更新车位失败', { error });
    res.status(500).json(errorResponse('更新车位失败'));
  }
});

router.put('/:id/archive', requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const archivedSpot = await parkingService.archive(id, req.user?.id);

    if (!archivedSpot) {
      res.status(404).json(errorResponse('车位不存在'));
      return;
    }

    res.json(successResponse(archivedSpot));
  } catch (error) {
    logger.error('parking', '归档车位失败', { error });
    res.status(500).json(errorResponse('归档车位失败'));
  }
});

router.post('/batch-import', requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data)) {
      res.status(400).json(errorResponse('导入数据必须是数组格式'));
      return;
    }

    const { valid, invalid } = cleanImportData<Record<string, unknown>>(data, requiredImportFields);

    const existingSpots = readJsonFile<ParkingSpot[]>('parking_spots.json') || [];
    const owners = readJsonFile<Owner[]>('owners.json') || [];
    const imported: ParkingSpot[] = [];
    const duplicates: { row: Record<string, unknown>; rowIndex: number }[] = [];
    const ownerErrors: { row: Record<string, unknown>; rowIndex: number; error: string }[] = [];

    const now = new Date().toISOString();
    valid.forEach((row, index) => {
      const rowData = row as Partial<ParkingSpot>;
      const originalIndex = data.indexOf(row);
      
      const isDuplicate = existingSpots.some(s => s.spotNumber === rowData.spotNumber && s.status !== 'archived') ||
        imported.some(s => s.spotNumber === rowData.spotNumber);
      
      if (isDuplicate) {
        duplicates.push({ row, rowIndex: originalIndex });
        return;
      }

      if (rowData.ownerId && !owners.find(o => o.id === rowData.ownerId)) {
        ownerErrors.push({ row, rowIndex: originalIndex, error: '关联的业主不存在' });
        return;
      }

      const status = rowData.ownerId ? 'occupied' : 'available';
      imported.push({
        spotNumber: rowData.spotNumber || '',
        area: rowData.area || '',
        type: rowData.type || 'ground',
        monthlyFee: rowData.monthlyFee || 0,
        ownerId: rowData.ownerId,
        remark: rowData.remark,
        id: `parking_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        status,
        createdAt: now,
        updatedAt: now,
      });
    });

    const allSpots = [...existingSpots, ...imported];
    writeJsonFile('parking_spots.json', allSpots);

    imported.forEach(spot => {
      logger.info('parking', '批量导入车位', { id: spot.id, spotNumber: spot.spotNumber });
    });

    const stats = {
      total: data.length,
      imported: imported.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      ownerErrors: ownerErrors.length,
      invalidDetails: invalid,
      duplicateDetails: duplicates,
      ownerErrorDetails: ownerErrors,
    };

    res.json(successResponse(stats));
  } catch (error) {
    logger.error('parking', '批量导入车位失败', { error });
    res.status(500).json(errorResponse('批量导入车位失败'));
  }
});

export default router;
