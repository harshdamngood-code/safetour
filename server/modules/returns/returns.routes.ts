import { Router } from 'express';
import { ReturnsController } from './returns.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';

export const returnsRouter = Router();

returnsRouter.use(authenticateToken, enforceTenant);

// Sales Returns
returnsRouter.get('/sales', ReturnsController.listSalesReturns);
returnsRouter.post('/sales', ReturnsController.createSalesReturn);

// Purchase Returns
returnsRouter.get('/purchases', ReturnsController.listPurchaseReturns);
returnsRouter.post('/purchases', ReturnsController.createPurchaseReturn);
