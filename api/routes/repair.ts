import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger } from '../utils/logger.js';
import { readJsonFile, writeJsonFile } from '../utils/file.js';
import { generateOrderNo, autoAssignWorker, checkRepairOverdue, detectDuplicateRepairOrder, validateOwnerHouseRelation, getWorkerStats, syncWorkerStatusToDb } from '../utils/business.js';
import type { RepairOrder, RepairWorker } from '../types/index.js';

const router = Router();

const repairService = new CrudService<RepairOrder>({
  filename: 'repair_orders.json',
  idPrefix: 'repair',
  moduleName: '报修工单',
});

const FUZZY_FIELDS = ['orderNo', 'title', 'description', 'workerRemark', 'comment'];

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ...filters } = req.query;
    const user = req.user;

    if (!user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const queryFilters: Record<string, unknown> = { ...filters };

    if (user.role === 'owner') {
      queryFilters.ownerId = user.ownerId;
    }

    const result = await repairService.list(
      queryFilters,
      FUZZY_FIELDS,
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20 }
    );
    res.json(successResponse(result.data, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('repair', '查询报修工单列表失败', { error });
    res.status(500).json(errorResponse('查询报修工单列表失败'));
  }
});

router.get('/statistics', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = readJsonFile<RepairOrder[]>('repair_orders.json') || [];

    const statusStats: Record<string, number> = {};
    const typeStats: Record<string, number> = {};
    const priorityStats: Record<string, number> = {};

    orders.forEach(order => {
      statusStats[order.status] = (statusStats[order.status] || 0) + 1;
      typeStats[order.type] = (typeStats[order.type] || 0) + 1;
      priorityStats[order.priority] = (priorityStats[order.priority] || 0) + 1;
    });

    res.json(successResponse({
      status: statusStats,
      type: typeStats,
      priority: priorityStats,
      total: orders.length,
    }));
  } catch (error) {
    logger.error('repair', '查询工单统计失败', { error });
    res.status(500).json(errorResponse('查询工单统计失败'));
  }
});

router.get('/check-overdue', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = readJsonFile<RepairOrder[]>('repair_orders.json') || [];
    const now = new Date().toISOString();
    let updatedCount = 0;
    let overdueCount = 0;

    const updatedOrders = orders.map(order => {
      if (order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'archived') {
        const isOverdue = checkRepairOverdue(order.submitTime, order.priority);
        if (isOverdue !== order.isOverdue) {
          updatedCount++;
          if (isOverdue) {
            overdueCount++;
          }
          return {
            ...order,
            isOverdue,
            updatedAt: now,
          };
        }
      }
      return order;
    });

    writeJsonFile('repair_orders.json', updatedOrders);

    logger.info('repair', '检查工单超时完成', { userId: req.user?.id, updatedCount, overdueCount });

    res.json(successResponse({
      updatedCount,
      overdueCount,
      message: `检查完成，更新了${updatedCount}个工单状态，发现${overdueCount}个超时工单`,
    }));
  } catch (error) {
    logger.error('repair', '检查工单超时失败', { error });
    res.status(500).json(errorResponse('检查工单超时失败'));
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const order = await repairService.getById(id);

    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (user.role === 'owner' && order.ownerId !== user.ownerId) {
      res.status(403).json(errorResponse('只能访问自己的报修工单'));
      return;
    }

    res.json(successResponse(order));
  } catch (error) {
    logger.error('repair', '查询报修工单详情失败', { error });
    res.status(500).json(errorResponse('查询报修工单详情失败'));
  }
});

router.post('/', authenticateToken, requireRoles('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { houseId, type, title, description, priority, images } = req.body;
    const user = req.user;

    if (!user || !user.ownerId) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    if (!houseId || !type || !title || !description || !priority) {
      res.status(400).json(errorResponse('缺少必要信息'));
      return;
    }

    const isValidRelation = await validateOwnerHouseRelation(user.ownerId, houseId);
    if (!isValidRelation) {
      res.status(400).json(errorResponse('您与该房屋无关联关系'));
      return;
    }

    const isDuplicate = detectDuplicateRepairOrder(user.ownerId, houseId, title, description, 24);
    if (isDuplicate) {
      res.status(400).json(errorResponse('24小时内已存在相同类型的报修工单，请耐心等待处理'));
      return;
    }

    const orderNo = generateOrderNo('BX');
    const workerId = await autoAssignWorker(type, houseId);
    const now = new Date().toISOString();

    const newOrder = await repairService.create(
      {
        orderNo,
        ownerId: user.ownerId,
        houseId,
        type,
        title,
        description,
        images: images || [],
        status: workerId ? 'assigned' : 'pending',
        priority,
        workerId: workerId || undefined,
        assignTime: workerId ? now : undefined,
        submitTime: now,
        isOverdue: false,
        overdueReminderCount: 0,
      },
      user.id
    );

    if (workerId) {
      const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];
      const workerIndex = workers.findIndex(w => w.id === workerId);
      if (workerIndex !== -1) {
        workers[workerIndex].currentOrderCount += 1;
        writeJsonFile('repair_workers.json', workers);
      }
    }

    res.status(201).json(successResponse(newOrder));
  } catch (error) {
    logger.error('repair', '提交报修工单失败', { error });
    res.status(500).json(errorResponse('提交报修工单失败'));
  }
});

router.put('/:id/assign', authenticateToken, requireRoles('super_admin', 'property_staff'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;
    const user = req.user;

    if (!workerId) {
      res.status(400).json(errorResponse('请指定维修工ID'));
      return;
    }

    const order = await repairService.getById(id);
    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (order.status === 'cancelled' || order.status === 'archived') {
      res.status(400).json(errorResponse('已取消或已归档的工单不能派单'));
      return;
    }

    const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];
    const newWorker = workers.find(w => w.id === workerId);
    if (!newWorker) {
      res.status(404).json(errorResponse('维修工不存在'));
      return;
    }

    const newWorkerStats = getWorkerStats(workerId);
    if (newWorkerStats.effectiveStatus === 'offline') {
      res.status(400).json(errorResponse('该维修工已离线，无法派单'));
      return;
    }

    if (order.workerId && order.workerId !== workerId) {
      const oldWorkerIndex = workers.findIndex(w => w.id === order.workerId);
      if (oldWorkerIndex !== -1 && workers[oldWorkerIndex].currentOrderCount > 0) {
        workers[oldWorkerIndex].currentOrderCount -= 1;
      }
    }

    const newWorkerIndex = workers.findIndex(w => w.id === workerId);
    if (newWorkerIndex !== -1) {
      workers[newWorkerIndex].currentOrderCount += 1;
    }

    writeJsonFile('repair_workers.json', workers);

    if (order.workerId && order.workerId !== workerId) {
      syncWorkerStatusToDb(order.workerId);
    }
    syncWorkerStatusToDb(workerId);

    const now = new Date().toISOString();
    const updatedOrder = await repairService.update(
      id,
      {
        workerId,
        status: 'assigned',
        assignTime: now,
      },
      user?.id
    );

    res.json(successResponse(updatedOrder));
  } catch (error) {
    logger.error('repair', '派单失败', { error });
    res.status(500).json(errorResponse('派单失败'));
  }
});

router.put('/:id/start', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const order = await repairService.getById(id);
    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (order.status !== 'assigned') {
      res.status(400).json(errorResponse('只能开始处理已派单的工单'));
      return;
    }

    if (order.workerId && user.role === 'owner') {
      res.status(403).json(errorResponse('只有维修工可以开始处理工单'));
      return;
    }

    if (order.workerId && user.role !== 'super_admin' && user.role !== 'property_staff') {
      if (order.workerId !== user.id) {
        res.status(403).json(errorResponse('只能开始处理分配给您的工单'));
        return;
      }
    }

    const now = new Date().toISOString();
    const updatedOrder = await repairService.update(
      id,
      {
        status: 'in_progress',
        startWorkTime: now,
      },
      user.id
    );

    res.json(successResponse(updatedOrder));
  } catch (error) {
    logger.error('repair', '开始处理工单失败', { error });
    res.status(500).json(errorResponse('开始处理工单失败'));
  }
});

router.put('/:id/complete', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { workerRemark } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const order = await repairService.getById(id);
    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (order.status !== 'in_progress') {
      res.status(400).json(errorResponse('只能完成处理中的工单'));
      return;
    }

    if (order.workerId && user.role === 'owner') {
      res.status(403).json(errorResponse('只有维修工可以完成工单'));
      return;
    }

    if (order.workerId && user.role !== 'super_admin' && user.role !== 'property_staff') {
      if (order.workerId !== user.id) {
        res.status(403).json(errorResponse('只能完成分配给您的工单'));
        return;
      }
    }

    const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];
    if (order.workerId) {
      const workerIndex = workers.findIndex(w => w.id === order.workerId);
      if (workerIndex !== -1 && workers[workerIndex].currentOrderCount > 0) {
        workers[workerIndex].currentOrderCount -= 1;
        writeJsonFile('repair_workers.json', workers);
        syncWorkerStatusToDb(order.workerId);
      }
    }

    const now = new Date().toISOString();
    const updatedOrder = await repairService.update(
      id,
      {
        status: 'completed',
        completeTime: now,
        workerRemark: workerRemark || '',
      },
      user.id
    );

    res.json(successResponse(updatedOrder));
  } catch (error) {
    logger.error('repair', '完成工单失败', { error });
    res.status(500).json(errorResponse('完成工单失败'));
  }
});

router.put('/:id/accept', authenticateToken, requireRoles('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user = req.user;

    if (!user || !user.ownerId) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const order = await repairService.getById(id);
    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (order.status !== 'completed') {
      res.status(400).json(errorResponse('只能验收已完成的工单'));
      return;
    }

    if (order.ownerId !== user.ownerId) {
      res.status(403).json(errorResponse('只能验收自己的报修工单'));
      return;
    }

    const now = new Date().toISOString();
    const updatedOrder = await repairService.update(
      id,
      {
        status: 'archived',
        acceptTime: now,
        rating: rating ? Number(rating) : undefined,
        comment: comment || '',
      },
      user.id
    );

    res.json(successResponse(updatedOrder));
  } catch (error) {
    logger.error('repair', '验收工单失败', { error });
    res.status(500).json(errorResponse('验收工单失败'));
  }
});

router.put('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancelReason } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    if (!cancelReason) {
      res.status(400).json(errorResponse('请填写取消原因'));
      return;
    }

    const order = await repairService.getById(id);
    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (order.status === 'completed' || order.status === 'archived') {
      res.status(400).json(errorResponse('已完成或已归档的工单不能取消'));
      return;
    }

    if (user.role === 'owner' && order.ownerId !== user.ownerId) {
      res.status(403).json(errorResponse('只能取消自己的报修工单'));
      return;
    }

    const workers = readJsonFile<RepairWorker[]>('repair_workers.json') || [];
    if (order.workerId && order.status !== 'pending') {
      const workerIndex = workers.findIndex(w => w.id === order.workerId);
      if (workerIndex !== -1 && workers[workerIndex].currentOrderCount > 0) {
        workers[workerIndex].currentOrderCount -= 1;
        writeJsonFile('repair_workers.json', workers);
        syncWorkerStatusToDb(order.workerId);
      }
    }

    const updatedOrder = await repairService.update(
      id,
      {
        status: 'cancelled',
        cancelReason,
      },
      user.id
    );

    res.json(successResponse(updatedOrder));
  } catch (error) {
    logger.error('repair', '取消工单失败', { error });
    res.status(500).json(errorResponse('取消工单失败'));
  }
});

router.put('/:id/reminder', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const order = await repairService.getById(id);
    if (!order) {
      res.status(404).json(errorResponse('报修工单不存在'));
      return;
    }

    if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'archived') {
      res.status(400).json(errorResponse('已完成、已取消或已归档的工单不能触发提醒'));
      return;
    }

    if (user.role === 'owner' && order.ownerId !== user.ownerId) {
      res.status(403).json(errorResponse('只能对自己的报修工单触发提醒'));
      return;
    }

    const updatedOrder = await repairService.update(
      id,
      {
        overdueReminderCount: order.overdueReminderCount + 1,
      },
      user.id
    );

    logger.info('repair', '触发超时提醒', { userId: user.id, orderId: id, count: order.overdueReminderCount + 1 });

    res.json(successResponse(updatedOrder));
  } catch (error) {
    logger.error('repair', '触发超时提醒失败', { error });
    res.status(500).json(errorResponse('触发超时提醒失败'));
  }
});

export default router;
