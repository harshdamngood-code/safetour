import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authenticateToken, requirePlatformAdmin } from '../../middleware/auth.middleware.js';

export const adminRouter = Router();

// All platform admin routes require standard token authentication AND Super Admin privileges
adminRouter.use(authenticateToken, requirePlatformAdmin);

adminRouter.get('/overview', AdminController.getOverview);
adminRouter.post('/migrate-to-postgres', AdminController.runMigration);
