import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readJsonFile, writeJsonFile, generateId } from '../utils/file.js';
import { logger, logOperation } from '../utils/logger.js';
import { authenticateToken, type AuthRequest, type JwtPayload } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/crud.js';
import type { User, Owner } from '../types/index.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'property_management_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json(errorResponse('用户名和密码不能为空'));
      return;
    }

    const users = readJsonFile<User[]>('users.json') || [];
    const user = users.find(u => u.username === username && u.status === 'active');

    if (!user) {
      logger.warn('auth', '用户不存在或已禁用', { username });
      res.status(401).json(errorResponse('用户名或密码错误'));
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('auth', '密码错误', { username, userId: user.id });
      res.status(401).json(errorResponse('用户名或密码错误'));
      return;
    }

    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      ownerId: user.ownerId,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });

    logOperation('auth', 'login', user.id, { username });
    logger.info('auth', '用户登录成功', { userId: user.id, username });

    const { password: _pwd, ...userWithoutPassword } = user;

    res.json(
      successResponse({
        token,
        user: userWithoutPassword,
      })
    );
  } catch (error) {
    logger.error('auth', '登录失败', { error });
    res.status(500).json(errorResponse('登录失败'));
  }
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, name, phone, role = 'owner', ownerId } = req.body;

    if (!username || !password || !name || !phone) {
      res.status(400).json(errorResponse('缺少必要信息'));
      return;
    }

    const users = readJsonFile<User[]>('users.json') || [];

    if (users.find(u => u.username === username)) {
      res.status(400).json(errorResponse('用户名已存在'));
      return;
    }

    if (role === 'owner' && ownerId) {
      const owners = readJsonFile<Owner[]>('owners.json') || [];
      if (!owners.find(o => o.id === ownerId)) {
        res.status(400).json(errorResponse('关联的业主不存在'));
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const newUser: User = {
      id: generateId('user'),
      username,
      password: hashedPassword,
      role,
      name,
      phone,
      status: 'active',
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    users.push(newUser);
    writeJsonFile('users.json', users);

    logOperation('auth', 'register', newUser.id, { username });
    logger.info('auth', '用户注册成功', { userId: newUser.id, username });

    const { password: _pwd, ...userWithoutPassword } = newUser;

    res.status(201).json(successResponse(userWithoutPassword));
  } catch (error) {
    logger.error('auth', '注册失败', { error });
    res.status(500).json(errorResponse('注册失败'));
  }
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      logOperation('auth', 'logout', req.user.id);
      logger.info('auth', '用户登出', { userId: req.user.id });
    }
    res.json(successResponse({ message: '登出成功' }));
  } catch (error) {
    logger.error('auth', '登出失败', { error });
    res.status(500).json(errorResponse('登出失败'));
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse('未认证'));
      return;
    }

    const users = readJsonFile<User[]>('users.json') || [];
    const user = users.find(u => u.id === req.user?.id);

    if (!user) {
      res.status(404).json(errorResponse('用户不存在'));
      return;
    }

    const { password: _pwd, ...userWithoutPassword } = user;
    res.json(successResponse(userWithoutPassword));
  } catch (error) {
    logger.error('auth', '获取用户信息失败', { error });
    res.status(500).json(errorResponse('获取用户信息失败'));
  }
});

export default router;
