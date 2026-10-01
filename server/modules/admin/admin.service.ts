import { dbQueryAll, dbQueryOne, isPostgresConfigured } from '../../db/db-adapter.js';

export class AdminService {
  /**
   * Global SaaS Metrics for Platform Super Admins
   */
  static async getPlatformOverview() {
    const totalTenantsRes = await dbQueryOne<any>(`SELECT COUNT(*) as count FROM businesses`);
    const totalUsersRes = await dbQueryOne<any>(`SELECT COUNT(*) as count FROM users`);
    const totalInvoicesRes = await dbQueryOne<any>(`SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_volume FROM invoices`);
    const totalProductsRes = await dbQueryOne<any>(`SELECT COUNT(*) as count FROM products`);

    const tenants = await dbQueryAll<any>(`
      SELECT 
        b.id,
        b.business_name,
        b.business_type,
        b.city,
        b.state,
        b.phone,
        b.email,
        b.created_at,
        u.full_name as owner_name,
        u.email as owner_email,
        s.plan_id,
        s.status as subscription_status,
        (SELECT COUNT(*) FROM invoices i WHERE i.business_id = b.id) as invoice_count,
        (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) as product_count,
        (SELECT COUNT(*) FROM business_users bu WHERE bu.business_id = b.id) as user_count
      FROM businesses b
      LEFT JOIN users u ON b.owner_id = u.id
      LEFT JOIN subscriptions s ON s.business_id = b.id
      ORDER BY b.created_at DESC
    `);

    const recentAuditLogs = await dbQueryAll<any>(`
      SELECT al.*, b.business_name
      FROM audit_logs al
      LEFT JOIN businesses b ON al.business_id = b.id
      ORDER BY al.created_at DESC
      LIMIT 50
    `);

    return {
      kpis: {
        total_tenants: Number(totalTenantsRes?.count || 0),
        total_users: Number(totalUsersRes?.count || 0),
        total_invoices: Number(totalInvoicesRes?.count || 0),
        total_gross_volume: Number(totalInvoicesRes?.total_volume || 0),
        total_products: Number(totalProductsRes?.count || 0),
        platform_version: '2.5.0-PROD',
        engine: isPostgresConfigured() ? 'PostgreSQL (Cloud Scale)' : 'SQLite (Local Development)',
        uptime: Math.floor(process.uptime()),
      },
      tenants,
      audit_logs: recentAuditLogs,
    };
  }
}
