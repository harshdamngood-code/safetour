import { Router } from 'express';
import { InvoicesController } from './invoices.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';

export const invoicesRouter = Router();

// Secure all invoice operations with Auth + Tenant isolation
invoicesRouter.use(authenticateToken, enforceTenant);

invoicesRouter.get('/next-number', InvoicesController.getNextNumber);
invoicesRouter.get('/', InvoicesController.listInvoices);
invoicesRouter.get('/:id', InvoicesController.getInvoiceById);
invoicesRouter.post('/', InvoicesController.createInvoice);
invoicesRouter.post('/:id/payments', InvoicesController.recordPayment);
invoicesRouter.post('/:id/convert-quote', InvoicesController.convertQuotation);
invoicesRouter.post('/:id/share', InvoicesController.generateShareLink);
invoicesRouter.delete('/:id', InvoicesController.deleteInvoice);
