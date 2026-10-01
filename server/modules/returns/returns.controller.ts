import { Request, Response } from 'express';
import { ReturnsService } from './returns.service.js';

export class ReturnsController {
  static async listSalesReturns(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }
      const data = await ReturnsService.listSalesReturns(businessId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[ReturnsController.listSalesReturns Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to list sales returns' });
    }
  }

  static async createSalesReturn(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { customer_name, items, grand_total } = req.body;
      if (!customer_name) {
        res.status(400).json({ success: false, message: 'Customer name is required' });
        return;
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, message: 'At least one return item is required' });
        return;
      }

      const data = await ReturnsService.createSalesReturn(businessId, userId, req.body);
      res.status(201).json({ success: true, message: 'Sales return (Credit Note) recorded successfully', data });
    } catch (err: any) {
      console.error('[ReturnsController.createSalesReturn Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to create sales return' });
    }
  }

  static async listPurchaseReturns(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }
      const data = await ReturnsService.listPurchaseReturns(businessId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[ReturnsController.listPurchaseReturns Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to list purchase returns' });
    }
  }

  static async createPurchaseReturn(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { supplier_name, items } = req.body;
      if (!supplier_name) {
        res.status(400).json({ success: false, message: 'Supplier name is required' });
        return;
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, message: 'At least one return item is required' });
        return;
      }

      const data = await ReturnsService.createPurchaseReturn(businessId, userId, req.body);
      res.status(201).json({ success: true, message: 'Purchase return (Debit Note) recorded successfully', data });
    } catch (err: any) {
      console.error('[ReturnsController.createPurchaseReturn Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to create purchase return' });
    }
  }
}
