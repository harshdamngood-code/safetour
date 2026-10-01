import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { dbQueryOne, dbQueryAll, dbRun, withTransaction } from '../../db/db-adapter.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

export const businessRouter = Router();

const CreateBusinessSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  legalName: z.string().optional(),
  businessType: z.string().min(2, 'Business type required'),
  businessCategory: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid 15-character GSTIN format').optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid 10-character PAN format').optional().or(z.literal('')),
  phone: z.string().min(10, 'Valid contact phone required'),
  email: z.string().email('Valid business email required').optional().or(z.literal('')),
  addressLine1: z.string().min(3, 'Address line 1 required'),
  addressLine2: z.string().optional(),
  city: z.string().min(2, 'City required'),
  state: z.string().min(2, 'State required'),
  stateCode: z.string().length(2, '2-digit state code required'),
  pincode: z.string().min(6, 'Pincode must be 6 digits'),
  currency: z.string().default('INR'),
  invoicePrefix: z.string().default('INV'),
  termsAndConditions: z.string().optional(),
});

/**
 * GET /api/business
 * Returns active business tenant details.
 */
businessRouter.get('/', authenticateToken, enforceTenant, async (req: Request, res: Response): Promise<void> => {
  try {
    const business = await dbQueryOne<any>(
      `SELECT * FROM businesses WHERE id = ?`,
      [req.businessId]
    );

    if (!business) {
      res.status(404).json({ success: false, message: 'Business not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...business,
        currentRole: req.tenant?.role,
        permissions: req.tenant?.permissions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch business details' });
  }
});

/**
 * POST /api/business
 * Creates a brand new business tenant and assigns authenticated user as OWNER.
 */
businessRouter.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CreateBusinessSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: parseResult.error.issues[0]?.message || 'Validation failed',
        errors: parseResult.error.issues,
      });
      return;
    }

    const data = parseResult.data;
    const userId = req.user!.userId;
    const businessId = uuidv4();
    const now = new Date().toISOString();

    await withTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO businesses (
          id, owner_id, business_name, legal_name, business_type, business_category,
          gstin, pan, phone, email, address_line1, address_line2, city, state, state_code,
          pincode, currency, invoice_prefix, invoice_next_number, terms_and_conditions,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [
          businessId,
          userId,
          data.businessName,
          data.legalName || data.businessName,
          data.businessType,
          data.businessCategory || null,
          data.gstin ? data.gstin.toUpperCase() : null,
          data.pan ? data.pan.toUpperCase() : null,
          data.phone,
          data.email || null,
          data.addressLine1,
          data.addressLine2 || null,
          data.city,
          data.state,
          data.stateCode,
          data.pincode,
          data.currency || 'INR',
          data.invoicePrefix || 'INV',
          data.termsAndConditions || null,
          now,
          now,
        ]
      );

      // Link user as OWNER
      await tx.run(
        `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
         VALUES (?, ?, ?, 'OWNER', 1, ?)`,
        [uuidv4(), businessId, userId, now]
      );

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, 'BUSINESS_CREATED', 'BUSINESS', ?, ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          businessId,
          JSON.stringify({ businessName: data.businessName, gstin: data.gstin }),
          req.ip || '127.0.0.1',
          now,
        ]
      );
    });

    res.status(201).json({
      success: true,
      message: 'Business tenant created successfully',
      data: {
        id: businessId,
        business_name: data.businessName,
        role: 'OWNER',
      },
    });
  } catch (err: any) {
    console.error('[Create Business Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to create business' });
  }
});

/**
 * PUT /api/business
 * Updates active business profile. Restricted to OWNER and ADMIN roles.
 */
businessRouter.put('/', authenticateToken, enforceTenant, requireRole('OWNER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const body = req.body;

    const current = await dbQueryOne<any>(`SELECT * FROM businesses WHERE id = ?`, [businessId]);
    if (!current) {
      res.status(404).json({ success: false, message: 'Business not found' });
      return;
    }

    const now = new Date().toISOString();

    await withTransaction(async (tx) => {
      await tx.run(
        `UPDATE businesses SET
          business_name = ?, legal_name = ?, business_type = ?, business_category = ?,
          gstin = ?, pan = ?, phone = ?, email = ?, address_line1 = ?, address_line2 = ?,
          city = ?, state = ?, state_code = ?, pincode = ?, invoice_prefix = ?,
          terms_and_conditions = ?, logo_url = ?, bank_name = ?, bank_account_no = ?,
          bank_ifsc = ?, bank_branch = ?, upi_id = ?, signature_url = ?, updated_at = ?
         WHERE id = ?`,
        [
          body.business_name || current.business_name,
          body.legal_name || current.legal_name,
          body.business_type || current.business_type,
          body.business_category || current.business_category,
          body.gstin ? body.gstin.toUpperCase() : current.gstin,
          body.pan ? body.pan.toUpperCase() : current.pan,
          body.phone || current.phone,
          body.email || current.email,
          body.address_line1 || current.address_line1,
          body.address_line2 !== undefined ? body.address_line2 : current.address_line2,
          body.city || current.city,
          body.state || current.state,
          body.state_code || current.state_code,
          body.pincode || current.pincode,
          body.invoice_prefix || current.invoice_prefix,
          body.terms_and_conditions !== undefined ? body.terms_and_conditions : current.terms_and_conditions,
          body.logo_url !== undefined ? body.logo_url : current.logo_url,
          body.bank_name !== undefined ? body.bank_name : current.bank_name,
          body.bank_account_no !== undefined ? body.bank_account_no : current.bank_account_no,
          body.bank_ifsc !== undefined ? body.bank_ifsc?.toUpperCase() : current.bank_ifsc,
          body.bank_branch !== undefined ? body.bank_branch : current.bank_branch,
          body.upi_id !== undefined ? body.upi_id : current.upi_id,
          body.signature_url !== undefined ? body.signature_url : current.signature_url,
          now,
          businessId,
        ]
      );

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, 'BUSINESS_UPDATED', 'BUSINESS', ?, ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          req.user!.userId,
          businessId,
          JSON.stringify({ updatedFields: Object.keys(body) }),
          req.ip || '127.0.0.1',
          now,
        ]
      );
    });

    res.json({ success: true, message: 'Business settings updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update business profile' });
  }
});

/**
 * GET /api/business/members
 * Lists team members & assigned roles for active business.
 */
businessRouter.get('/members', authenticateToken, enforceTenant, async (req: Request, res: Response): Promise<void> => {
  try {
    const members = await dbQueryAll<any>(
      `SELECT bu.id, bu.role, bu.custom_permissions, bu.is_active, bu.created_at,
              u.id as user_id, u.full_name, u.email, u.phone
       FROM business_users bu
       JOIN users u ON bu.user_id = u.id
       WHERE bu.business_id = ?
       ORDER BY bu.created_at ASC`,
      [req.businessId]
    );

    res.json({ success: true, data: members });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch business members' });
  }
});

/**
 * POST /api/business/members
 * Adds/Invites a member to the business by email.
 */
businessRouter.post('/members', authenticateToken, enforceTenant, requireRole('OWNER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, fullName, role = 'SALESPERSON', phone } = req.body;
    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, message: 'Valid user email is required' });
      return;
    }

    const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'SALESPERSON', 'ACCOUNTANT', 'INVENTORY_STAFF'];
    const assignedRole = validRoles.includes(role) ? role : 'SALESPERSON';
    const now = new Date().toISOString();

    const result = await withTransaction(async (tx) => {
      let user = await tx.queryOne<any>(`SELECT id, email, full_name FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);

      if (!user) {
        const newUserId = uuidv4();
        const defaultHash = '$2b$10$wE6vYdE38/7f8f9yWvYw3eJj/Xm6nNqUe4Y2i.9R4d0Uv3q3a1.W.'; // bcrypt default
        await tx.run(
          `INSERT INTO users (id, full_name, email, phone, password_hash, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
          [newUserId, fullName || email.split('@')[0], email.trim().toLowerCase(), phone || null, defaultHash, now, now]
        );
        user = { id: newUserId, email: email.trim().toLowerCase(), full_name: fullName || email.split('@')[0] };
      }

      // Check if already in business
      const existing = await tx.queryOne<any>(
        `SELECT id FROM business_users WHERE business_id = ? AND user_id = ?`,
        [req.businessId, user.id]
      );

      if (existing) {
        throw new Error('User is already a member of this business');
      }

      const memberId = uuidv4();
      await tx.run(
        `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [memberId, req.businessId, user.id, assignedRole, now]
      );

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, 'MEMBER_INVITED', 'BUSINESS_USER', ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.businessId,
          req.user!.userId,
          memberId,
          JSON.stringify({ invitedEmail: email, assignedRole }),
          req.ip || '127.0.0.1',
          now,
        ]
      );

      return {
        id: memberId,
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: assignedRole,
        is_active: 1,
        created_at: now,
      };
    });

    res.status(201).json({
      success: true,
      message: 'Staff member added successfully',
      data: result,
    });
  } catch (err: any) {
    console.error('[Add Member Error]:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to add team member' });
  }
});

/**
 * PUT /api/business/members/:id
 * Updates role for a team member.
 */
businessRouter.put('/members/:id', authenticateToken, enforceTenant, requireRole('OWNER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    const memberId = req.params.id;

    const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'SALESPERSON', 'ACCOUNTANT', 'INVENTORY_STAFF'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role' });
      return;
    }

    const member = await dbQueryOne<any>(
      `SELECT bu.*, u.email FROM business_users bu JOIN users u ON bu.user_id = u.id WHERE bu.id = ? AND bu.business_id = ?`,
      [memberId, req.businessId]
    );

    if (!member) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    await dbRun(`UPDATE business_users SET role = ? WHERE id = ?`, [role, memberId]);

    // Audit log
    await dbRun(
      `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'MEMBER_ROLE_UPDATED', 'BUSINESS_USER', ?, ?, ?, ?)`,
      [
        uuidv4(),
        req.businessId,
        req.user!.userId,
        memberId,
        JSON.stringify({ previousRole: member.role, newRole: role, memberEmail: member.email }),
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.json({ success: true, message: 'Member role updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update member role' });
  }
});

/**
 * DELETE /api/business/members/:id
 * Removes a team member from active business.
 */
businessRouter.delete('/members/:id', authenticateToken, enforceTenant, requireRole('OWNER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.id;
    const member = await dbQueryOne<any>(
      `SELECT bu.*, u.email FROM business_users bu JOIN users u ON bu.user_id = u.id WHERE bu.id = ? AND bu.business_id = ?`,
      [memberId, req.businessId]
    );

    if (!member) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    if (member.role === 'OWNER') {
      const ownerCount = await dbQueryOne<any>(
        `SELECT COUNT(*) as count FROM business_users WHERE business_id = ? AND role = 'OWNER'`,
        [req.businessId]
      );
      if (Number(ownerCount?.count || 0) <= 1) {
        res.status(400).json({ success: false, message: 'Cannot remove the only business owner' });
        return;
      }
    }

    await dbRun(`DELETE FROM business_users WHERE id = ?`, [memberId]);

    // Audit log
    await dbRun(
      `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'MEMBER_REMOVED', 'BUSINESS_USER', ?, ?, ?, ?)`,
      [
        uuidv4(),
        req.businessId,
        req.user!.userId,
        memberId,
        JSON.stringify({ removedEmail: member.email }),
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.json({ success: true, message: 'Team member removed from business' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to remove team member' });
  }
});

/**
 * GET /api/business/audit-logs
 * Retrieves security & activity audit logs for active business.
 */
businessRouter.get('/audit-logs', authenticateToken, enforceTenant, requireRole('OWNER', 'ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await dbQueryAll<any>(
      `SELECT a.id, u.email as user_email, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.business_id = ?
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [req.businessId]
    );

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});
