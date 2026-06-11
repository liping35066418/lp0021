import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger } from '../utils/logger.js';
import type { RepairWorker } from '../types/index.js';

const router = Router();

const workerService = new CrudService<RepairWorker>({
  filename: 'repair_workers.json',
  idPrefix: 'worker',
  moduleName: '维修工',
});

type WorkerStatus = 'available' | 'busy' | 'offline';
type WorkerSpecialty = 'electrical' | 'plumbing' | 'structure' | 'appliance' | 'other';

router.get('/', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ...filters } = req.query;
    const result = await workerService.list(
      filters as Record<string, unknown>,
      [],
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20 }
    );
    logger.info('workers', '查询维修工列表', { filters, userId: req.user?.id });
    res.json(successResponse(result.data, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('workers', '查询维修工列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询维修工列表失败'));
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const worker = await workerService.getById(id);

    if (!worker) {
      logger.warn('workers', '维修工不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('维修工不存在'));
      return;
    }

    logger.info('workers', '查询维修工详情', { id, userId: req.user?.id });
    res.json(successResponse(worker));
  } catch (error) {
    logger.error('workers', '查询维修工详情失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询维修工详情失败'));
  }
});

router.post('/', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, specialty } = req.body;

    if (!name || !phone || !specialty) {
      res.status(400).json(errorResponse('缺少必填字段'));
      return;
    }

    const validSpecialties: WorkerSpecialty[] = ['electrical', 'plumbing', 'structure', 'appliance', 'other'];
    if (Array.isArray(specialty)) {
      for (const s of specialty) {
        if (!validSpecialties.includes(s as WorkerSpecialty)) {
          res.status(400).json(errorResponse(`无效的专业类型: ${s}`));
          return;
        }
      }
    } else {
      res.status(400).json(errorResponse('专业必须为数组类型'));
      return;
    }

    const newWorker = await workerService.create(
      {
        name,
        phone,
        specialty,
        status: 'available' as WorkerStatus,
        currentOrderCount: 0,
      },
      req.user?.id
    );

    logger.info('workers', '新增维修工成功', { workerId: newWorker.id, userId: req.user?.id });
    res.status(201).json(successResponse(newWorker));
  } catch (error) {
    logger.error('workers', '新增维修工失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('新增维修工失败'));
  }
});

router.put('/:id', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, specialty, status, currentOrderCount } = req.body;

    const existingWorker = await workerService.getById(id);
    if (!existingWorker) {
      logger.warn('workers', '维修工不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('维修工不存在'));
      return;
    }

    if (specialty !== undefined) {
      const validSpecialties: WorkerSpecialty[] = ['electrical', 'plumbing', 'structure', 'appliance', 'other'];
      if (Array.isArray(specialty)) {
        for (const s of specialty) {
          if (!validSpecialties.includes(s as WorkerSpecialty)) {
            res.status(400).json(errorResponse(`无效的专业类型: ${s}`));
            return;
          }
        }
      } else {
        res.status(400).json(errorResponse('专业必须为数组类型'));
        return;
      }
    }

    if (status !== undefined) {
      const validStatuses: WorkerStatus[] = ['available', 'busy', 'offline'];
      if (!validStatuses.includes(status as WorkerStatus)) {
        res.status(400).json(errorResponse(`无效的状态类型: ${status}`));
        return;
      }
    }

    const updatedWorker = await workerService.update(
      id,
      { name, phone, specialty, status, currentOrderCount },
      req.user?.id
    );

    logger.info('workers', '更新维修工信息成功', { id, userId: req.user?.id });
    res.json(successResponse(updatedWorker));
  } catch (error) {
    logger.error('workers', '更新维修工信息失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('更新维修工信息失败'));
  }
});

router.put('/:id/status', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses: WorkerStatus[] = ['available', 'busy', 'offline'];
    if (!validStatuses.includes(status as WorkerStatus)) {
      res.status(400).json(errorResponse(`无效的状态类型: ${status}`));
      return;
    }

    const existingWorker = await workerService.getById(id);
    if (!existingWorker) {
      logger.warn('workers', '维修工不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('维修工不存在'));
      return;
    }

    const updatedWorker = await workerService.update(
      id,
      { status: status as WorkerStatus },
      req.user?.id
    );

    logger.info('workers', '更新维修工状态成功', { id, status, userId: req.user?.id });
    res.json(successResponse(updatedWorker));
  } catch (error) {
    logger.error('workers', '更新维修工状态失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('更新维修工状态失败'));
  }
});

router.delete('/:id', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingWorker = await workerService.getById(id);
    if (!existingWorker) {
      logger.warn('workers', '维修工不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('维修工不存在'));
      return;
    }

    const deleted = await workerService.remove(id, req.user?.id);
    if (!deleted) {
      logger.warn('workers', '删除维修工失败', { id, userId: req.user?.id });
      res.status(500).json(errorResponse('删除维修工失败'));
      return;
    }

    logger.info('workers', '删除维修工成功', { id, userId: req.user?.id });
    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    logger.error('workers', '删除维修工失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('删除维修工失败'));
  }
});

export default router;
