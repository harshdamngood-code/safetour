import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';
import { dbQueryAll, dbQueryOne, dbRun, withTransaction } from '../../db/db-adapter.js';

export const partiesRouter = Router();

// Protect all party routes with JWT and multi-tenant isolation
partiesRouter.use(authenticateToken);
partiesRouter.use(enforceTenant);

/**
 * GET /api/parties
 * List customers and/or suppliers with balances, filter by type/search/status
 */
partiesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const type = (req.query.type as string) || 'all'; // 'all' | 'customer' | 'supplier'
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const status = (req.query.status as string) || 'all'; // 'all' | 'due' | 'settled'

    // 1. Fetch Customers
    let customers: any[] = [];
    if (type === 'all' || type === 'customer') {
      let query = `
        SELECT id, 'CUSTOMER' as party_type, name, company_name, phone, email, gstin, pan,
               billing_address, city, state, state_code, pincode, opening_balance,
               current_balance, credit_limit, is_active, created_at
        FROM customers
        WHERE business_id = ? AND is_active = 1
      `;
      const params: any[] = [businessId];

      if (search) {
        query += ` AND (LOWER(name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(COALESCE(gstin, '')) LIKE ? OR LOWER(COALESCE(city, '')) LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      if (status === 'due') {
        query += ` AND current_balance > 0`;
      } else if (status === 'settled') {
        query += ` AND current_balance <= 0`;
      }

      query += ` ORDER BY current_balance DESC, name ASC`;
      customers = await dbQueryAll<any>(query, params);
    }

    // 2. Fetch Suppliers
    let suppliers: any[] = [];
    if (type === 'all' || type === 'supplier') {
      let query = `
        SELECT id, 'SUPPLIER' as party_type, name, company_name, phone, email, gstin,
               address as billing_address, city, state, state_code, pincode, opening_balance,
               current_balance, 0 as credit_limit, is_active, created_at
        FROM suppliers
        WHERE business_id = ? AND is_active = 1
      `;
      const params: any[] = [businessId];

      if (search) {
        query += ` AND (LOWER(name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(COALESCE(gstin, '')) LIKE ? OR LOWER(COALESCE(city, '')) LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      if (status === 'due') {
        query += ` AND current_balance > 0`;
      } else if (status === 'settled') {
        query += ` AND current_balance <= 0`;
      }

      query += ` ORDER BY current_balance DESC, name ASC`;
      suppliers = await dbQueryAll<any>(query, params);
    }

    // Combine
    const parties = [...customers, ...suppliers];

    // Compute Tenant Khata Summary
    const custBalanceRes = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(current_balance), 0) as total, COUNT(*) as cnt FROM customers WHERE business_id = ? AND is_active = 1`,
      [businessId]
    );
    const suppBalanceRes = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(current_balance), 0) as total, COUNT(*) as cnt FROM suppliers WHERE business_id = ? AND is_active = 1`,
      [businessId]
    );

    const totalReceivable = Math.max(0, Number(custBalanceRes?.total || 0));
    const totalPayable = Math.max(0, Number(suppBalanceRes?.total || 0));
    const netKhata = totalReceivable - totalPayable;

    res.json({
      success: true,
      summary: {
        totalReceivable,
        totalPayable,
        netKhata,
        customerCount: Number(custBalanceRes?.cnt || 0),
        supplierCount: Number(suppBalanceRes?.cnt || 0),
        totalParties: Number(custBalanceRes?.cnt || 0) + Number(suppBalanceRes?.cnt || 0),
      },
      parties,
    });
  } catch (error: any) {
    console.error('[Parties API] Error listing parties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parties directory',
      error: error.message,
    });
  }
});

/**
 * GET /api/parties/customers
 * Returns active customers list for invoice/quotation creation dropdowns
 */
partiesRouter.get('/customers', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const customers = await dbQueryAll<any>(
      `SELECT id, 'CUSTOMER' as party_type, name, company_name, phone, email, gstin, pan,
              billing_address, shipping_address, city, state, state_code, pincode,
              opening_balance, current_balance, credit_limit, is_active, created_at
       FROM customers
       WHERE business_id = ? AND is_active = 1
       ORDER BY name ASC`,
      [businessId]
    );
    res.json({ success: true, data: customers, customers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch customers', error: error.message });
  }
});

/**
 * GET /api/parties/suppliers
 * Returns active suppliers list for purchase creation dropdowns
 */
partiesRouter.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const suppliers = await dbQueryAll<any>(
      `SELECT id, 'SUPPLIER' as party_type, name, company_name, phone, email, gstin,
              address as billing_address, city, state, state_code, pincode,
              opening_balance, current_balance, 0 as credit_limit, is_active, created_at
       FROM suppliers
       WHERE business_id = ? AND is_active = 1
       ORDER BY name ASC`,
      [businessId]
    );
    res.json({ success: true, data: suppliers, suppliers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch suppliers', error: error.message });
  }
});

/**
 * GET /api/parties/:id
 * Retrieve party profile + full statement/ledger
 */
partiesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const partyId = req.params.id;
    const type = (req.query.type as string) || 'CUSTOMER';

    let party: any = null;
    let ledgerEntries: any[] = [];

    if (type === 'CUSTOMER') {
      party = await dbQueryOne<any>(
        `SELECT id, 'CUSTOMER' as party_type, name, company_name, phone, email, gstin, pan,
                billing_address, shipping_address, city, state, state_code, pincode,
                opening_balance, current_balance, credit_limit, created_at
         FROM customers
         WHERE id = ? AND business_id = ?`,
        [partyId, businessId]
      );

      if (!party) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }

      // Customer Invoices (Debit - increases balance)
      const invoices = await dbQueryAll<any>(
        `SELECT id, invoice_number as voucher_no, invoice_date as date, 'INVOICE' as type,
                grand_total as debit, 0 as credit, payment_status,
                ('Sales Invoice #' || COALESCE(invoice_number, '')) as description
         FROM invoices
         WHERE customer_id = ? AND business_id = ?`,
        [partyId, businessId]
      );

      // Customer Payments (Credit - decreases balance)
      const payments = await dbQueryAll<any>(
        `SELECT id, reference_number as voucher_no, payment_date as date, 'PAYMENT_IN' as type,
                0 as debit, amount as credit, 'PAID' as payment_status,
                ('Payment Received (' || COALESCE(payment_mode, 'CASH') || ')' || CASE WHEN notes IS NOT NULL AND notes != '' THEN ' - ' || notes ELSE '' END) as description
         FROM payments
         WHERE entity_id = ? AND business_id = ? AND direction = 'IN'`,
        [partyId, businessId]
      );

      // Combine & sort chronologically
      const allTxns = [...invoices, ...payments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // Calculate running balance starting from opening balance
      let running = Number(party.opening_balance || 0);
      ledgerEntries = allTxns.map((t) => {
        running += Number(t.debit) - Number(t.credit);
        return {
          ...t,
          runningBalance: running,
        };
      });
    } else {
      // SUPPLIER
      party = await dbQueryOne<any>(
        `SELECT id, 'SUPPLIER' as party_type, name, company_name, phone, email, gstin,
                address as billing_address, city, state, state_code, pincode,
                opening_balance, current_balance, 0 as credit_limit, created_at
         FROM suppliers
         WHERE id = ? AND business_id = ?`,
        [partyId, businessId]
      );

      if (!party) {
        res.status(404).json({ success: false, message: 'Supplier not found' });
        return;
      }

      // Supplier Purchases (Credit - increases payable)
      const purchases = await dbQueryAll<any>(
        `SELECT id, bill_number as voucher_no, bill_date as date, 'PURCHASE' as type,
                0 as debit, grand_total as credit, payment_status,
                ('Purchase Bill #' || COALESCE(bill_number, '')) as description
         FROM purchases
         WHERE supplier_id = ? AND business_id = ?`,
        [partyId, businessId]
      );

      // Supplier Payments (Debit - decreases payable)
      const payments = await dbQueryAll<any>(
        `SELECT id, reference_number as voucher_no, payment_date as date, 'PAYMENT_OUT' as type,
                amount as debit, 0 as credit, 'PAID' as payment_status,
                ('Payment Made (' || COALESCE(payment_mode, 'CASH') || ')' || CASE WHEN notes IS NOT NULL AND notes != '' THEN ' - ' || notes ELSE '' END) as description
         FROM payments
         WHERE entity_id = ? AND business_id = ? AND direction = 'OUT'`,
        [partyId, businessId]
      );

      const allTxns = [...purchases, ...payments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      let running = Number(party.opening_balance || 0);
      ledgerEntries = allTxns.map((t) => {
        running += Number(t.credit) - Number(t.debit);
        return {
          ...t,
          runningBalance: running,
        };
      });
    }

    res.json({
      success: true,
      party,
      ledgerEntries,
    });
  } catch (error: any) {
    console.error('[Parties API] Error getting party ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch party ledger',
      error: error.message,
    });
  }
});

/**
 * POST /api/parties
 * Create customer or supplier with Indian GST fields and opening balance
 */
partiesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const {
      partyType, // 'CUSTOMER' | 'SUPPLIER'
      name,
      companyName,
      phone,
      email,
      gstin,
      pan,
      billingAddress,
      shippingAddress,
      city,
      state,
      stateCode,
      pincode,
      openingBalance,
      creditLimit,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Party name is required' });
      return;
    }

    const id = uuidv4();
    const opBal = Number(openingBalance) || 0;
    const credLim = Number(creditLimit) || 0;
    const cleanGstin = gstin ? gstin.trim().toUpperCase() : null;
    const cleanPan = pan ? pan.trim().toUpperCase() : null;

    if (partyType === 'SUPPLIER') {
      await dbRun(
        `INSERT INTO suppliers (
          id, business_id, name, company_name, phone, email, gstin,
          address, city, state, state_code, pincode, opening_balance,
          current_balance, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          businessId,
          name.trim(),
          companyName?.trim() || null,
          phone?.trim() || null,
          email?.trim() || null,
          cleanGstin,
          billingAddress?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          stateCode?.trim() || null,
          pincode?.trim() || null,
          opBal,
          opBal, // current balance initialized to opening balance
        ]
      );
    } else {
      // CUSTOMER
      await dbRun(
        `INSERT INTO customers (
          id, business_id, name, company_name, phone, email, gstin, pan,
          billing_address, shipping_address, city, state, state_code, pincode,
          opening_balance, current_balance, credit_limit, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          businessId,
          name.trim(),
          companyName?.trim() || null,
          phone?.trim() || null,
          email?.trim() || null,
          cleanGstin,
          cleanPan,
          billingAddress?.trim() || null,
          shippingAddress?.trim() || billingAddress?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          stateCode?.trim() || null,
          pincode?.trim() || null,
          opBal,
          opBal,
          credLim,
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: `${partyType === 'SUPPLIER' ? 'Supplier' : 'Customer'} created successfully`,
      partyId: id,
    });
  } catch (error: any) {
    console.error('[Parties API] Failed to create party:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create party',
      error: error.message,
    });
  }
});

/**
 * PUT /api/parties/:id
 * Update an existing party
 */
partiesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const partyId = req.params.id;
    const {
      partyType,
      name,
      companyName,
      phone,
      email,
      gstin,
      pan,
      billingAddress,
      city,
      state,
      stateCode,
      pincode,
      creditLimit,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Party name is required' });
      return;
    }

    const cleanGstin = gstin ? gstin.trim().toUpperCase() : null;
    const cleanPan = pan ? pan.trim().toUpperCase() : null;

    if (partyType === 'SUPPLIER') {
      await dbRun(
        `UPDATE suppliers
         SET name = ?, company_name = ?, phone = ?, email = ?, gstin = ?,
             address = ?, city = ?, state = ?, state_code = ?, pincode = ?
         WHERE id = ? AND business_id = ?`,
        [
          name.trim(),
          companyName?.trim() || null,
          phone?.trim() || null,
          email?.trim() || null,
          cleanGstin,
          billingAddress?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          stateCode?.trim() || null,
          pincode?.trim() || null,
          partyId,
          businessId,
        ]
      );
    } else {
      await dbRun(
        `UPDATE customers
         SET name = ?, company_name = ?, phone = ?, email = ?, gstin = ?, pan = ?,
             billing_address = ?, city = ?, state = ?, state_code = ?, pincode = ?, credit_limit = ?
         WHERE id = ? AND business_id = ?`,
        [
          name.trim(),
          companyName?.trim() || null,
          phone?.trim() || null,
          email?.trim() || null,
          cleanGstin,
          cleanPan,
          billingAddress?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          stateCode?.trim() || null,
          pincode?.trim() || null,
          Number(creditLimit) || 0,
          partyId,
          businessId,
        ]
      );
    }

    res.json({
      success: true,
      message: 'Party details updated successfully',
    });
  } catch (error: any) {
    console.error('[Parties API] Failed to update party:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update party',
      error: error.message,
    });
  }
});

/**
 * POST /api/parties/:id/payment
 * Record Payment In (Collection from customer) or Payment Out (Settlement to supplier)
 */
partiesRouter.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const partyId = req.params.id;
    const {
      partyType, // 'CUSTOMER' | 'SUPPLIER'
      amount,
      paymentMode, // 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE'
      accountType, // 'CASH' | 'BANK'
      paymentDate,
      referenceNumber,
      notes,
    } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'Valid payment amount greater than zero is required' });
      return;
    }

    const mode = paymentMode || 'UPI';
    const acc = accountType || (mode === 'CASH' ? 'CASH' : 'BANK');
    const date = paymentDate || new Date().toISOString().split('T')[0];
    const paymentId = uuidv4();
    const now = new Date().toISOString();

    const result = await withTransaction(async (tx) => {
      if (partyType === 'SUPPLIER') {
        const supplier = await tx.queryOne<any>(
          `SELECT id, name, current_balance FROM suppliers WHERE id = ? AND business_id = ?`,
          [partyId, businessId]
        );
        if (!supplier) {
          throw new Error('Supplier not found');
        }

        // 1. Insert into Payments Ledger (Direction: OUT)
        await tx.run(
          `INSERT INTO payments (
            id, business_id, direction, entity_type, entity_id, entity_name,
            amount, payment_mode, reference_number, account_type, payment_date, notes, created_at
          ) VALUES (?, ?, 'OUT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentId,
            businessId,
            supplier.id,
            supplier.name,
            numAmount,
            mode,
            referenceNumber || null,
            acc,
            date,
            notes || null,
            now,
          ]
        );

        // 2. Reduce supplier outstanding balance
        const newBal = Number(supplier.current_balance) - numAmount;
        await tx.run(`UPDATE suppliers SET current_balance = ? WHERE id = ? AND business_id = ?`, [newBal, supplier.id, businessId]);

        // 3. Allocate to oldest unpaid purchase bills if any
        const unpaidPurchases = await tx.queryAll<any>(
          `SELECT id, grand_total, paid_amount, balance_due FROM purchases
           WHERE supplier_id = ? AND business_id = ? AND payment_status != 'PAID'
           ORDER BY bill_date ASC`,
          [supplier.id, businessId]
        );

        let remaining = numAmount;
        for (const pur of unpaidPurchases) {
          if (remaining <= 0) break;
          const due = Number(pur.balance_due);
          const alloc = Math.min(remaining, due);
          const newPaid = Number(pur.paid_amount) + alloc;
          const newDue = due - alloc;
          const newStatus = newDue <= 0.01 ? 'PAID' : 'PARTIAL';

          await tx.run(
            `UPDATE purchases SET paid_amount = ?, balance_due = ?, payment_status = ? WHERE id = ? AND business_id = ?`,
            [newPaid, Math.max(0, newDue), newStatus, pur.id, businessId]
          );
          remaining -= alloc;
        }

        return {
          message: `Payment of ₹${numAmount} paid to ${supplier.name}`,
          paymentId,
          newBalance: newBal,
        };
      } else {
        // Customer Collection (Payment In)
        const customer = await tx.queryOne<any>(
          `SELECT id, name, current_balance FROM customers WHERE id = ? AND business_id = ?`,
          [partyId, businessId]
        );
        if (!customer) {
          throw new Error('Customer not found');
        }

        // 1. Insert into Payments Ledger (Direction: IN)
        await tx.run(
          `INSERT INTO payments (
            id, business_id, direction, entity_type, entity_id, entity_name,
            amount, payment_mode, reference_number, account_type, payment_date, notes, created_at
          ) VALUES (?, ?, 'IN', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentId,
            businessId,
            customer.id,
            customer.name,
            numAmount,
            mode,
            referenceNumber || null,
            acc,
            date,
            notes || null,
            now,
          ]
        );

        // 2. Reduce customer outstanding balance
        const newBal = Number(customer.current_balance) - numAmount;
        await tx.run(`UPDATE customers SET current_balance = ? WHERE id = ? AND business_id = ?`, [newBal, customer.id, businessId]);

        // 3. Allocate to oldest unpaid invoices
        const unpaidInvoices = await tx.queryAll<any>(
          `SELECT id, grand_total, paid_amount, balance_due FROM invoices
           WHERE customer_id = ? AND business_id = ? AND payment_status != 'PAID'
           ORDER BY invoice_date ASC`,
          [customer.id, businessId]
        );

        let remaining = numAmount;
        for (const inv of unpaidInvoices) {
          if (remaining <= 0) break;
          const due = Number(inv.balance_due);
          const alloc = Math.min(remaining, due);
          const newPaid = Number(inv.paid_amount) + alloc;
          const newDue = due - alloc;
          const newStatus = newDue <= 0.01 ? 'PAID' : 'PARTIAL';

          await tx.run(
            `UPDATE invoices SET paid_amount = ?, balance_due = ?, payment_status = ? WHERE id = ? AND business_id = ?`,
            [newPaid, Math.max(0, newDue), newStatus, inv.id, businessId]
          );
          remaining -= alloc;
        }

        return {
          message: `Payment of ₹${numAmount} collected from ${customer.name}`,
          paymentId,
          newBalance: newBal,
        };
      }
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Parties API] Payment recording failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record party payment',
    });
  }
});

/**
 * DELETE /api/parties/:id
 * Deactivate party
 */
partiesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const partyId = req.params.id;
    const type = (req.query.type as string) || 'CUSTOMER';

    if (type === 'SUPPLIER') {
      await dbRun(`UPDATE suppliers SET is_active = 0 WHERE id = ? AND business_id = ?`, [partyId, businessId]);
    } else {
      await dbRun(`UPDATE customers SET is_active = 0 WHERE id = ? AND business_id = ?`, [partyId, businessId]);
    }

    res.json({ success: true, message: 'Party deactivated successfully' });
  } catch (error: any) {
    console.error('[Parties API] Deactivate party failed:', error);
    res.status(500).json({ success: false, message: 'Failed to delete party', error: error.message });
  }
});
