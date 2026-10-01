import { Request, Response } from 'express';
import { InvoicesService } from './invoices.service.js';

export class InvoicesController {
  static async listInvoices(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const { search, status, invoice_type, start_date, end_date, customer_id } = req.query;

      const result = await InvoicesService.listInvoices(businessId, {
        search: search as string,
        status: status as string,
        invoice_type: invoice_type as string,
        start_date: start_date as string,
        end_date: end_date as string,
        customer_id: customer_id as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[InvoicesController.listInvoices Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch invoices' });
    }
  }

  static async getNextNumber(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const type = (req.query.type as string) || 'TAX_INVOICE';
      const result = await InvoicesService.getNextInvoiceNumber(businessId, type);
      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[InvoicesController.getNextNumber Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to generate invoice sequence' });
    }
  }

  static async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const invoice = await InvoicesService.getInvoiceById(businessId, id);
      res.json({
        success: true,
        data: invoice,
      });
    } catch (err: any) {
      console.error('[InvoicesController.getInvoiceById Error]:', err);
      res.status(404).json({ success: false, message: err.message || 'Invoice not found' });
    }
  }

  static async createInvoice(req: Request, res: Response): Promise<void> {
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
        res.status(400).json({ success: false, message: 'At least one line item is required' });
        return;
      }

      const invoice = await InvoicesService.createInvoice(businessId, userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        data: invoice,
      });
    } catch (err: any) {
      console.error('[InvoicesController.createInvoice Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to create invoice' });
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

      const { amount, payment_mode, reference_number, payment_date, notes } = req.body;
      if (!amount || Number(amount) <= 0) {
        res.status(400).json({ success: false, message: 'Valid payment amount is required' });
        return;
      }

      const updatedInvoice = await InvoicesService.recordPayment(businessId, userId, id, {
        amount: Number(amount),
        payment_mode: payment_mode || 'CASH',
        reference_number,
        payment_date,
        notes,
      });

      res.json({
        success: true,
        message: 'Payment collection recorded successfully',
        data: updatedInvoice,
      });
    } catch (err: any) {
      console.error('[InvoicesController.recordPayment Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to record payment' });
    }
  }

  static async convertQuotation(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const invoice = await InvoicesService.convertQuotationToInvoice(businessId, userId, id);
      res.json({
        success: true,
        message: 'Quotation converted into active Tax Invoice',
        data: invoice,
      });
    } catch (err: any) {
      console.error('[InvoicesController.convertQuotation Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to convert quotation' });
    }
  }

  static async deleteInvoice(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId || 'system';
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const result = await InvoicesService.deleteInvoice(businessId, userId, id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (err: any) {
      console.error('[InvoicesController.deleteInvoice Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to delete invoice' });
    }
  }

  static async generateShareLink(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const { id } = req.params;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Missing business tenant ID' });
        return;
      }

      const result = await InvoicesService.generateShareLink(businessId, id);
      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[InvoicesController.generateShareLink Error]:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to generate share link' });
    }
  }
}
