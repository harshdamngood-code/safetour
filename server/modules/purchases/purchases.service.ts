import { v4 as uuidv4 } from 'uuid';
import { dbQueryAll, dbQueryOne, dbRun, withTransaction, TransactionContext } from '../../db/db-adapter.js';
import { roundPaise, addMoney, subtractMoney, multiplyMoney, roundQuantity } from '../../utils/finance.js';

export interface PurchaseItemInput {
  product_id?: string;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  unit_cost: number;
  discount_percent?: number;
  tax_rate?: number;
}

export interface CreatePurchasePayload {
  supplier_id?: string;
  supplier_name: string;
  supplier_gstin?: string;
  supplier_state?: string;
  bill_number: string;
  bill_date: string;
  due_date?: string;
  payment_method?: string;
  paid_amount?: number;
  round_off?: number;
  notes?: string;
  items: PurchaseItemInput[];
}

export interface CreateExpensePayload {
  category: string;
  amount: number;
  expense_date: string;
  payment_method?: string;
  vendor_name?: string;
  gstin?: string;
  tax_rate?: number;
  taxable_amount?: number;
  gst_amount?: number;
  is_itc_eligible?: boolean;
  reference_no?: string;
  description?: string;
}

export class PurchasesService {
  /**
   * List purchase bills for a tenant with pagination and date filters
   */
  static async getPurchases(
    businessId: string,
    filters: {
      supplierId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE p.business_id = ?`;
    const params: any[] = [businessId];

    if (filters.supplierId) {
      whereClause += ` AND p.supplier_id = ?`;
      params.push(filters.supplierId);
    }
    if (filters.status && filters.status !== 'ALL') {
      whereClause += ` AND p.payment_status = ?`;
      params.push(filters.status);
    }
    if (filters.startDate) {
      whereClause += ` AND p.bill_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND p.bill_date <= ?`;
      params.push(filters.endDate);
    }
    if (filters.search && filters.search.trim()) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      whereClause += ` AND (LOWER(p.bill_number) LIKE ? OR LOWER(p.supplier_name) LIKE ?)`;
      params.push(q, q);
    }

    const countRow = await dbQueryOne<any>(
      `SELECT COUNT(*) as total, 
              COALESCE(SUM(p.grand_total), 0) as total_amount,
              COALESCE(SUM(p.paid_amount), 0) as total_paid,
              COALESCE(SUM(p.balance_due), 0) as total_due
       FROM purchases p ${whereClause}`,
      params
    );

    const items = await dbQueryAll<any>(
      `SELECT p.*, s.phone as supplier_phone, s.email as supplier_email
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${whereClause}
       ORDER BY p.bill_date DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      items,
      pagination: {
        total: Number(countRow?.total || 0),
        page,
        limit,
        totalPages: Math.ceil((Number(countRow?.total) || 0) / limit),
      },
      summary: {
        total_amount: Number(countRow?.total_amount || 0),
        total_paid: Number(countRow?.total_paid || 0),
        total_due: Number(countRow?.total_due || 0),
      },
    };
  }

  /**
   * Get single purchase bill with full itemized breakdown and payments.
   * Accepts optional TransactionContext `tx` so uncommitted records inside a transaction are visible in PostgreSQL.
   */
  static async getPurchaseById(businessId: string, purchaseId: string, tx?: TransactionContext) {
    const purchase = await dbQueryOne<any>(
      `SELECT p.*, s.phone as supplier_phone, s.email as supplier_email, s.address as supplier_address
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ? AND p.business_id = ?`,
      [purchaseId, businessId],
      tx
    );

    if (!purchase) {
      throw new Error('Purchase bill not found');
    }

    const items = await dbQueryAll<any>(
      `SELECT pi.*, pr.name as catalog_product_name, pr.sku as product_sku, pr.barcode as product_barcode
       FROM purchase_items pi
       LEFT JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id ASC`,
      [purchaseId],
      tx
    );

    const payments = await dbQueryAll<any>(
      `SELECT * FROM payments WHERE purchase_id = ? AND business_id = ? ORDER BY payment_date DESC, created_at DESC`,
      [purchaseId, businessId],
      tx
    );

    return {
      ...purchase,
      items,
      payments,
    };
  }

  /**
   * Create a new Inward Purchase Bill & automatically replenish inventory atomically
   */
  static async createPurchase(businessId: string, userId: string, payload: CreatePurchasePayload) {
    if (!payload.supplier_name || !payload.bill_number || !payload.items || payload.items.length === 0) {
      throw new Error('Supplier name, bill number, and at least one item are required');
    }

    return withTransaction(async (tx) => {
      const business = await tx.queryOne<any>(`SELECT * FROM businesses WHERE id = ?`, [businessId]);
      if (!business) {
        throw new Error('Business tenant not found');
      }

      const now = new Date().toISOString();

      // Auto-create or link supplier if supplier_id is not provided
      let supplierId = payload.supplier_id;
      if (!supplierId && payload.supplier_name) {
        const existing = await tx.queryOne<any>(
          `SELECT id, state, gstin FROM suppliers WHERE business_id = ? AND LOWER(name) = LOWER(?)`,
          [businessId, payload.supplier_name.trim()]
        );
        if (existing) {
          supplierId = existing.id;
        } else {
          supplierId = uuidv4();
          await tx.run(
            `INSERT INTO suppliers (id, business_id, name, gstin, state, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              supplierId,
              businessId,
              payload.supplier_name.trim(),
              payload.supplier_gstin || '',
              payload.supplier_state || business.state || 'Maharashtra',
              now,
            ]
          );
        }
      }

      // Determine GST tax split (Intra-state vs Inter-state)
      const supplierState = (payload.supplier_state || '').trim().toLowerCase();
      const businessState = (business.state || '').trim().toLowerCase();
      const isInterState = supplierState && businessState && supplierState !== businessState;

      let subtotal = 0;
      let discount_total = 0;
      let cgst_total = 0;
      let sgst_total = 0;
      let igst_total = 0;
      let tax_total = 0;

      const purchaseId = uuidv4();
      const processedItems: any[] = [];

      for (const item of payload.items) {
        const qty = Math.max(0, Number(item.quantity) || 1);
        const unitCost = Math.max(0, Number(item.unit_cost) || 0);
        const discPercent = Math.max(0, Number(item.discount_percent) || 0);
        const taxRate = Math.max(0, Number(item.tax_rate) ?? 18);

        const rawGross = roundPaise(qty * unitCost);
        const lineDiscount = roundPaise(rawGross * (discPercent / 100));
        const taxable = roundPaise(rawGross - lineDiscount);

        let lineCgst = 0;
        let lineSgst = 0;
        let lineIgst = 0;

        if (isInterState) {
          lineIgst = roundPaise(taxable * (taxRate / 100));
        } else {
          lineCgst = roundPaise(taxable * (taxRate / 200));
          lineSgst = roundPaise(taxable * (taxRate / 200));
        }

        const lineTax = roundPaise(lineCgst + lineSgst + lineIgst);
        const lineTotal = roundPaise(taxable + lineTax);

        subtotal = roundPaise(subtotal + rawGross);
        discount_total = roundPaise(discount_total + lineDiscount);
        cgst_total = roundPaise(cgst_total + lineCgst);
        sgst_total = roundPaise(sgst_total + lineSgst);
        igst_total = roundPaise(igst_total + lineIgst);
        tax_total = roundPaise(tax_total + lineTax);

        const itemId = uuidv4();
        processedItems.push({
          id: itemId,
          purchase_id: purchaseId,
          product_id: item.product_id || null,
          item_name: item.item_name,
          hsn_code: item.hsn_code || '',
          quantity: qty,
          unit: item.unit || 'PCS',
          unit_cost: unitCost,
          discount_percent: discPercent,
          tax_rate: taxRate,
          taxable_amount: taxable,
          cgst_amount: lineCgst,
          sgst_amount: lineSgst,
          igst_amount: lineIgst,
          total_amount: lineTotal,
        });
      }

      const calculatedNet = roundPaise(subtotal - discount_total + tax_total);
      const roundOff = Number(payload.round_off || 0);
      const grandTotal = roundPaise(calculatedNet + roundOff);
      const paidAmount = Math.min(grandTotal, Math.max(0, Number(payload.paid_amount || 0)));
      const balanceDue = roundPaise(Math.max(0, grandTotal - paidAmount));

      let paymentStatus = 'UNPAID';
      if (balanceDue <= 0 && grandTotal > 0) {
        paymentStatus = 'PAID';
      } else if (paidAmount > 0) {
        paymentStatus = 'PARTIAL';
      }

      // 1. Insert Purchase Header
      await tx.run(
        `INSERT INTO purchases (
          id, business_id, supplier_id, supplier_name, supplier_gstin, supplier_state,
          bill_number, bill_date, due_date, subtotal, tax_total, cgst_total, sgst_total,
          igst_total, discount_total, round_off, grand_total, paid_amount, balance_due,
          payment_status, payment_method, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          businessId,
          supplierId || null,
          payload.supplier_name.trim(),
          payload.supplier_gstin || null,
          payload.supplier_state || business.state || 'Maharashtra',
          payload.bill_number.trim(),
          payload.bill_date,
          payload.due_date || null,
          subtotal,
          tax_total,
          cgst_total,
          sgst_total,
          igst_total,
          discount_total,
          roundOff,
          grandTotal,
          paidAmount,
          balanceDue,
          paymentStatus,
          payload.payment_method || (paidAmount > 0 ? 'BANK_TRANSFER' : null),
          payload.notes || null,
          now,
        ]
      );

      // 2. Insert items and replenish inventory stock
      for (const item of processedItems) {
        await tx.run(
          `INSERT INTO purchase_items (
            id, purchase_id, product_id, item_name, hsn_code, quantity, unit,
            unit_cost, discount_percent, tax_rate, taxable_amount, cgst_amount,
            sgst_amount, igst_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.purchase_id,
            item.product_id,
            item.item_name,
            item.hsn_code,
            item.quantity,
            item.unit,
            item.unit_cost,
            item.discount_percent,
            item.tax_rate,
            item.taxable_amount,
            item.cgst_amount,
            item.sgst_amount,
            item.igst_amount,
            item.total_amount,
          ]
        );

        if (item.product_id) {
          const prod = await tx.queryOne<any>(
            `SELECT id, current_stock, purchase_price FROM products WHERE id = ? AND business_id = ?`,
            [item.product_id, businessId]
          );
          if (prod) {
            const prevStock = Number(prod.current_stock || 0);
            const nextStock = prevStock + Number(item.quantity);

            await tx.run(
              `UPDATE products SET current_stock = ?, purchase_price = ?, updated_at = ? WHERE id = ?`,
              [nextStock, item.unit_cost, now, item.product_id]
            );

            await tx.run(
              `INSERT INTO stock_adjustments (
                id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
              ) VALUES (?, ?, ?, 'ADD', ?, ?, ?, 'PURCHASE_RECEIPT', ?, ?, ?)`,
              [uuidv4(), businessId, item.product_id, item.quantity, prevStock, nextStock, payload.bill_number, userId, now]
            );
          }
        }
      }

      // 3. Update Supplier balance if credit was taken
      if (supplierId && balanceDue > 0) {
        const supp = await tx.queryOne<any>(`SELECT id, current_balance FROM suppliers WHERE id = ? AND business_id = ?`, [supplierId, businessId]);
        if (supp) {
          const newBal = Number(supp.current_balance || 0) + balanceDue;
          await tx.run(`UPDATE suppliers SET current_balance = ? WHERE id = ?`, [newBal, supplierId]);
        }
      }

      // 4. Record payment if paid
      if (paidAmount > 0) {
        const mode = payload.payment_method || 'BANK_TRANSFER';
        await tx.run(
          `INSERT INTO payments (
            id, business_id, direction, entity_type, entity_id, entity_name, purchase_id,
            amount, payment_mode, reference_number, account_type, payment_date, notes, created_at
          ) VALUES (?, ?, 'OUT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            businessId,
            supplierId || null,
            payload.supplier_name.trim(),
            purchaseId,
            paidAmount,
            mode,
            payload.bill_number,
            mode === 'CASH' ? 'CASH' : 'BANK',
            payload.bill_date,
            `Inward purchase payment against Bill #${payload.bill_number}`,
            now,
          ]
        );
      }

      // 5. Audit Log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CREATE_PURCHASE', 'PURCHASE', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          purchaseId,
          JSON.stringify({ bill_number: payload.bill_number, grand_total: grandTotal, supplier_name: payload.supplier_name }),
          now,
        ]
      );

      return this.getPurchaseById(businessId, purchaseId, tx);
    });
  }

  /**
   * Record payment made to a supplier against a purchase bill
   */
  static async recordPurchasePayment(
    businessId: string,
    _userId: string,
    purchaseId: string,
    payload: {
      amount: number;
      payment_mode: string;
      reference_number?: string;
      payment_date?: string;
      notes?: string;
    }
  ) {
    return withTransaction(async (tx) => {
      const purchase = await tx.queryOne<any>(`SELECT * FROM purchases WHERE id = ? AND business_id = ?`, [purchaseId, businessId]);
      if (!purchase) throw new Error('Purchase bill not found');

      const paymentAmount = roundPaise(payload.amount);
      if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');
      if (paymentAmount > addMoney(purchase.balance_due, 0.01)) {
        throw new Error(`Payment amount (₹${paymentAmount}) exceeds outstanding balance due (₹${purchase.balance_due})`);
      }

      const now = new Date().toISOString();
      const newPaidAmount = addMoney(purchase.paid_amount, paymentAmount);
      const newBalanceDue = Math.max(0, subtractMoney(purchase.grand_total, newPaidAmount));
      const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIAL';

      await tx.run(
        `UPDATE purchases 
         SET paid_amount = ?, balance_due = ?, payment_status = ?
         WHERE id = ? AND business_id = ?`,
        [newPaidAmount, newBalanceDue, newStatus, purchaseId, businessId]
      );

      const mode = payload.payment_mode || 'BANK_TRANSFER';
      await tx.run(
        `INSERT INTO payments (
          id, business_id, direction, entity_type, entity_id, entity_name, purchase_id,
          amount, payment_mode, reference_number, account_type, payment_date, notes, created_at
        ) VALUES (?, ?, 'OUT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          purchase.supplier_id || null,
          purchase.supplier_name,
          purchaseId,
          paymentAmount,
          mode,
          payload.reference_number || null,
          mode === 'CASH' ? 'CASH' : 'BANK',
          payload.payment_date || now.split('T')[0],
          payload.notes || `Supplier payment for Bill #${purchase.bill_number}`,
          now,
        ]
      );

      // Reduce supplier balance
      if (purchase.supplier_id) {
        const supp = await tx.queryOne<any>(`SELECT id, current_balance FROM suppliers WHERE id = ? AND business_id = ?`, [purchase.supplier_id, businessId]);
        if (supp) {
          const newSuppBal = Math.max(0, subtractMoney(supp.current_balance || 0, paymentAmount));
          await tx.run(`UPDATE suppliers SET current_balance = ? WHERE id = ?`, [newSuppBal, purchase.supplier_id]);
        }
      }

      return this.getPurchaseById(businessId, purchaseId, tx);
    });
  }

  // Alias for backward compatibility
  static recordPayment = PurchasesService.recordPurchasePayment;

  /**
   * Delete purchase and reverse inventory & supplier balance
   */
  static async deletePurchase(businessId: string, userId: string, purchaseId: string) {
    return withTransaction(async (tx) => {
      const purchase = await tx.queryOne<any>(`SELECT * FROM purchases WHERE id = ? AND business_id = ?`, [purchaseId, businessId]);
      if (!purchase) throw new Error('Purchase bill not found');

      const now = new Date().toISOString();
      const items = await tx.queryAll<any>(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);

      for (const item of items) {
        if (item.product_id) {
          const prod = await tx.queryOne<any>(`SELECT id, current_stock FROM products WHERE id = ? AND business_id = ?`, [item.product_id, businessId]);
          if (prod) {
            const prev = Number(prod.current_stock);
            const nextStock = Math.max(0, prev - Number(item.quantity));
            await tx.run(`UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`, [nextStock, now, item.product_id]);
            await tx.run(
              `INSERT INTO stock_adjustments (
                id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
              ) VALUES (?, ?, ?, 'REDUCE', ?, ?, ?, 'VOID_PURCHASE', ?, ?, ?)`,
              [uuidv4(), businessId, item.product_id, Number(item.quantity), prev, nextStock, `VOID-${purchase.bill_number}`, userId, now]
            );
          }
        }
      }

      if (purchase.supplier_id && Number(purchase.balance_due) > 0) {
        const supp = await tx.queryOne<any>(`SELECT id, current_balance FROM suppliers WHERE id = ? AND business_id = ?`, [purchase.supplier_id, businessId]);
        if (supp) {
          const newBal = Math.max(0, Number(supp.current_balance || 0) - Number(purchase.balance_due));
          await tx.run(`UPDATE suppliers SET current_balance = ? WHERE id = ?`, [newBal, purchase.supplier_id]);
        }
      }

      await tx.run(`DELETE FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
      await tx.run(`DELETE FROM payments WHERE purchase_id = ? AND business_id = ?`, [purchaseId, businessId]);
      await tx.run(`DELETE FROM purchases WHERE id = ? AND business_id = ?`, [purchaseId, businessId]);

      return { success: true, message: `Purchase bill #${purchase.bill_number} deleted successfully` };
    });
  }

  /**
   * List Expenses with filter
   */
  static async getExpenses(businessId: string, filters: { category?: string; startDate?: string; endDate?: string } = {}) {
    let sql = `SELECT * FROM expenses WHERE business_id = ?`;
    const params: any[] = [businessId];

    if (filters.category && filters.category !== 'ALL') {
      sql += ` AND category = ?`;
      params.push(filters.category);
    }
    if (filters.startDate) {
      sql += ` AND expense_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND expense_date <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY expense_date DESC, created_at DESC`;
    return dbQueryAll<any>(sql, params);
  }

  /**
   * Create an Expense record
   */
  static async createExpense(businessId: string, userId: string, payload: CreateExpensePayload) {
    const expenseId = uuidv4();
    const now = new Date().toISOString();
    const amount = Number(payload.amount) || 0;
    const taxRate = Number(payload.tax_rate) || 0;
    const taxable = payload.taxable_amount ?? (taxRate > 0 ? roundPaise(amount / (1 + taxRate / 100)) : amount);
    const gstAmt = payload.gst_amount ?? roundPaise(amount - taxable);

    await dbRun(
      `INSERT INTO expenses (
        id, business_id, category, amount, expense_date, payment_method, vendor_name,
        gstin, tax_rate, taxable_amount, gst_amount, is_itc_eligible, reference_no, description, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenseId,
        businessId,
        payload.category,
        amount,
        payload.expense_date,
        payload.payment_method || 'CASH',
        payload.vendor_name || null,
        payload.gstin || null,
        taxRate,
        taxable,
        gstAmt,
        payload.is_itc_eligible !== false ? 1 : 0,
        payload.reference_no || null,
        payload.description || null,
        userId,
        now,
      ]
    );

    return dbQueryOne<any>(`SELECT * FROM expenses WHERE id = ?`, [expenseId]);
  }

  /**
   * Delete an expense record
   */
  static async deleteExpense(businessId: string, _userId: string, expenseId: string) {
    const expense = await dbQueryOne<any>(`SELECT id, category, amount FROM expenses WHERE id = ? AND business_id = ?`, [expenseId, businessId]);
    if (!expense) throw new Error('Expense record not found');
    await dbRun(`DELETE FROM expenses WHERE id = ? AND business_id = ?`, [expenseId, businessId]);
    return { success: true, message: `Expense record deleted successfully` };
  }
}
