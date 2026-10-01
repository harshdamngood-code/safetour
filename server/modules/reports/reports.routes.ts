import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';

export const reportsRouter = Router();

reportsRouter.use(authenticateToken);
reportsRouter.use(enforceTenant);

reportsRouter.get('/gstr-1', ReportsController.getGstr1);
reportsRouter.get('/gstr-3b', ReportsController.getGstr3b);
reportsRouter.get('/profit-loss', ReportsController.getProfitAndLoss);
reportsRouter.get('/daybook', ReportsController.getDaybook);
