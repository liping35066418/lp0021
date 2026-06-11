import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, requireOwnerOrAdmin, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger } from '../utils/logger.js';
import { readJsonFile, writeJsonFile } from '../utils/file.js';
import { cleanImportData } from '../utils/business.js';
import type { House } from '../types/index.js';

const router = Router();

const houseService = new CrudService<House>({
  filename: 'houses.json',
  idPrefix: 'house',
  moduleName: '房屋',
});

const FUZZY_FIELDS = ['building', 'unit', 'roomNumber', 'houseType', 'remark'];
const REQUIRED_IMPORT_FIELDS = ['building', 'unit', 'roomNumber', 'floor', 'area', 'houseType'];

router.get('/', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ...filters } = req.query;
    const result = await houseService.list(
      filters as Record<string, unknown>,
      FUZZY_FIELDS,
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20 }
    );
    res.json(successResponse(result.data, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('houses', '查询房屋列表失败', { error });
    res.status(500).json(errorResponse('查询房屋列表失败'));
  }
});

router.get('/:id', authenticateToken, requireOwnerOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const house = await houseService.getById(id);
    
    if (!house) {
      res.status(404).json(errorResponse('房屋不存在'));
      return;
    }

    if (req.user?.role === 'owner' && house.ownerId !== req.user.ownerId) {
      res.status(403).json(errorResponse('只能访问自己的房屋数据'));
      return;
    }

    res.json(successResponse(house));
  } catch (error) {
    logger.error('houses', '查询房屋详情失败', { error });
    res.status(500).json(errorResponse('查询房屋详情失败'));
  }
});

router.post('/', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { building, unit, roomNumber, floor, area, houseType, ownerId, status, remark } = req.body;

    if (!building || !unit || !roomNumber || !floor || !area || !houseType) {
      res.status(400).json(errorResponse('缺少必要信息'));
      return;
    }

    const houses = readJsonFile<House[]>('houses.json') || [];
    const exists = houses.find(
      h => h.building === building && h.unit === unit && h.roomNumber === roomNumber && h.status !== 'archived'
    );

    if (exists) {
      res.status(400).json(errorResponse('该楼栋单元房号已存在'));
      return;
    }

    const houseStatus = ownerId ? (status || 'occupied') : 'vacant';

    const newHouse = await houseService.create(
      {
        building,
        unit,
        roomNumber,
        floor: Number(floor),
        area: Number(area),
        houseType,
        ownerId: ownerId || '',
        status: houseStatus,
        remark,
      },
      req.user?.id
    );

    res.status(201).json(successResponse(newHouse));
  } catch (error) {
    logger.error('houses', '新增房屋失败', { error });
    res.status(500).json(errorResponse('新增房屋失败'));
  }
});

router.put('/:id', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { building, unit, roomNumber, ownerId, status, ...updateData } = req.body;

    const existingHouse = await houseService.getById(id);
    if (!existingHouse) {
      res.status(404).json(errorResponse('房屋不存在'));
      return;
    }

    if (building || unit || roomNumber) {
      const houses = readJsonFile<House[]>('houses.json') || [];
      const checkBuilding = building || existingHouse.building;
      const checkUnit = unit || existingHouse.unit;
      const checkRoomNumber = roomNumber || existingHouse.roomNumber;
      
      const exists = houses.find(
        h => h.id !== id && 
             h.building === checkBuilding && 
             h.unit === checkUnit && 
             h.roomNumber === checkRoomNumber && 
             h.status !== 'archived'
      );

      if (exists) {
        res.status(400).json(errorResponse('该楼栋单元房号已存在'));
        return;
      }
    }

    const updateDataToSend: Partial<House> = {
      ...updateData,
    };

    if (building !== undefined) updateDataToSend.building = building;
    if (unit !== undefined) updateDataToSend.unit = unit;
    if (roomNumber !== undefined) updateDataToSend.roomNumber = roomNumber;
    if (ownerId !== undefined) updateDataToSend.ownerId = ownerId;
    if (status !== undefined) updateDataToSend.status = status;

    if (ownerId === '' && !status) {
      updateDataToSend.status = 'vacant';
    }

    const updatedHouse = await houseService.update(id, updateDataToSend, req.user?.id);
    res.json(successResponse(updatedHouse));
  } catch (error) {
    logger.error('houses', '更新房屋失败', { error });
    res.status(500).json(errorResponse('更新房屋失败'));
  }
});

router.put('/:id/archive', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const house = await houseService.getById(id);
    
    if (!house) {
      res.status(404).json(errorResponse('房屋不存在'));
      return;
    }

    const archivedHouse = await houseService.archive(id, req.user?.id);
    res.json(successResponse(archivedHouse));
  } catch (error) {
    logger.error('houses', '归档房屋失败', { error });
    res.status(500).json(errorResponse('归档房屋失败'));
  }
});

router.post('/batch-import', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json(errorResponse('导入数据不能为空'));
      return;
    }

    const { valid, invalid } = cleanImportData<Record<string, unknown>>(data, REQUIRED_IMPORT_FIELDS);
    
    const houses = readJsonFile<House[]>('houses.json') || [];
    const now = new Date().toISOString();
    let successCount = 0;
    let duplicateCount = 0;
    const duplicates: { row: Record<string, unknown>; rowIndex: number }[] = [];

    valid.forEach((row, index) => {
      const rowData = row as Partial<House>;
      const exists = houses.find(
        h => h.building === rowData.building && 
             h.unit === rowData.unit && 
             h.roomNumber === rowData.roomNumber && 
             h.status !== 'archived'
      );

      if (exists) {
        duplicateCount++;
        duplicates.push({ row, rowIndex: index });
        return;
      }

      const houseStatus = rowData.ownerId ? ((rowData.status as House['status']) || 'occupied') : 'vacant';

      const newHouse: House = {
        ...rowData,
        building: rowData.building || '',
        unit: rowData.unit || '',
        roomNumber: rowData.roomNumber || '',
        floor: Number(rowData.floor),
        area: Number(rowData.area),
        ownerId: rowData.ownerId || '',
        status: houseStatus,
        houseType: rowData.houseType || '',
        id: `house_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        createdAt: now,
        updatedAt: now,
      };

      houses.push(newHouse);
      successCount++;
    });

    writeJsonFile('houses.json', houses);

    logger.info('houses', '批量导入房屋', { userId: req.user?.id, total: data.length, success: successCount, duplicate: duplicateCount, invalid: invalid.length });

    res.json(successResponse({
      total: data.length,
      success: successCount,
      duplicate: duplicateCount,
      invalid: invalid.length,
      invalidRecords: invalid,
      duplicateRecords: duplicates,
    }));
  } catch (error) {
    logger.error('houses', '批量导入房屋失败', { error });
    res.status(500).json(errorResponse('批量导入房屋失败'));
  }
});

export default router;
