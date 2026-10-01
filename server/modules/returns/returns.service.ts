import { v4 as uuidv4 } from 'uuid';
import { dbQueryAll, dbQueryOne, dbRun, withTransaction, reserveNextDocumentNumber } from '../../db/db-adapter.js';
import { roundPaise, addMoney, subtractMoney, roundQuantity } from '../../utils/finance.js';

export interface SalesReturnItemPayload {
  product_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  taxable_amount: number;
  total_amount: number;
}

export interface CreateSalesReturnPayload {
  invoice_id?: string;
  return_number?: string;
  return_date: string;
  customer_id?: string;
  customer_name: string;
  items: SalesReturnItemPayload[];
  subtotal: number;
  tax_total: number;
  grand_total: number;
  refund_amount?: number;
  refund_status?: string;
  reason?: string;
}

export interface PurchaseReturnItemPayload {
  product_id?: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  tax_rate: number;
  taxable_amount: number;
  total_amount: number;
}

export interface CreatePurchaseReturnPayload {
  purchase_id?: string;
  return_number?: string;
  return_date: string;
  supplier_id?: string;
  supplier_name: string;
  items: PurchaseReturnItemPayload[];
  subtotal: number;
  tax_total: number;
  grand_total: number;
  refund_amount?: number;
  reason?: string;
}

export class ReturnsService {
  /**
   * List all Sales Returns (Credit Notes) for the active tenant
   */
  static async listSalesReturns(businessId: string) {
    const returns = await dbQueryAll<any>(
      `SELECT sr.*, (SELECT COUNT(*) FROM sales_return_items sri WHERE sri.return_id = sr.id) as item_count
       FROM sales_returns sr
       WHERE sr.business_id = ?
       ORDER BY sr.return_date DESC, sr.created_at DESC`,
      [businessId]
    );
    return returns;
  }

  /**
   * Create a Sales Return with automatic stock replenishment and customer ledger credit adjustment atomically
   */
  static async createSalesReturn(businessId: string, userId: string, payload: CreateSalesReturnPayload) {
    return withTransaction(async (tx) => {
      const now = new Date().toISOString();
      const returnId = uuidv4();
      let returnNumber = payload.return_number?.trim();
      if (!returnNumber) {
        const reserved = await reserveNextDocumentNumber(tx, businessId, 'SALES_RETURN');
        returnNumber = reserved.formattedNumber;
      }

      // 1. Insert Sales Return header
      await tx.run(
        `INSERT INTO sales_returns (
          id, business_id, invoice_id, return_number, return_date, customer_id,
          customer_name, subtotal, tax_total, grand_total, refund_amount, refund_status, reason, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          businessId,
          payload.invoice_id || null,
          returnNumber,
          payload.return_date || now.split('T')[0],
          payload.customer_id || null,
          payload.customer_name || 'Walk-in Customer',
          roundPaise(payload.subtotal || 0),
          roundPaise(payload.tax_total || 0),
          roundPaise(payload.grand_total || 0),
          roundPaise(payload.refund_amount || 0),
          payload.refund_status || 'COMPLETED',
          payload.reason || 'Customer Return',
          userId,
          now,
        ]
      );

      // 2. Insert items and replenish inventory
      if (payload.items && payload.items.length > 0) {
        for (const item of payload.items) {
          const itemId = uuidv4();
          await tx.run(
            `INSERT INTO sales_return_items (
              id, return_id, product_id, item_name, quantity, unit_price, tax_rate, taxable_amount, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              returnId,
              item.product_id || null,
              item.item_name,
              roundQuantity(item.quantity),
              roundPaise(item.unit_price),
              roundPaise(item.tax_rate || 0),
              roundPaise(item.taxable_amount || 0),
              roundPaise(item.total_amount || 0),
            ]
          );

          if (item.product_id) {
            const prod = await tx.queryOne<any>(
              `SELECT id, current_stock FROM products WHERE id = ? AND business_id = ?`,
              [item.product_id, businessId]
            );
            if (prod) {
              const prevStock = roundQuantity(prod.current_stock);
              const newStock = roundQuantity(prevStock + Number(item.quantity));
              await tx.run(
                `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
                [newStock, now, item.product_id]
              );

              // Stock audit record
              await tx.run(
                `INSERT INTO stock_adjustments (
                  id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
                ) VALUES (?, ?, ?, 'ADD', ?, ?, ?, 'RETURN_FROM_CUSTOMER', ?, ?, ?)`,
                [uuidv4(), businessId, item.product_id, roundQuantity(item.quantity), prevStock, newStock, returnNumber, userId, now]
              );
            }
          }
        }
      }

      // 3. Customer Ledger Balance adjustment
      if (payload.customer_id) {
        const cust = await tx.queryOne<any>(
          `SELECT id, current_balance FROM customers WHERE id = ? AND business_id = ?`,
          [payload.customer_id, businessId]
        );
        if (cust) {
          const grandTotal = roundPaise(payload.grand_total || 0);
          const newBal = Math.max(0, subtractMoney(cust.current_balance || 0, grandTotal));
          await tx.run(
            `UPDATE customers SET current_balance = ? WHERE id = ?`,
            [newBal, payload.customer_id]
          );
        }
      }

      // 4. Audit Log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CREATE_SALES_RETURN', 'SALES_RETURN', ?, ?, ?)`,
        [uuidv4(), businessId, userId, returnId, JSON.stringify({ return_number: returnNumber, total: payload.grand_total }), now]
      );

      const items = await tx.queryAll<any>(`SELECT * FROM sales_return_items WHERE return_id = ?`, [returnId]);
      const header = await tx.queryOne<any>(`SELECT * FROM sales_returns WHERE id = ?`, [returnId]);
      return { ...header, items };
    });
  }

  /**
   * List all Purchase Returns (Debit Notes)
   */
  static async listPurchaseReturns(businessId: string) {
    const returns = await dbQueryAll<any>(
      `SELECT pr.*, (SELECT COUNT(*) FROM purchase_return_items pri WHERE pri.return_id = pr.id) as item_count
       FROM purchase_returns pr
       WHERE pr.business_id = ?
       ORDER BY pr.return_date DESC, pr.created_at DESC`,
      [businessId]
    );
    return returns;
  }

  /**
   * Create a Purchase Return (Debit Note) with stock deduction and supplier ledger balance reduction atomically
   */
  static async createPurchaseReturn(businessId: string, userId: string, payload: CreatePurchaseReturnPayload) {
    return withTransaction(async (tx) => {
      const now = new Date().toISOString();
      const returnId = uuidv4();
      let returnNumber = payload.return_number?.trim();
      if (!returnNumber) {
        const reserved = await reserveNextDocumentNumber(tx, businessId, 'PURCHASE_RETURN');
        returnNumber = reserved.formattedNumber;
      }

      // 1. Insert header
      await tx.run(
        `INSERT INTO purchase_returns (
          id, business_id, purchase_id, return_number, return_date, supplier_id,
          supplier_name, subtotal, tax_total, grand_total, refund_amount, reason, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          businessId,
          payload.purchase_id || null,
          returnNumber,
          payload.return_date || now.split('T')[0],
          payload.supplier_id || null,
          payload.supplier_name,
          roundPaise(payload.subtotal || 0),
          roundPaise(payload.tax_total || 0),
          roundPaise(payload.grand_total || 0),
          roundPaise(payload.refund_amount || 0),
          payload.reason || 'Defective/Supplier Return',
          userId,
          now,
        ]
      );

      // 2. Insert items and deduct from inventory
      if (payload.items && payload.items.length > 0) {
        for (const item of payload.items) {
          const itemId = uuidv4();
          await tx.run(
            `INSERT INTO purchase_return_items (
              id, return_id, product_id, item_name, quantity, unit_cost, tax_rate, taxable_amount, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              returnId,
              item.product_id || null,
              item.item_name,
              roundQuantity(item.quantity),
              roundPaise(item.unit_cost),
              roundPaise(item.tax_rate || 0),
              roundPaise(item.taxable_amount || 0),
              roundPaise(item.total_amount || 0),
            ]
          );

          if (item.product_id) {
            const prod = await tx.queryOne<any>(
              `SELECT id, current_stock FROM products WHERE id = ? AND business_id = ?`,
              [item.product_id, businessId]
            );
            if (prod) {
              const prevStock = roundQuantity(prod.current_stock);
              const newStock = Math.max(0, roundQuantity(prevStock - Number(item.quantity)));
              await tx.run(
                `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
                [newStock, now, item.product_id]
              );

              await tx.run(
                `INSERT INTO stock_adjustments (
                  id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
                ) VALUES (?, ?, ?, 'REDUCE', ?, ?, ?, 'RETURN_TO_SUPPLIER', ?, ?, ?)`,
                [uuidv4(), businessId, item.product_id, roundQuantity(item.quantity), prevStock, newStock, returnNumber, userId, now]
              );
            }
          }
        }
      }

      // 3. Supplier Ledger Balance reduction
      if (payload.supplier_id) {
        const supp = await tx.queryOne<any>(
          `SELECT id, current_balance FROM suppliers WHERE id = ? AND business_id = ?`,
          [payload.supplier_id, businessId]
        );
        if (supp) {
          const grandTotal = roundPaise(payload.grand_total || 0);
          const newBal = Math.max(0, subtractMoney(supp.current_balance || 0, grandTotal));
          await tx.run(
            `UPDATE suppliers SET current_balance = ? WHERE id = ?`,
            [newBal, payload.supplier_id]
          );
        }
      }

      // 4. Audit Log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CREATE_PURCHASE_RETURN', 'PURCHASE_RETURN', ?, ?, ?)`,
        [uuidv4(), businessId, userId, returnId, JSON.stringify({ return_number: returnNumber, total: payload.grand_total }), now]
      );

      const items = await tx.queryAll<any>(`SELECT * FROM purchase_return_items WHERE return_id = ?`, [returnId]);
      const header = await tx.queryOne<any>(`SELECT * FROM purchase_returns WHERE id = ?`, [returnId]);
      return { ...header, items };
    });
  }
}
