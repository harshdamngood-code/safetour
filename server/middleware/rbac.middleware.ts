import { Request, Response, NextFunction } from 'express';

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SALESPERSON' | 'ACCOUNTANT' | 'INVENTORY_STAFF';

/**
 * Role-Based Access Control Guard
 * Verifies if the authenticated tenant user has one of the allowed roles.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentRole = req.tenant?.role;

    if (!currentRole) {
      res.status(403).json({
        success: false,
        message: 'No tenant role assigned.',
        code: 'ROLE_MISSING',
      });
      return;
    }

    if (!allowedRoles.includes(currentRole)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${currentRole}`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    next();
  };
}
