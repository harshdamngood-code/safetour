import { Router } from 'express';
import { PurchasesController } from './purchases.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';

export const purchasesRouter = Router();

purchasesRouter.use(authenticateToken);
purchasesRouter.use(enforceTenant);

// Expenses endpoints (before :id)
purchasesRouter.get('/expenses', PurchasesController.getExpenses);
purchasesRouter.post('/expenses', PurchasesController.createExpense);
purchasesRouter.delete('/expenses/:id', PurchasesController.deleteExpense);

// Purchases endpoints
purchasesRouter.get('/', PurchasesController.getPurchases);
purchasesRouter.post('/', PurchasesController.createPurchase);
purchasesRouter.get('/:id', PurchasesController.getPurchaseById);
purchasesRouter.post('/:id/payments', PurchasesController.recordPayment);
purchasesRouter.delete('/:id', PurchasesController.deletePurchase);
