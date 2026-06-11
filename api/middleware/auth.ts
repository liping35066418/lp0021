import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export interface JwtPayload {
  id: string;
  username: string;
  role: UserRole;
  ownerId?: string;
}

export type UserRole = 'super_admin' | 'property_staff' | 'owner';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'property_management_secret_key_2026';

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: '未提供认证令牌' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('auth', '令牌验证失败', { error });
    res.status(403).json({ success: false, error: '无效的认证令牌' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未认证' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('auth', '权限不足', { userId: req.user.id, requiredRoles: roles, userRole: req.user.role });
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }

    next();
  };
}

export function requireOwnerOrAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }

  if (req.user.role === 'owner') {
    const ownerId = req.params.ownerId || req.query.ownerId || req.body.ownerId;
    if (ownerId && ownerId !== req.user.ownerId) {
      logger.warn('auth', '业主尝试访问其他业主数据', { userId: req.user.id, targetOwnerId: ownerId });
      res.status(403).json({ success: false, error: '只能访问自己的数据' });
      return;
    }
  }

  next();
}
