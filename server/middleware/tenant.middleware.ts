import { Request, Response, NextFunction } from 'express';
import { dbQueryOne } from '../db/db-adapter.js';

export interface TenantContext {
  businessId: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'SALESPERSON' | 'ACCOUNTANT' | 'INVENTORY_STAFF';
  permissions: Record<string, boolean>;
  business: {
    id: string;
    business_name: string;
    legal_name?: string;
    business_type: string;
    gstin?: string;
    state: string;
    state_code: string;
    invoice_prefix: string;
    currency: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      businessId?: string;
    }
  }
}

/**
 * Enforces strict multi-tenant isolation.
 * Extracts the requested business ID from headers (X-Business-ID),
 * verifies in the database that the authenticated user has an active membership,
 * and attaches tenant context to the request.
 */
export async function enforceTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'User authentication required prior to tenant resolution.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  // Extract business ID from header or query param
  const businessId = (req.headers['x-business-id'] as string) || (req.query.businessId as string);

  if (!businessId) {
    res.status(400).json({
      success: false,
      message: 'Business ID header (X-Business-ID) is required for tenant-scoped operations.',
      code: 'TENANT_HEADER_MISSING',
    });
    return;
  }

  try {
    // Query database to verify tenant existence and user membership
    const membership = await dbQueryOne<any>(
      `SELECT bu.role, bu.custom_permissions, bu.is_active as member_active,
              b.id as business_id, b.business_name, b.legal_name, b.business_type,
              b.gstin, b.state, b.state_code, b.invoice_prefix, b.currency
       FROM business_users bu
       JOIN businesses b ON bu.business_id = b.id
       WHERE bu.business_id = ? AND bu.user_id = ?`,
      [businessId, userId]
    );

    if (!membership) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You do not have authorization for this business tenant.',
        code: 'TENANT_ACCESS_DENIED',
      });
      return;
    }

    if (!membership.member_active) {
      res.status(403).json({
        success: false,
        message: 'Access denied: Your staff account has been deactivated by the business administrator.',
        code: 'TENANT_ACCOUNT_INACTIVE',
      });
      return;
    }

    let permissions = {};
    try {
      permissions = typeof membership.custom_permissions === 'string'
        ? JSON.parse(membership.custom_permissions || '{}')
        : (membership.custom_permissions || {});
    } catch {
      permissions = {};
    }

    req.businessId = membership.business_id;
    req.tenant = {
      businessId: membership.business_id,
      role: membership.role,
      permissions,
      business: {
        id: membership.business_id,
        business_name: membership.business_name,
        legal_name: membership.legal_name,
        business_type: membership.business_type,
        gstin: membership.gstin,
        state: membership.state,
        state_code: membership.state_code,
        invoice_prefix: membership.invoice_prefix,
        currency: membership.currency || 'INR',
      },
    };

    next();
  } catch (err: any) {
    console.error('[Tenant Middleware Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to verify tenant authorization',
    });
  }
}
