import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { dbQueryOne } from '../db/db-adapter.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  isSuperAdmin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Standard JWT Access Token Authenticator
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token required. Please login.',
      code: 'AUTH_TOKEN_MISSING',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      message: err.name === 'TokenExpiredError' ? 'Session expired. Please login again.' : 'Invalid authentication token.',
      code: 'AUTH_TOKEN_INVALID',
    });
    return;
  }
}

/**
 * Dedicated Platform Super Admin Guard (Rule #12)
 * Verifies that the authenticated user has explicit `is_super_admin` rights in the database.
 * Business OWNER role is strictly isolated from Platform Super Admin.
 */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required for platform admin access.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    const userRow = await dbQueryOne<any>(
      `SELECT id, email, is_super_admin, is_active FROM users WHERE id = ?`,
      [userId]
    );

    if (!userRow || !userRow.is_active || (userRow.is_super_admin !== 1 && userRow.is_super_admin !== true)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Platform Super Admin privileges required for this endpoint.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
      return;
    }

    req.user!.isSuperAdmin = true;
    next();
  } catch (err: any) {
    console.error('[requirePlatformAdmin Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to verify platform admin authorization.',
    });
  }
}
