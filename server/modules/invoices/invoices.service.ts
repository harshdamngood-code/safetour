import { v4 as uuidv4 } from 'uuid';
import {
  dbQueryAll,
  dbQueryOne,
  dbRun,
  withTransaction,
  TransactionContext,
  reserveNextDocumentNumber,
} from '../../db/db-adapter.js';
import {
  calculateInvoiceTotals,
  LineItemInput,
  roundPaise,
  addMoney,
  subtractMoney,
  roundQuantity,
} from '../../utils/finance.js';

export interface CreateInvoiceItemPayload {
  product_id?: string;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_rate: number;
  is_tax_inclusive?: boolean | number;
}

export interface CreateInvoicePayload {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  customer_state?: string;
  customer_state_code?: string;
  invoice_type?: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'QUOTATION' | 'PROFORMA';
  invoice_number?: string;
  invoice_date: string;
  due_date?: string;
  place_of_supply?: string;
  billing_address?: string;
  shipping_address?: string;
  po_number?: string;
  vehicle_number?: string;
  e_way_bill_no?: string;
  terms_conditions?: string;
  items: CreateInvoiceItemPayload[];
  paid_amount?: number;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  apply_round_off?: boolean;
}

export class InvoicesService {
  /**
   * Get KPI metrics and paginated / filtered list of invoices for a tenant.
   */
  static async listInvoices(
    businessId: string,
    filters: {
      search?: string;
      status?: string;
      invoice_type?: string;
      start_date?: string;
      end_date?: string;
      customer_id?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 50));
    const offset = (page - 1) * limit;

    // 1. Calculate high-level KPIs across all invoices for this business
    const kpiSql = `
      SELECT
        COUNT(*) as total_invoices_count,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' THEN grand_total ELSE 0 END), 0) as total_sales_volume,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' THEN paid_amount ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' THEN balance_due ELSE 0 END), 0) as total_receivable_due,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' THEN tax_total ELSE 0 END), 0) as total_gst_billed,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' AND payment_status = 'PAID' THEN 1 ELSE 0 END), 0) as paid_invoices_count,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' AND payment_status = 'PARTIAL' THEN 1 ELSE 0 END), 0) as partial_invoices_count,
        COALESCE(SUM(CASE WHEN invoice_type != 'QUOTATION' AND payment_status = 'UNPAID' THEN 1 ELSE 0 END), 0) as unpaid_invoices_count,
        COALESCE(SUM(CASE WHEN invoice_type = 'QUOTATION' THEN 1 ELSE 0 END), 0) as quotations_count
      FROM invoices
      WHERE business_id = ?
    `;
    const kpis = (await dbQueryOne<any>(kpiSql, [businessId])) || {
      total_invoices_count: 0,
      total_sales_volume: 0,
      total_collected: 0,
      total_receivable_due: 0,
      total_gst_billed: 0,
      paid_invoices_count: 0,
      partial_invoices_count: 0,
      unpaid_invoices_count: 0,
      quotations_count: 0,
    };

    // 2. Query invoices with filters
    let sql = `
      SELECT 
        i.*,
        (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as item_count
      FROM invoices i
      WHERE i.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.search) {
      sql += ` AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_phone LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.status) {
      sql += ` AND i.payment_status = ?`;
      params.push(filters.status);
    }

    if (filters.invoice_type) {
      sql += ` AND i.invoice_type = ?`;
      params.push(filters.invoice_type);
    }

    if (filters.customer_id) {
      sql += ` AND i.customer_id = ?`;
      params.push(filters.customer_id);
    }

    if (filters.start_date) {
      sql += ` AND i.invoice_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ` AND i.invoice_date <= ?`;
      params.push(filters.end_date);
    }

    sql += ` ORDER BY i.invoice_date DESC, i.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const invoices = await dbQueryAll<any>(sql, params);

    return {
      kpis,
      invoices,
      pagination: {
        page,
        limit,
        count: invoices.length,
      },
    };
  }

  /**
   * Concurrency-safe sequential invoice number preview
   */
  static async getNextInvoiceNumber(businessId: string, type: string = 'TAX_INVOICE') {
    const business = await dbQueryOne<any>(
      `SELECT invoice_prefix, quotation_prefix, invoice_next_number, quotation_next_number FROM businesses WHERE id = ?`,
      [businessId]
    );
    if (!business) throw new Error('Business not found');

    const prefix = business.invoice_prefix || 'INV';
    const quotePrefix = business.quotation_prefix || 'EST';
    const nextNum =
      type === 'QUOTATION'
        ? Number(business.quotation_next_number || business.invoice_next_number || 1001)
        : Number(business.invoice_next_number || 1001);

    let formatted = `${prefix}-${nextNum}`;
    if (type === 'QUOTATION') {
      formatted = `${quotePrefix}-${nextNum}`;
    } else if (type === 'BILL_OF_SUPPLY') {
      formatted = `BOS-${nextNum}`;
    } else if (type === 'PROFORMA') {
      formatted = `PI-${nextNum}`;
    }

    return {
      prefix: type === 'QUOTATION' ? quotePrefix : prefix,
      next_number: nextNum,
      suggested_invoice_number: formatted,
    };
  }

  /**
   * Get a full single invoice with items, customer details, and business legal profile.
   * Accepts an optional TransactionContext `tx` so uncommitted rows created inside a
   * PostgreSQL transaction are read on the SAME database connection.
   */
  static async getInvoiceById(businessId: string, invoiceId: string, tx?: TransactionContext) {
    const invoice = await dbQueryOne<any>(
      `SELECT * FROM invoices WHERE id = ? AND business_id = ?`,
      [invoiceId, businessId],
      tx
    );

    if (!invoice) {
      throw new Error('Invoice not found or unauthorized access');
    }

    const items = await dbQueryAll<any>(
      `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC`,
      [invoiceId],
      tx
    );

    const business = await dbQueryOne<any>(
      `SELECT * FROM businesses WHERE id = ?`,
      [businessId],
      tx
    );

    const payments = await dbQueryAll<any>(
      `SELECT * FROM payments WHERE invoice_id = ? AND business_id = ? ORDER BY payment_date DESC, created_at DESC`,
      [invoiceId, businessId],
      tx
    );

    let customer = null;
    if (invoice.customer_id) {
      customer = await dbQueryOne<any>(
        `SELECT * FROM customers WHERE id = ? AND business_id = ?`,
        [invoice.customer_id, businessId],
        tx
      );
    }

    return {
      ...invoice,
      items,
      business,
      customer,
      payments,
    };
  }

  /**
   * Create an Invoice / Quotation with atomic transaction, strict GST calculation, stock deduction, and khata balance sync.
   */
  static async createInvoice(businessId: string, userId: string, payload: CreateInvoicePayload) {
    const now = new Date().toISOString();
    const invoiceId = uuidv4();

    return withTransaction(async (tx) => {
      // 1. Fetch business details (with row lock in PostgreSQL) for state code / GST profile & sequence numbering
      const lockSuffix = tx.isPostgres ? ' FOR UPDATE' : '';
      const business = await tx.queryOne<any>(
        `SELECT * FROM businesses WHERE id = ?${lockSuffix}`,
        [businessId]
      );
      if (!business) throw new Error('Business workspace not found');

      // 2. Fetch customer details if provided
      let customer = null;
      if (payload.customer_id) {
        customer = await tx.queryOne<any>(
          `SELECT * FROM customers WHERE id = ? AND business_id = ?`,
          [payload.customer_id, businessId]
        );
      }

      // 3. Resolve & lock next sequential invoice number concurrency-safely
      const docType = payload.invoice_type || 'TAX_INVOICE';
      let invoiceNumber = payload.invoice_number?.trim();
      if (!invoiceNumber) {
        const reserved = await reserveNextDocumentNumber(tx, businessId, docType);
        invoiceNumber = reserved.formattedNumber;
      } else {
        // Validate uniqueness within tenant for custom-supplied invoice number
        const existing = await tx.queryOne<any>(
          `SELECT id FROM invoices WHERE business_id = ? AND invoice_number = ?`,
          [businessId, invoiceNumber]
        );
        if (existing) {
          throw new Error(`Invoice number "${invoiceNumber}" is already in use for this business.`);
        }
        // If custom number matches current next number, bump the sequence counter
        const reservedCheck = `${business.invoice_prefix || 'INV'}-${business.invoice_next_number || 1001}`;
        if (invoiceNumber === reservedCheck) {
          await tx.run(
            `UPDATE businesses SET invoice_next_number = COALESCE(invoice_next_number, 1001) + 1, updated_at = ? WHERE id = ?`,
            [now, businessId]
          );
        }
      }

      // 4. Perform authoritative backend financial and GST calculation
      const lineInputs: LineItemInput[] = (payload.items || []).map((it) => ({
        product_id: it.product_id,
        item_name: it.item_name,
        hsn_code: it.hsn_code,
        quantity: it.quantity,
        unit: it.unit || 'PCS',
        unit_price: it.unit_price,
        discount_percent: it.discount_percent,
        discount_amount: it.discount_amount,
        tax_rate: it.tax_rate,
        is_tax_inclusive: it.is_tax_inclusive,
      }));

      const fin = calculateInvoiceTotals({
        items: lineInputs,
        businessStateCode: business.state_code,
        businessState: business.state,
        customerStateCode: payload.customer_state_code || customer?.state_code,
        customerState: payload.customer_state || customer?.state,
        placeOfSupply: payload.place_of_supply,
        paidAmount: payload.paid_amount,
        applyRoundOff: payload.apply_round_off !== false,
      });

      const isQuote = docType === 'QUOTATION';
      const paidAmount = isQuote ? 0 : Math.min(fin.grand_total, roundPaise(payload.paid_amount || 0));
      const balanceDue = isQuote ? 0 : subtractMoney(fin.grand_total, paidAmount);
      const paymentStatus = isQuote ? 'QUOTATION' : fin.payment_status;

      // 5. Insert Invoice Header
      await tx.run(
        `INSERT INTO invoices (
          id, business_id, customer_id, customer_name, customer_phone, customer_gstin,
          customer_state, invoice_type, place_of_supply, billing_address, shipping_address,
          po_number, vehicle_number, e_way_bill_no, terms_conditions,
          invoice_number, invoice_date, due_date, subtotal, tax_total, cgst_total, sgst_total,
          igst_total, discount_total, round_off, grand_total, paid_amount, balance_due,
          payment_status, payment_method, notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          businessId,
          payload.customer_id || null,
          payload.customer_name || customer?.name || 'Walk-in Customer',
          payload.customer_phone || customer?.phone || null,
          payload.customer_gstin || customer?.gstin || null,
          payload.customer_state || customer?.state || null,
          docType,
          payload.place_of_supply || customer?.state || business.state,
          payload.billing_address || customer?.billing_address || null,
          payload.shipping_address || customer?.shipping_address || null,
          payload.po_number || null,
          payload.vehicle_number || null,
          payload.e_way_bill_no || null,
          payload.terms_conditions || business.terms_and_conditions || null,
          invoiceNumber,
          payload.invoice_date || now.split('T')[0],
          payload.due_date || null,
          fin.subtotal,
          fin.tax_total,
          fin.cgst_total,
          fin.sgst_total,
          fin.igst_total,
          fin.discount_total,
          fin.round_off,
          fin.grand_total,
          paidAmount,
          balanceDue,
          paymentStatus,
          payload.payment_method || (paidAmount > 0 ? 'CASH' : null),
          payload.notes || null,
          userId,
          now,
          now,
        ]
      );

      // 6. Insert Line Items & Auto-Deduct Inventory
      for (const item of fin.items) {
        const itemId = uuidv4();
        await tx.run(
          `INSERT INTO invoice_items (
            id, invoice_id, product_id, item_name, hsn_code, quantity, unit,
            unit_price, discount_percent, discount_amount, tax_rate, taxable_amount,
            cgst_amount, sgst_amount, igst_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            invoiceId,
            item.product_id || null,
            item.item_name,
            item.hsn_code || null,
            item.quantity,
            item.unit,
            item.unit_price,
            item.discount_percent,
            item.discount_amount,
            item.tax_rate,
            item.taxable_amount,
            item.cgst_amount,
            item.sgst_amount,
            item.igst_amount,
            item.total_amount,
          ]
        );

        // Deduct inventory stock if item is linked to a product catalog and it's a real sale
        if (!isQuote && item.product_id) {
          const prod = await tx.queryOne<any>(
            `SELECT id, current_stock FROM products WHERE id = ? AND business_id = ?`,
            [item.product_id, businessId]
          );
          if (prod) {
            const prevStock = roundQuantity(prod.current_stock);
            const newStock = roundQuantity(prevStock - item.quantity);
            await tx.run(
              `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
              [newStock, now, item.product_id]
            );

            // Record stock audit ledger entry
            await tx.run(
              `INSERT INTO stock_adjustments (
                id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
              ) VALUES (?, ?, ?, 'REDUCE', ?, ?, ?, 'SALE_DISPATCH', ?, ?, ?)`,
              [uuidv4(), businessId, item.product_id, item.quantity, prevStock, newStock, invoiceNumber, userId, now]
            );
          }
        }
      }

      // 7. Update Customer Khata / Udhar Balance if there is balance due
      if (!isQuote && payload.customer_id && balanceDue > 0) {
        const cust = await tx.queryOne<any>(
          `SELECT id, current_balance FROM customers WHERE id = ? AND business_id = ?`,
          [payload.customer_id, businessId]
        );
        if (cust) {
          const newBal = addMoney(cust.current_balance || 0, balanceDue);
          await tx.run(
            `UPDATE customers SET current_balance = ? WHERE id = ?`,
            [newBal, payload.customer_id]
          );
        }
      }

      // 8. If upfront payment was made, record in Payments Book
      if (!isQuote && paidAmount > 0) {
        const mode = payload.payment_method || 'CASH';
        await tx.run(
          `INSERT INTO payments (
            id, business_id, direction, entity_type, entity_id, entity_name, invoice_id,
            amount, payment_mode, reference_number, account_type, payment_date, notes, created_at
          ) VALUES (?, ?, 'IN', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            businessId,
            payload.customer_id || null,
            payload.customer_name || 'Walk-in Customer',
            invoiceId,
            paidAmount,
            mode,
            payload.payment_reference || null,
            mode === 'CASH' ? 'CASH' : 'BANK',
            payload.invoice_date || now.split('T')[0],
            `Payment for Invoice ${invoiceNumber}`,
            now,
          ]
        );
      }

      // 9. Audit Log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CREATE_INVOICE', 'INVOICE', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          invoiceId,
          JSON.stringify({ invoice_number: invoiceNumber, grand_total: fin.grand_total, invoice_type: docType }),
          now,
        ]
      );

      return this.getInvoiceById(businessId, invoiceId, tx);
    });
  }

  /**
   * Record a partial or full payment against an unpaid or partially paid invoice with atomic balance sync.
   */
  static async recordPayment(
    businessId: string,
    userId: string,
    invoiceId: string,
    payload: {
      amount: number;
      payment_mode: string;
      reference_number?: string;
      payment_date?: string;
      notes?: string;
    }
  ) {
    return withTransaction(async (tx) => {
      const invoice = await tx.queryOne<any>(
        `SELECT * FROM invoices WHERE id = ? AND business_id = ?`,
        [invoiceId, businessId]
      );
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.invoice_type === 'QUOTATION') throw new Error('Cannot record payment against a quotation');

      const paymentAmount = roundPaise(payload.amount);
      if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');
      if (paymentAmount > addMoney(invoice.balance_due, 0.01)) {
        throw new Error(`Payment amount (₹${paymentAmount}) exceeds outstanding balance due (₹${invoice.balance_due})`);
      }

      const now = new Date().toISOString();
      const newPaidAmount = addMoney(invoice.paid_amount, paymentAmount);
      const newBalanceDue = Math.max(0, subtractMoney(invoice.grand_total, newPaidAmount));
      const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIAL';

      // 1. Update Invoice
      await tx.run(
        `UPDATE invoices 
         SET paid_amount = ?, balance_due = ?, payment_status = ?, updated_at = ?
         WHERE id = ? AND business_id = ?`,
        [newPaidAmount, newBalanceDue, newStatus, now, invoiceId, businessId]
      );

      // 2. Record Payment in Cash/Bank Book
      const mode = payload.payment_mode || 'CASH';
      await tx.run(
        `INSERT INTO payments (
          id, business_id, direction, entity_type, entity_id, entity_name, invoice_id,
          amount, payment_mode, reference_number, account_type, payment_date, notes, created_at
        ) VALUES (?, ?, 'IN', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          invoice.customer_id || null,
          invoice.customer_name,
          invoiceId,
          paymentAmount,
          mode,
          payload.reference_number || null,
          mode === 'CASH' ? 'CASH' : 'BANK',
          payload.payment_date || now.split('T')[0],
          payload.notes || `Payment collection for Invoice ${invoice.invoice_number}`,
          now,
        ]
      );

      // 3. Update Customer Khata balance
      if (invoice.customer_id) {
        const cust = await tx.queryOne<any>(
          `SELECT id, current_balance FROM customers WHERE id = ? AND business_id = ?`,
          [invoice.customer_id, businessId]
        );
        if (cust) {
          const newCustBal = Math.max(0, subtractMoney(cust.current_balance || 0, paymentAmount));
          await tx.run(
            `UPDATE customers SET current_balance = ? WHERE id = ?`,
            [newCustBal, invoice.customer_id]
          );
        }
      }

      // 4. Audit Log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'RECORD_INVOICE_PAYMENT', 'INVOICE', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          invoiceId,
          JSON.stringify({ amount: paymentAmount, mode, invoice_number: invoice.invoice_number }),
          now,
        ]
      );

      return this.getInvoiceById(businessId, invoiceId, tx);
    });
  }

  /**
   * Convert Quotation / Estimate to full GST Tax Invoice using atomic sequence numbering.
   */
  static async convertQuotationToInvoice(businessId: string, userId: string, quotationId: string) {
    return withTransaction(async (tx) => {
      const quote = await tx.queryOne<any>(
        `SELECT * FROM invoices WHERE id = ? AND business_id = ? AND invoice_type = 'QUOTATION'`,
        [quotationId, businessId]
      );
      if (!quote) throw new Error('Quotation not found or already converted');

      const reserved = await reserveNextDocumentNumber(tx, businessId, 'TAX_INVOICE');
      const newInvoiceNumber = reserved.formattedNumber;
      const now = new Date().toISOString();

      // Deduct stock for all items
      const items = await tx.queryAll<any>(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [quotationId]);
      for (const item of items) {
        if (item.product_id) {
          const prod = await tx.queryOne<any>(
            `SELECT id, current_stock FROM products WHERE id = ? AND business_id = ?`,
            [item.product_id, businessId]
          );
          if (prod) {
            const prev = roundQuantity(prod.current_stock);
            const nextStock = roundQuantity(prev - Number(item.quantity));
            await tx.run(
              `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
              [nextStock, now, item.product_id]
            );
            await tx.run(
              `INSERT INTO stock_adjustments (
                id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
              ) VALUES (?, ?, ?, 'REDUCE', ?, ?, ?, 'SALE_DISPATCH', ?, ?, ?)`,
              [uuidv4(), businessId, item.product_id, roundQuantity(item.quantity), prev, nextStock, newInvoiceNumber, userId, now]
            );
          }
        }
      }

      // Update customer balance
      if (quote.customer_id) {
        const cust = await tx.queryOne<any>(
          `SELECT id, current_balance FROM customers WHERE id = ? AND business_id = ?`,
          [quote.customer_id, businessId]
        );
        if (cust) {
          const newBal = addMoney(cust.current_balance || 0, quote.grand_total);
          await tx.run(`UPDATE customers SET current_balance = ? WHERE id = ?`, [newBal, quote.customer_id]);
        }
      }

      // Update quote record into active tax invoice
      await tx.run(
        `UPDATE invoices SET
          invoice_type = 'TAX_INVOICE',
          invoice_number = ?,
          balance_due = grand_total,
          payment_status = 'UNPAID',
          updated_at = ?
        WHERE id = ? AND business_id = ?`,
        [newInvoiceNumber, now, quotationId, businessId]
      );

      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CONVERT_QUOTATION', 'INVOICE', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          quotationId,
          JSON.stringify({ invoice_number: newInvoiceNumber, previous_number: quote.invoice_number }),
          now,
        ]
      );

      return this.getInvoiceById(businessId, quotationId, tx);
    });
  }

  /**
   * Cancel / Delete Invoice (reverting stock adjustments and customer balances atomically).
   */
  static async deleteInvoice(businessId: string, userId: string, invoiceId: string) {
    return withTransaction(async (tx) => {
      const invoice = await tx.queryOne<any>(
        `SELECT * FROM invoices WHERE id = ? AND business_id = ?`,
        [invoiceId, businessId]
      );
      if (!invoice) throw new Error('Invoice not found');

      const now = new Date().toISOString();

      // If it's a regular invoice (not quote), reverse stock and customer balance
      if (invoice.invoice_type !== 'QUOTATION') {
        const items = await tx.queryAll<any>(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
        for (const item of items) {
          if (item.product_id) {
            const prod = await tx.queryOne<any>(
              `SELECT id, current_stock FROM products WHERE id = ? AND business_id = ?`,
              [item.product_id, businessId]
            );
            if (prod) {
              const prev = Number(prod.current_stock);
              const nextStock = prev + Number(item.quantity);
              await tx.run(
                `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
                [nextStock, now, item.product_id]
              );
              await tx.run(
                `INSERT INTO stock_adjustments (
                  id, business_id, product_id, adjustment_type, quantity, previous_stock, new_stock, reason, reference_no, created_by, created_at
                ) VALUES (?, ?, ?, 'ADD', ?, ?, ?, 'VOID_INVOICE', ?, ?, ?)`,
                [uuidv4(), businessId, item.product_id, Number(item.quantity), prev, nextStock, `VOID-${invoice.invoice_number}`, userId, now]
              );
            }
          }
        }

        // Revert customer balance
        if (invoice.customer_id && Number(invoice.balance_due) > 0) {
          const cust = await tx.queryOne<any>(
            `SELECT id, current_balance FROM customers WHERE id = ? AND business_id = ?`,
            [invoice.customer_id, businessId]
          );
          if (cust) {
            const newBal = Math.max(0, Number(cust.current_balance || 0) - Number(invoice.balance_due));
            await tx.run(
              `UPDATE customers SET current_balance = ? WHERE id = ?`,
              [newBal, invoice.customer_id]
            );
          }
        }
      }

      // Delete invoice items and payments associated with invoice
      await tx.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
      await tx.run(`DELETE FROM payments WHERE invoice_id = ? AND business_id = ?`, [invoiceId, businessId]);
      await tx.run(`DELETE FROM public_invoice_tokens WHERE invoice_id = ? AND business_id = ?`, [invoiceId, businessId]);
      await tx.run(`DELETE FROM invoices WHERE id = ? AND business_id = ?`, [invoiceId, businessId]);

      // Record audit
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'DELETE_INVOICE', 'INVOICE', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          invoiceId,
          JSON.stringify({ invoice_number: invoice.invoice_number }),
          now,
        ]
      );

      return { success: true, message: `Invoice ${invoice.invoice_number} voided and deleted successfully` };
    });
  }

  /**
   * Generates a cryptographically secure random public token for external WhatsApp / Customer sharing
   */
  static async generateShareLink(businessId: string, invoiceId: string) {
    const invoice = await dbQueryOne<any>(
      `SELECT id, invoice_number FROM invoices WHERE id = ? AND business_id = ?`,
      [invoiceId, businessId]
    );
    if (!invoice) throw new Error('Invoice not found');

    const existing = await dbQueryOne<any>(
      `SELECT share_token FROM public_invoice_tokens WHERE invoice_id = ? AND business_id = ?`,
      [invoiceId, businessId]
    );
    if (existing) {
      return { share_token: existing.share_token, share_url: `/public/invoice/${existing.share_token}` };
    }

    const shareToken = uuidv4().replace(/-/g, '') + uuidv4().slice(0, 8);
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO public_invoice_tokens (id, business_id, invoice_id, share_token, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), businessId, invoiceId, shareToken, now]
    );

    return {
      share_token: shareToken,
      share_url: `/public/invoice/${shareToken}`,
    };
  }

  /**
   * Retrieves public view-only invoice by secure share token without authentication
   */
  static async getInvoiceByShareToken(shareToken: string) {
    const tokenRecord = await dbQueryOne<any>(
      `SELECT * FROM public_invoice_tokens WHERE share_token = ?`,
      [shareToken]
    );
    if (!tokenRecord) {
      throw new Error('Invalid or expired invoice link');
    }

    // Increment view count
    await dbRun(`UPDATE public_invoice_tokens SET views_count = views_count + 1 WHERE id = ?`, [tokenRecord.id]);

    const invoice = await this.getInvoiceById(tokenRecord.business_id, tokenRecord.invoice_id);
    return invoice;
  }
}
