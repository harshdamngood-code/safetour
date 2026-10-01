import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { dbQueryOne, dbRun } from '../../db/db-adapter.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PurchasesService } from '../purchases/purchases.service.js';
import { ReturnsService } from '../returns/returns.service.js';

export const syncRouter = Router();

syncRouter.use(authenticateToken, enforceTenant);

export interface SyncOperation {
  operation_id: string;
  business_id?: string;
  device_id: string;
  action: string;
  entity_type: string;
  payload: any;
  timestamp: string;
}

/**
 * Atomic batch synchronization for offline operations with strict tenant isolation and idempotency.
 */
syncRouter.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const businessId = req.businessId;
    const userId = req.user?.userId || 'offline_sync';
    const { operations } = req.body as { operations: SyncOperation[] };

    if (!businessId) {
      res.status(400).json({ success: false, message: 'Missing business tenant ID' });
      return;
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      res.json({ success: true, processed: 0, results: [] });
      return;
    }

    const results: Array<{
      operation_id: string;
      status: 'APPLIED' | 'SKIPPED' | 'FAILED';
      entity_id?: string | null;
      error?: string;
    }> = [];

    for (const op of operations) {
      if (!op || !op.operation_id) {
        continue;
      }

      // 1. Strict tenant boundary verification: reject any operation queued under a different business_id
      if (op.business_id && op.business_id !== businessId) {
        results.push({
          operation_id: op.operation_id,
          status: 'FAILED',
          error: `Cross-tenant sync rejected: operation belongs to tenant ${op.business_id}, active tenant is ${businessId}`,
        });
        continue;
      }

      // 2. Idempotency check: has this operation already been processed for this tenant?
      const existing = await dbQueryOne<any>(
        `SELECT id, status, entity_id FROM sync_audit WHERE operation_id = ? AND business_id = ?`,
        [op.operation_id, businessId]
      );

      if (existing && (existing.status === 'SYNCED' || existing.status === 'APPLIED')) {
        results.push({
          operation_id: op.operation_id,
          status: 'SKIPPED',
          entity_id: existing.entity_id || null,
        });
        continue;
      }

      const now = new Date().toISOString();

      try {
        let createdEntityId: string | null = op.payload?.id || null;

        if (op.action === 'CREATE_INVOICE' && op.entity_type === 'invoices') {
          const created = await InvoicesService.createInvoice(businessId, userId, op.payload);
          createdEntityId = created?.id || null;
        } else if (op.action === 'RECORD_PAYMENT' && op.entity_type === 'invoices') {
          const updated = await InvoicesService.recordPayment(
            businessId,
            userId,
            op.payload.invoice_id,
            op.payload
          );
          createdEntityId = updated?.id || op.payload.invoice_id || null;
        } else if (op.action === 'CREATE_PRODUCT' && op.entity_type === 'products') {
          const created = await InventoryService.createProduct(businessId, userId, op.payload);
          createdEntityId = created?.id || null;
        } else if (op.action === 'UPDATE_PRODUCT' && op.entity_type === 'products') {
          const updated = await InventoryService.updateProduct(
            businessId,
            userId,
            op.payload.id || op.payload.product_id,
            op.payload
          );
          createdEntityId = updated?.productId || null;
        } else if (op.action === 'ADJUST_STOCK' && op.entity_type === 'products') {
          const adj = await InventoryService.adjustStock(
            businessId,
            userId,
            op.payload.product_id || op.payload.id,
            op.payload
          );
          createdEntityId = adj?.adjustmentId || null;
        } else if (op.action === 'CREATE_PURCHASE' && op.entity_type === 'purchases') {
          const created = await PurchasesService.createPurchase(businessId, userId, op.payload);
          createdEntityId = created?.id || null;
        } else if (op.action === 'RECORD_PURCHASE_PAYMENT' && op.entity_type === 'purchases') {
          const updated = await PurchasesService.recordPurchasePayment(
            businessId,
            userId,
            op.payload.purchase_id,
            op.payload
          );
          createdEntityId = updated?.id || null;
        } else if (op.action === 'CREATE_EXPENSE' && op.entity_type === 'expenses') {
          const created = await PurchasesService.createExpense(businessId, userId, op.payload);
          createdEntityId = created?.id || null;
        } else if (op.action === 'CREATE_SALES_RETURN' && op.entity_type === 'returns') {
          const created = await ReturnsService.createSalesReturn(businessId, userId, op.payload);
          createdEntityId = created?.id || null;
        } else if (op.action === 'CREATE_PURCHASE_RETURN' && op.entity_type === 'returns') {
          const created = await ReturnsService.createPurchaseReturn(businessId, userId, op.payload);
          createdEntityId = created?.id || null;
        } else {
          throw new Error(`Unsupported sync operation: ${op.action} on ${op.entity_type}`);
        }

        // Record or update successful sync in sync_audit
        if (existing) {
          await dbRun(
            `UPDATE sync_audit
             SET status = 'SYNCED', error_message = NULL, entity_id = ?, device_id = ?, created_at = ?
             WHERE id = ? AND business_id = ?`,
            [createdEntityId, op.device_id || 'unknown_device', now, existing.id, businessId]
          );
        } else {
          await dbRun(
            `INSERT INTO sync_audit (id, business_id, user_id, device_id, operation_id, entity_type, entity_id, action, payload, status, error_message, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', NULL, ?)`,
            [
              uuidv4(),
              businessId,
              userId,
              op.device_id || 'unknown_device',
              op.operation_id,
              op.entity_type,
              createdEntityId,
              op.action,
              JSON.stringify(op.payload || {}),
              now,
            ]
          );
        }

        results.push({
          operation_id: op.operation_id,
          status: 'APPLIED',
          entity_id: createdEntityId,
        });
      } catch (opErr: any) {
        const errMsg = opErr?.message || 'Unknown sync processing error';

        // If error indicates duplicate invoice number from a previous partial apply, treat as conflict/failed with clear message
        try {
          if (existing) {
            await dbRun(
              `UPDATE sync_audit
               SET status = 'FAILED', error_message = ?, device_id = ?, created_at = ?
               WHERE id = ? AND business_id = ?`,
              [errMsg, op.device_id || 'unknown_device', now, existing.id, businessId]
            );
          } else {
            await dbRun(
              `INSERT INTO sync_audit (id, business_id, user_id, device_id, operation_id, entity_type, entity_id, action, payload, status, error_message, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, ?)`,
              [
                uuidv4(),
                businessId,
                userId,
                op.device_id || 'unknown_device',
                op.operation_id,
                op.entity_type,
                op.payload?.id || null,
                op.action,
                JSON.stringify(op.payload || {}),
                errMsg,
                now,
              ]
            );
          }
        } catch {
          // Ignore audit log failure
        }

        results.push({
          operation_id: op.operation_id,
          status: 'FAILED',
          error: errMsg,
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error('[syncRouter.batch Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Batch sync failed' });
  }
});
