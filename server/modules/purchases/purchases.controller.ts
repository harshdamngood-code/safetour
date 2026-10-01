import { Request, Response } from 'express';
import { PurchasesService } from './purchases.service.js';

export class PurchasesController {
  // ==========================================
  // PURCHASES (INWARD BILLS)
  // ==========================================

  static async getPurchases(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { supplierId, status, startDate, endDate, search, page, limit } = req.query;
      const data = await PurchasesService.getPurchases(businessId, {
        supplierId: supplierId ? String(supplierId) : undefined,
        status: status ? String(status) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[PurchasesController] getPurchases error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch purchases' });
    }
  }

  static async getPurchaseById(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const data = await PurchasesService.getPurchaseById(businessId, id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[PurchasesController] getPurchaseById error:', error);
      res.status(404).json({ success: false, message: error.message || 'Purchase bill not found' });
    }
  }

  static async createPurchase(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const data = await PurchasesService.createPurchase(businessId, userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Inward purchase bill recorded & stock replenished successfully',
        data,
      });
    } catch (error: any) {
      console.error('[PurchasesController] createPurchase error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to record purchase bill' });
    }
  }

  static async recordPayment(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const data = await PurchasesService.recordPayment(businessId, userId, id, req.body);
      res.json({
        success: true,
        message: 'Supplier payment recorded successfully',
        data,
      });
    } catch (error: any) {
      console.error('[PurchasesController] recordPayment error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to record supplier payment' });
    }
  }

  static async deletePurchase(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const result = await PurchasesService.deletePurchase(businessId, userId, id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      console.error('[PurchasesController] deletePurchase error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to void purchase bill' });
    }
  }

  // ==========================================
  // EXPENSES
  // ==========================================

  static async getExpenses(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { category, startDate, endDate } = req.query;
      const data = await PurchasesService.getExpenses(businessId, {
        category: category ? String(category) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[PurchasesController] getExpenses error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch expenses' });
    }
  }

  static async createExpense(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const data = await PurchasesService.createExpense(businessId, userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Expense recorded successfully',
        data,
      });
    } catch (error: any) {
      console.error('[PurchasesController] createExpense error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to record expense' });
    }
  }

  static async deleteExpense(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const result = await PurchasesService.deleteExpense(businessId, userId, id);
      res.json({ success: true, message: result.message });
    } catch (error: any) {
      console.error('[PurchasesController] deleteExpense error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to delete expense' });
    }
  }
}
