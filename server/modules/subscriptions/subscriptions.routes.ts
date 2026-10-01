import { Router } from 'express';
import { SubscriptionsController } from './subscriptions.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.use(authenticateToken, enforceTenant);

subscriptionsRouter.get('/', SubscriptionsController.getSubscription);
subscriptionsRouter.post('/change-plan', SubscriptionsController.changePlan);
