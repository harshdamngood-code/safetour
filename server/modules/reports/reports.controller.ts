import { Request, Response } from 'express';
import { ReportsService } from './reports.service.js';

export class ReportsController {
  static async getGstr1(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { month, startDate, endDate } = req.query;
      const data = await ReportsService.getGstr1(businessId, {
        month: month ? String(month) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[ReportsController] getGstr1 error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to generate GSTR-1 report' });
    }
  }

  static async getGstr3b(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { month, startDate, endDate } = req.query;
      const data = await ReportsService.getGstr3b(businessId, {
        month: month ? String(month) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[ReportsController] getGstr3b error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to generate GSTR-3B report' });
    }
  }

  static async getProfitAndLoss(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { startDate, endDate } = req.query;
      const data = await ReportsService.getProfitAndLoss(businessId, {
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[ReportsController] getProfitAndLoss error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to generate Profit & Loss statement' });
    }
  }

  static async getDaybook(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { date } = req.query;
      const data = await ReportsService.getDaybook(businessId, date ? String(date) : undefined);

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[ReportsController] getDaybook error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to generate Daybook' });
    }
  }
}
