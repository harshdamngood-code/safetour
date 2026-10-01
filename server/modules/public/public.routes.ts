import { Router, Request, Response } from 'express';
import { InvoicesService } from '../invoices/invoices.service.js';

export const publicRouter = Router();

/**
 * Public endpoint to fetch an invoice by its secure unique sharing token.
 * Does not require login headers.
 */
publicRouter.get('/invoice/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: 'Missing invoice share token' });
      return;
    }

    const invoice = await InvoicesService.getInvoiceByShareToken(token);
    res.json({
      success: true,
      data: invoice,
    });
  } catch (err: any) {
    console.error('[publicRouter.invoice Error]:', err);
    res.status(404).json({ success: false, message: err.message || 'Invoice link is invalid or expired' });
  }
});
