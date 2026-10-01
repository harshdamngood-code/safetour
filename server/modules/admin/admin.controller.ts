import { Request, Response } from 'express';
import { AdminService } from './admin.service.js';
import { migrateSqliteToPostgres } from '../../db/migrate-to-postgres.js';
import { ENV } from '../../config/env.js';
import { dbRun } from '../../db/db-adapter.js';
import { v4 as uuidv4 } from 'uuid';

export class AdminController {
  static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const data = await AdminService.getPlatformOverview();
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[AdminController.getOverview Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch platform metrics' });
    }
  }

  static async runMigration(req: Request, res: Response): Promise<void> {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !ENV.ALLOW_HTTP_MIGRATION) {
      res.status(403).json({
        success: false,
        message: 'HTTP database migration is disabled in production. Run migrations using the CLI: npm run db:migrate',
        code: 'HTTP_MIGRATION_DISABLED',
      });
      return;
    }

    try {
      console.log(`[Admin] Database migration triggered by SuperAdmin User ID: ${req.user?.userId} (${req.user?.email})`);
      
      // Audit log the migration trigger
      try {
        await dbRun(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
           VALUES (?, ?, 'TRIGGER_DB_MIGRATION', 'SYSTEM', 'POSTGRES', ?, ?)`,
          [
            uuidv4(),
            req.user?.userId,
            JSON.stringify({ triggered_by: req.user?.email, ip: req.ip }),
            new Date().toISOString(),
          ]
        );
      } catch {
        // Continue if audit insert fails before migration
      }

      const result = await migrateSqliteToPostgres();
      res.json(result);
    } catch (err: any) {
      console.error('[AdminController.runMigration Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Migration to PostgreSQL failed' });
    }
  }
}
