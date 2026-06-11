import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRoles, type AuthRequest } from '../middleware/auth.js';
import { CrudService, successResponse, errorResponse } from '../utils/crud.js';
import { logger } from '../utils/logger.js';
import { readJsonFile, writeJsonFile, generateId } from '../utils/file.js';
import bcrypt from 'bcryptjs';
import type { User } from '../types/index.js';

const router = Router();

const userService = new CrudService<User>({
  filename: 'users.json',
  idPrefix: 'user',
  moduleName: '用户',
});

const FUZZY_FIELDS = ['username', 'name', 'phone', 'email'];

type UserRole = 'super_admin' | 'property_staff' | 'owner';
type UserStatus = 'active' | 'inactive';

function excludePassword(user: User): Omit<User, 'password'> {
  const { password: _pwd, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

router.get('/', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, pageSize, ...filters } = req.query;
    const result = await userService.list(
      filters as Record<string, unknown>,
      FUZZY_FIELDS,
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20 }
    );
    const dataWithoutPassword = result.data.map(excludePassword);
    logger.info('users', '查询用户列表', { filters, userId: req.user?.id });
    res.json(successResponse(dataWithoutPassword, { total: result.total, page: result.page, pageSize: result.pageSize }));
  } catch (error) {
    logger.error('users', '查询用户列表失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询用户列表失败'));
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userService.getById(id);

    if (!user) {
      logger.warn('users', '用户不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('用户不存在'));
      return;
    }

    if (req.user?.role !== 'super_admin' && req.user?.id !== id) {
      logger.warn('users', '用户尝试访问其他用户数据', { userId: req.user?.id, targetUserId: id });
      res.status(403).json(errorResponse('只能访问自己的数据'));
      return;
    }

    logger.info('users', '查询用户详情', { id, userId: req.user?.id });
    res.json(successResponse(excludePassword(user)));
  } catch (error) {
    logger.error('users', '查询用户详情失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('查询用户详情失败'));
  }
});

router.post('/', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, role, name, phone, email, ownerId, status } = req.body;

    if (!username || !password || !role || !name || !phone) {
      res.status(400).json(errorResponse('缺少必填字段'));
      return;
    }

    const validRoles: UserRole[] = ['super_admin', 'property_staff', 'owner'];
    if (!validRoles.includes(role as UserRole)) {
      res.status(400).json(errorResponse(`无效的角色类型: ${role}`));
      return;
    }

    if (status !== undefined) {
      const validStatuses: UserStatus[] = ['active', 'inactive'];
      if (!validStatuses.includes(status as UserStatus)) {
        res.status(400).json(errorResponse(`无效的状态类型: ${status}`));
        return;
      }
    }

    const existingUsers = readJsonFile<User[]>('users.json') || [];
    const duplicateUsername = existingUsers.find(u => u.username === username);
    if (duplicateUsername) {
      logger.warn('users', '用户名已存在', { username, userId: req.user?.id });
      res.status(400).json(errorResponse('用户名已存在'));
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userService.create(
      {
        username,
        password: hashedPassword,
        role: role as UserRole,
        name,
        phone,
        email,
        ownerId,
        status: (status || 'active') as UserStatus,
      },
      req.user?.id
    );

    logger.info('users', '新增用户成功', { id: newUser.id, username, operatorId: req.user?.id });
    res.status(201).json(successResponse(excludePassword(newUser)));
  } catch (error) {
    logger.error('users', '新增用户失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('新增用户失败'));
  }
});

router.put('/:id', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, role, name, phone, email, ownerId, status } = req.body;

    const existingUser = await userService.getById(id);
    if (!existingUser) {
      logger.warn('users', '用户不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('用户不存在'));
      return;
    }

    if (role !== undefined) {
      const validRoles: UserRole[] = ['super_admin', 'property_staff', 'owner'];
      if (!validRoles.includes(role as UserRole)) {
        res.status(400).json(errorResponse(`无效的角色类型: ${role}`));
        return;
      }
    }

    if (status !== undefined) {
      const validStatuses: UserStatus[] = ['active', 'inactive'];
      if (!validStatuses.includes(status as UserStatus)) {
        res.status(400).json(errorResponse(`无效的状态类型: ${status}`));
        return;
      }
    }

    if (username !== undefined && username !== existingUser.username) {
      const existingUsers = readJsonFile<User[]>('users.json') || [];
      const duplicateUsername = existingUsers.find(u => u.username === username && u.id !== id);
      if (duplicateUsername) {
        logger.warn('users', '用户名已存在', { username, userId: req.user?.id });
        res.status(400).json(errorResponse('用户名已存在'));
        return;
      }
    }

    const updatedUser = await userService.update(
      id,
      { username, role, name, phone, email, ownerId, status },
      req.user?.id
    );

    logger.info('users', '更新用户信息成功', { id, userId: req.user?.id });
    res.json(successResponse(excludePassword(updatedUser!)));
  } catch (error) {
    logger.error('users', '更新用户信息失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('更新用户信息失败'));
  }
});

router.put('/:id/password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      res.status(400).json(errorResponse('缺少新密码'));
      return;
    }

    if (req.user?.role !== 'super_admin' && req.user?.id !== id) {
      logger.warn('users', '用户尝试修改其他用户密码', { userId: req.user?.id, targetUserId: id });
      res.status(403).json(errorResponse('只能修改自己的密码'));
      return;
    }

    const existingUser = await userService.getById(id);
    if (!existingUser) {
      logger.warn('users', '用户不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('用户不存在'));
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await userService.update(
      id,
      { password: hashedPassword },
      req.user?.id
    );

    logger.info('users', '修改密码成功', { id, userId: req.user?.id });
    res.json(successResponse(excludePassword(updatedUser!)));
  } catch (error) {
    logger.error('users', '修改密码失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('修改密码失败'));
  }
});

router.put('/:id/status', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses: UserStatus[] = ['active', 'inactive'];
    if (!validStatuses.includes(status as UserStatus)) {
      res.status(400).json(errorResponse(`无效的状态类型: ${status}`));
      return;
    }

    const existingUser = await userService.getById(id);
    if (!existingUser) {
      logger.warn('users', '用户不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('用户不存在'));
      return;
    }

    const updatedUser = await userService.update(
      id,
      { status: status as UserStatus },
      req.user?.id
    );

    logger.info('users', '更新用户状态成功', { id, status, userId: req.user?.id });
    res.json(successResponse(excludePassword(updatedUser!)));
  } catch (error) {
    logger.error('users', '更新用户状态失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('更新用户状态失败'));
  }
});

router.delete('/:id', authenticateToken, requireRoles('super_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingUser = await userService.getById(id);
    if (!existingUser) {
      logger.warn('users', '用户不存在', { id, userId: req.user?.id });
      res.status(404).json(errorResponse('用户不存在'));
      return;
    }

    const deleted = await userService.remove(id, req.user?.id);
    if (!deleted) {
      logger.warn('users', '删除用户失败', { id, userId: req.user?.id });
      res.status(500).json(errorResponse('删除用户失败'));
      return;
    }

    logger.info('users', '删除用户成功', { id, userId: req.user?.id });
    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    logger.error('users', '删除用户失败', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('删除用户失败'));
  }
});

export default router;
