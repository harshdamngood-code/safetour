import { v4 as uuidv4 } from 'uuid';
import { dbQueryOne, dbRun, withTransaction } from '../../db/db-adapter.js';

export interface PlanConfig {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  maxInvoices: number;
  maxProducts: number;
  maxUsers: number;
  features: string[];
}

export const SAAS_PLANS: Record<string, PlanConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Starter Trial',
    priceMonthly: 0,
    priceAnnual: 0,
    maxInvoices: 50,
    maxProducts: 100,
    maxUsers: 1,
    features: ['Basic Billing', 'PDF Invoices', 'Thermal Printing', '1 User Access'],
  },
  BASIC: {
    id: 'BASIC',
    name: 'Small Business',
    priceMonthly: 499,
    priceAnnual: 4999,
    maxInvoices: 500,
    maxProducts: 1000,
    maxUsers: 3,
    features: ['GST Invoicing & Reports', 'Barcode Scanning', 'Inventory & Khata Ledger', 'WhatsApp Sharing', '3 Staff Accounts'],
  },
  PRO: {
    id: 'PRO',
    name: 'Growth Enterprise',
    priceMonthly: 999,
    priceAnnual: 9999,
    maxInvoices: 2500,
    maxProducts: 5000,
    maxUsers: 10,
    features: ['Unlimited Quotations', 'Sales & Purchase Returns', 'E-Way Bill & Transport Fields', 'Multi-Branch Ready', 'Automated Daily Backups', '10 Staff Accounts'],
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Multi-Location Pro',
    priceMonthly: 1999,
    priceAnnual: 19999,
    maxInvoices: 100000,
    maxProducts: 50000,
    maxUsers: 50,
    features: ['Unlimited Invoices & Products', 'Multi-Branch & Warehouses', 'Priority 24/7 Support', 'Role-Based Permissions (RBAC)', 'Dedicated Account Manager'],
  },
};

export class SubscriptionsService {
  /**
   * Get current business subscription details and quota usage metrics
   */
  static async getSubscription(businessId: string) {
    let sub = await dbQueryOne<any>(`SELECT * FROM subscriptions WHERE business_id = ?`, [businessId]);

    if (!sub) {
      // Auto-provision Free/Pro trial if not set
      const now = new Date().toISOString();
      const subId = uuidv4();
      await dbRun(
        `INSERT INTO subscriptions (
          id, business_id, plan_id, status, billing_cycle, max_invoices_per_month, max_products, max_users, current_period_start, current_period_end
        ) VALUES (?, ?, 'PRO', 'ACTIVE', 'MONTHLY', 2500, 5000, 10, ?, ?)`,
        [subId, businessId, now, new Date(Date.now() + 30 * 86400000).toISOString()]
      );
      sub = await dbQueryOne<any>(`SELECT * FROM subscriptions WHERE id = ?`, [subId]);
    }

    // Measure live usage counts for current month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const invoicesCountRes = await dbQueryOne<any>(
      `SELECT COUNT(*) as count FROM invoices WHERE business_id = ? AND invoice_date >= ?`,
      [businessId, startOfMonth]
    );
    const productsCountRes = await dbQueryOne<any>(
      `SELECT COUNT(*) as count FROM products WHERE business_id = ? AND is_active = 1`,
      [businessId]
    );
    const usersCountRes = await dbQueryOne<any>(
      `SELECT COUNT(*) as count FROM business_users WHERE business_id = ? AND is_active = 1`,
      [businessId]
    );

    const planConfig = SAAS_PLANS[sub.plan_id] || SAAS_PLANS.PRO;

    return {
      subscription: sub,
      plan: planConfig,
      all_plans: Object.values(SAAS_PLANS),
      usage: {
        invoices_this_month: Number(invoicesCountRes?.count || 0),
        max_invoices_per_month: sub.max_invoices_per_month || planConfig.maxInvoices,
        products_count: Number(productsCountRes?.count || 0),
        max_products: sub.max_products || planConfig.maxProducts,
        users_count: Number(usersCountRes?.count || 0),
        max_users: sub.max_users || planConfig.maxUsers,
      },
    };
  }

  /**
   * Upgrade or modify plan
   */
  static async changePlan(businessId: string, userId: string, payload: { plan_id: string; billing_cycle: 'MONTHLY' | 'ANNUAL' }) {
    const planConfig = SAAS_PLANS[payload.plan_id];
    if (!planConfig) throw new Error('Invalid plan selected');

    const now = new Date().toISOString();
    const periodDays = payload.billing_cycle === 'ANNUAL' ? 365 : 30;
    const periodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();

    await withTransaction(async (tx) => {
      await tx.run(
        `UPDATE subscriptions SET
          plan_id = ?,
          billing_cycle = ?,
          status = 'ACTIVE',
          max_invoices_per_month = ?,
          max_products = ?,
          max_users = ?,
          current_period_start = ?,
          current_period_end = ?,
          updated_at = ?
        WHERE business_id = ?`,
        [
          planConfig.id,
          payload.billing_cycle,
          planConfig.maxInvoices,
          planConfig.maxProducts,
          planConfig.maxUsers,
          now,
          periodEnd,
          now,
          businessId,
        ]
      );

      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CHANGE_SUBSCRIPTION_PLAN', 'SUBSCRIPTION', ?, ?, ?)`,
        [uuidv4(), businessId, userId, businessId, JSON.stringify(payload), now]
      );
    });

    return await this.getSubscription(businessId);
  }
}
