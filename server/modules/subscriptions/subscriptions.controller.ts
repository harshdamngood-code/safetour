import { Request, Response } from 'express';
import { SubscriptionsService } from './subscriptions.service.js';

export class SubscriptionsController {
  static async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }
      const data = await SubscriptionsService.getSubscription(businessId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[SubscriptionsController.getSubscription Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch subscription' });
    }
  }

  static async changePlan(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { plan_id, billing_cycle } = req.body;
      if (!plan_id) {
        res.status(400).json({ success: false, message: 'Plan ID is required' });
        return;
      }

      const data = await SubscriptionsService.changePlan(businessId, userId, {
        plan_id,
        billing_cycle: billing_cycle || 'MONTHLY',
      });

      res.json({
        success: true,
        message: `Successfully upgraded to ${plan_id} plan`,
        data,
      });
    } catch (err: any) {
      console.error('[SubscriptionsController.changePlan Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to update subscription' });
    }
  }
}
