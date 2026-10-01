import { dbQueryAll, dbQueryOne } from '../../db/db-adapter.js';

export class ReportsService {
  /**
   * Calculate GSTR-1 Outward Supplies return
   */
  static async getGstr1(businessId: string, options: { startDate?: string; endDate?: string; month?: string }) {
    let startDate = options.startDate;
    let endDate = options.endDate;

    if (options.month) {
      // e.g. "2026-09"
      startDate = `${options.month}-01`;
      const [year, m] = options.month.split('-').map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      endDate = `${options.month}-${String(lastDay).padStart(2, '0')}`;
    }

    if (!startDate || !endDate) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      startDate = `${y}-${m}-01`;
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    }

    const business = await dbQueryOne<any>(`SELECT * FROM businesses WHERE id = ?`, [businessId]);
    const businessState = business?.state || 'Maharashtra';
    const businessStateCode = business?.state_code || '27';
    const businessGstin = business?.gstin || '';

    // Fetch all confirmed tax invoices and bills of supply in date range
    const invoices = await dbQueryAll<any>(
      `SELECT i.*, c.gstin as customer_master_gstin, c.state as customer_master_state, c.state_code as customer_master_state_code
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.business_id = ? 
         AND i.invoice_type IN ('TAX_INVOICE', 'BILL_OF_SUPPLY')
         AND i.invoice_date >= ? AND i.invoice_date <= ?
       ORDER BY i.invoice_date ASC, i.invoice_number ASC`,
      [businessId, startDate, endDate]
    );

    // Fetch all invoice items
    const invoiceIds = invoices.map((inv) => inv.id);
    let allItems: any[] = [];
    if (invoiceIds.length > 0) {
      const placeholders = invoiceIds.map(() => '?').join(',');
      allItems = await dbQueryAll<any>(
        `SELECT ii.*, i.invoice_number, i.invoice_date, i.customer_name, i.customer_gstin, i.place_of_supply, i.grand_total, i.cgst_total, i.sgst_total, i.igst_total
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE ii.invoice_id IN (${placeholders})
         ORDER BY i.invoice_date ASC`,
        invoiceIds
      );
    }

    // 1. Table 4: B2B Invoices (Customers with a valid GSTIN)
    const b2bInvoices = invoices.filter((inv) => {
      const gstin = (inv.customer_gstin || inv.customer_master_gstin || '').trim();
      return gstin.length >= 10;
    });

    const b2bSummary = b2bInvoices.map((inv) => {
      const invItems = allItems.filter((it) => it.invoice_id === inv.id);
      return {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        customer_name: inv.customer_name,
        customer_gstin: (inv.customer_gstin || inv.customer_master_gstin || '').toUpperCase(),
        place_of_supply: inv.place_of_supply || inv.customer_state || businessState,
        invoice_type: 'Regular',
        reverse_charge: 'N',
        taxable_value: Number(inv.subtotal || 0) - Number(inv.discount_total || 0),
        cgst: Number(inv.cgst_total || 0),
        sgst: Number(inv.sgst_total || 0),
        igst: Number(inv.igst_total || 0),
        total_tax: Number(inv.cgst_total || 0) + Number(inv.sgst_total || 0) + Number(inv.igst_total || 0),
        invoice_value: Number(inv.grand_total || 0),
        items_count: invItems.length,
      };
    });

    // 2. Table 5: B2C Large (Unregistered + Inter-state + Total Value > 2,50,000)
    const b2cLarge = invoices.filter((inv) => {
      const gstin = (inv.customer_gstin || inv.customer_master_gstin || '').trim();
      const isUnregistered = gstin.length < 10;
      const pos = (inv.place_of_supply || inv.customer_state || businessState).trim().toLowerCase();
      const isInterState = pos !== businessState.toLowerCase();
      return isUnregistered && isInterState && Number(inv.grand_total || 0) > 250000;
    });

    // 3. Table 7: B2C Small (All other unregistered retail supplies)
    const b2cSmallInvoices = invoices.filter((inv) => {
      const gstin = (inv.customer_gstin || inv.customer_master_gstin || '').trim();
      const isUnregistered = gstin.length < 10;
      const isB2CLarge = b2cLarge.some((l) => l.id === inv.id);
      return isUnregistered && !isB2CLarge;
    });

    // Group Table 7 by Place of Supply & Tax Rate
    const b2cSmallGroups: { [key: string]: { pos: string; tax_rate: number; taxable_value: number; cgst: number; sgst: number; igst: number; total: number } } = {};

    for (const inv of b2cSmallInvoices) {
      const items = allItems.filter((it) => it.invoice_id === inv.id);
      const pos = inv.place_of_supply || inv.customer_state || businessState;
      for (const item of items) {
        const rate = Number(item.tax_rate || 0);
        const key = `${pos}_${rate}`;
        if (!b2cSmallGroups[key]) {
          b2cSmallGroups[key] = {
            pos,
            tax_rate: rate,
            taxable_value: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: 0,
          };
        }
        b2cSmallGroups[key].taxable_value += Number(item.taxable_amount || 0);
        b2cSmallGroups[key].cgst += Number(item.cgst_amount || 0);
        b2cSmallGroups[key].sgst += Number(item.sgst_amount || 0);
        b2cSmallGroups[key].igst += Number(item.igst_amount || 0);
        b2cSmallGroups[key].total += Number(item.total_amount || 0);
      }
    }

    const b2cSmallSummary = Object.values(b2cSmallGroups).map((g) => ({
      ...g,
      taxable_value: Math.round(g.taxable_value * 100) / 100,
      cgst: Math.round(g.cgst * 100) / 100,
      sgst: Math.round(g.sgst * 100) / 100,
      igst: Math.round(g.igst * 100) / 100,
      total: Math.round(g.total * 100) / 100,
    }));

    // 4. Table 12: HSN Summary
    const hsnGroups: { [key: string]: { hsn_code: string; description: string; unit: string; total_quantity: number; total_value: number; taxable_value: number; cgst: number; sgst: number; igst: number } } = {};

    for (const item of allItems) {
      const hsn = item.hsn_code ? String(item.hsn_code).trim() : 'N/A';
      const key = `${hsn}_${item.tax_rate}`;
      if (!hsnGroups[key]) {
        hsnGroups[key] = {
          hsn_code: hsn,
          description: item.item_name || 'Item',
          unit: item.unit || 'PCS',
          total_quantity: 0,
          total_value: 0,
          taxable_value: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
        };
      }
      hsnGroups[key].total_quantity += Number(item.quantity || 0);
      hsnGroups[key].total_value += Number(item.total_amount || 0);
      hsnGroups[key].taxable_value += Number(item.taxable_amount || 0);
      hsnGroups[key].cgst += Number(item.cgst_amount || 0);
      hsnGroups[key].sgst += Number(item.sgst_amount || 0);
      hsnGroups[key].igst += Number(item.igst_amount || 0);
    }

    const hsnSummary = Object.values(hsnGroups).map((h) => ({
      ...h,
      total_value: Math.round(h.total_value * 100) / 100,
      taxable_value: Math.round(h.taxable_value * 100) / 100,
      cgst: Math.round(h.cgst * 100) / 100,
      sgst: Math.round(h.sgst * 100) / 100,
      igst: Math.round(h.igst * 100) / 100,
    }));

    // 5. Table 13: Documents Issued
    const docSummary = {
      nature_of_document: 'Invoices for outward supply',
      from_serial_no: invoices[0]?.invoice_number || 'N/A',
      to_serial_no: invoices[invoices.length - 1]?.invoice_number || 'N/A',
      total_number: invoices.length,
      cancelled_number: 0,
      net_issued: invoices.length,
    };

    // Overall Totals
    const totalTaxable = invoices.reduce((acc, i) => acc + (Number(i.subtotal || 0) - Number(i.discount_total || 0)), 0);
    const totalCgst = invoices.reduce((acc, i) => acc + Number(i.cgst_total || 0), 0);
    const totalSgst = invoices.reduce((acc, i) => acc + Number(i.sgst_total || 0), 0);
    const totalIgst = invoices.reduce((acc, i) => acc + Number(i.igst_total || 0), 0);
    const totalTax = totalCgst + totalSgst + totalIgst;
    const totalInvoiceValue = invoices.reduce((acc, i) => acc + Number(i.grand_total || 0), 0);

    return {
      period: { startDate, endDate },
      business: {
        legal_name: business?.legal_name || business?.business_name,
        gstin: businessGstin,
        state: businessState,
        state_code: businessStateCode,
      },
      summary: {
        total_invoices: invoices.length,
        b2b_count: b2bInvoices.length,
        b2c_small_count: b2cSmallInvoices.length,
        b2c_large_count: b2cLarge.length,
        total_taxable: Math.round(totalTaxable * 100) / 100,
        total_cgst: Math.round(totalCgst * 100) / 100,
        total_sgst: Math.round(totalSgst * 100) / 100,
        total_igst: Math.round(totalIgst * 100) / 100,
        total_tax: Math.round(totalTax * 100) / 100,
        total_invoice_value: Math.round(totalInvoiceValue * 100) / 100,
      },
      tables: {
        b2b: b2bSummary,
        b2c_large: b2cLarge,
        b2c_small: b2cSmallSummary,
        hsn: hsnSummary,
        doc_issued: [docSummary],
      },
    };
  }

  /**
   * Calculate GSTR-3B Monthly Return & Tax Liability vs ITC
   */
  static async getGstr3b(businessId: string, options: { month?: string; startDate?: string; endDate?: string }) {
    let startDate = options.startDate;
    let endDate = options.endDate;

    if (options.month) {
      startDate = `${options.month}-01`;
      const [year, m] = options.month.split('-').map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      endDate = `${options.month}-${String(lastDay).padStart(2, '0')}`;
    }

    if (!startDate || !endDate) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      startDate = `${y}-${m}-01`;
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    }

    const business = await dbQueryOne<any>(`SELECT * FROM businesses WHERE id = ?`, [businessId]);

    // 1. Output Supplies (Outward Tax Invoices)
    const outward = (await dbQueryOne<any>(
      `SELECT 
        COALESCE(SUM(subtotal - discount_total), 0) as taxable_value,
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(grand_total), 0) as total_value
       FROM invoices
       WHERE business_id = ? 
         AND invoice_type IN ('TAX_INVOICE', 'BILL_OF_SUPPLY')
         AND invoice_date >= ? AND invoice_date <= ?`,
      [businessId, startDate, endDate]
    )) || { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, total_value: 0 };

    // 2. Inward Purchases ITC (Input Tax Credit)
    const inwardPurchases = (await dbQueryOne<any>(
      `SELECT 
        COALESCE(SUM(subtotal - discount_total), 0) as taxable_value,
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(grand_total), 0) as total_value
       FROM purchases
       WHERE business_id = ? AND bill_date >= ? AND bill_date <= ?`,
      [businessId, startDate, endDate]
    )) || { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, total_value: 0 };

    // 3. Inward Expenses ITC (Eligible business overheads)
    const inwardExpenses = (await dbQueryOne<any>(
      `SELECT 
        COALESCE(SUM(taxable_amount), 0) as taxable_value,
        COALESCE(SUM(gst_amount), 0) as gst_total
       FROM expenses
       WHERE business_id = ? AND is_itc_eligible = 1 AND expense_date >= ? AND expense_date <= ?`,
      [businessId, startDate, endDate]
    )) || { taxable_value: 0, gst_total: 0 };

    // Assume 50/50 split for expense intra-state GST
    const expenseCgst = Number(inwardExpenses.gst_total || 0) / 2;
    const expenseSgst = Number(inwardExpenses.gst_total || 0) / 2;

    const totalItcIgst = Number(inwardPurchases.igst || 0);
    const totalItcCgst = Number(inwardPurchases.cgst || 0) + expenseCgst;
    const totalItcSgst = Number(inwardPurchases.sgst || 0) + expenseSgst;
    const totalItc = totalItcIgst + totalItcCgst + totalItcSgst;

    const outIgst = Number(outward.igst || 0);
    const outCgst = Number(outward.cgst || 0);
    const outSgst = Number(outward.sgst || 0);

    // 4. Net Tax Payable (Output Tax minus Available ITC)
    const netIgstPayable = Math.max(0, outIgst - totalItcIgst);
    const netCgstPayable = Math.max(0, outCgst - totalItcCgst);
    const netSgstPayable = Math.max(0, outSgst - totalItcSgst);
    const totalNetPayable = netIgstPayable + netCgstPayable + netSgstPayable;

    // Available ITC carried forward
    const itcCarriedForward = {
      igst: Math.max(0, totalItcIgst - outIgst),
      cgst: Math.max(0, totalItcCgst - outCgst),
      sgst: Math.max(0, totalItcSgst - outSgst),
    };

    return {
      period: { startDate, endDate },
      business: {
        legal_name: business?.legal_name || business?.business_name,
        gstin: business?.gstin || '',
        state: business?.state,
      },
      table3_1: {
        nature_of_supplies: '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
        taxable_value: Math.round(Number(outward.taxable_value || 0) * 100) / 100,
        integrated_tax: Math.round(outIgst * 100) / 100,
        central_tax: Math.round(outCgst * 100) / 100,
        state_tax: Math.round(outSgst * 100) / 100,
        cess: 0,
      },
      table4_itc: {
        nature: '(A) (5) All other ITC (From Purchases & Business Expenses)',
        taxable_value: Math.round((Number(inwardPurchases.taxable_value || 0) + Number(inwardExpenses.taxable_value || 0)) * 100) / 100,
        integrated_tax: Math.round(totalItcIgst * 100) / 100,
        central_tax: Math.round(totalItcCgst * 100) / 100,
        state_tax: Math.round(totalItcSgst * 100) / 100,
        total_itc: Math.round(totalItc * 100) / 100,
      },
      table5_1_net_payable: {
        integrated_tax: Math.round(netIgstPayable * 100) / 100,
        central_tax: Math.round(netCgstPayable * 100) / 100,
        state_tax: Math.round(netSgstPayable * 100) / 100,
        total_cash_payable: Math.round(totalNetPayable * 100) / 100,
      },
      itc_carried_forward: {
        integrated_tax: Math.round(itcCarriedForward.igst * 100) / 100,
        central_tax: Math.round(itcCarriedForward.cgst * 100) / 100,
        state_tax: Math.round(itcCarriedForward.sgst * 100) / 100,
        total_credit: Math.round((itcCarriedForward.igst + itcCarriedForward.cgst + itcCarriedForward.sgst) * 100) / 100,
      },
    };
  }

  /**
   * Profit & Loss (P&L) Statement
   */
  static async getProfitAndLoss(businessId: string, options: { startDate?: string; endDate?: string }) {
    const now = new Date();
    const startDate = options.startDate || `${now.getFullYear()}-04-01`; // Current Indian Financial Year start
    const endDate = options.endDate || now.toISOString().split('T')[0];

    // 1. Total Revenue (Sales)
    const sales = (await dbQueryOne<any>(
      `SELECT 
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(discount_total), 0) as total_discounts,
        COALESCE(SUM(subtotal - discount_total), 0) as net_sales_taxable,
        COALESCE(SUM(grand_total), 0) as total_revenue
       FROM invoices
       WHERE business_id = ? AND invoice_type IN ('TAX_INVOICE', 'BILL_OF_SUPPLY')
         AND invoice_date >= ? AND invoice_date <= ?`,
      [businessId, startDate, endDate]
    )) || { gross_sales: 0, total_discounts: 0, net_sales_taxable: 0, total_revenue: 0 };

    // 2. Cost of Goods Sold (COGS)
    const purchases = (await dbQueryOne<any>(
      `SELECT 
        COALESCE(SUM(subtotal - discount_total), 0) as net_purchases_taxable,
        COALESCE(SUM(grand_total), 0) as total_purchases
       FROM purchases
       WHERE business_id = ? AND bill_date >= ? AND bill_date <= ?`,
      [businessId, startDate, endDate]
    )) || { net_purchases_taxable: 0, total_purchases: 0 };

    // Stock valuation
    const stockValuationRes = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(current_stock * purchase_price), 0) as current_stock_value
       FROM products
       WHERE business_id = ?`,
      [businessId]
    );
    const stockValuation = Number(stockValuationRes?.current_stock_value || 0);

    const netSales = Number(sales.net_sales_taxable || 0);
    const cogs = Number(purchases.net_purchases_taxable || 0);
    const grossProfit = netSales - cogs;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    // 3. Operating Expenses grouped by category
    const expenseRows = await dbQueryAll<any>(
      `SELECT category, COALESCE(SUM(amount), 0) as total_amount
       FROM expenses
       WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY category
       ORDER BY total_amount DESC`,
      [businessId, startDate, endDate]
    );

    const totalExpenses = expenseRows.reduce((acc, row) => acc + Number(row.total_amount || 0), 0);

    const netProfit = grossProfit - totalExpenses;
    const netProfitMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    return {
      period: { startDate, endDate },
      income: {
        gross_sales: Math.round(Number(sales.gross_sales || 0) * 100) / 100,
        discounts: Math.round(Number(sales.total_discounts || 0) * 100) / 100,
        net_sales: Math.round(netSales * 100) / 100,
      },
      cost_of_goods_sold: {
        purchases: Math.round(Number(purchases.net_purchases_taxable || 0) * 100) / 100,
        cogs_total: Math.round(cogs * 100) / 100,
        closing_inventory_valuation: Math.round(stockValuation * 100) / 100,
      },
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin_percent: Math.round(grossMarginPercent * 10) / 10,
      operating_expenses: {
        categories: expenseRows.map((e) => ({
          category: e.category,
          amount: Math.round(Number(e.total_amount || 0) * 100) / 100,
          percent: totalExpenses > 0 ? Math.round((Number(e.total_amount || 0) / totalExpenses) * 1000) / 10 : 0,
        })),
        total_expenses: Math.round(totalExpenses * 100) / 100,
      },
      net_profit: Math.round(netProfit * 100) / 100,
      net_profit_margin_percent: Math.round(netProfitMarginPercent * 10) / 10,
    };
  }

  /**
   * Daybook - Comprehensive chronological transactions for any selected date
   */
  static async getDaybook(businessId: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Invoices issued on this day
    const invoices = await dbQueryAll<any>(
      `SELECT id, invoice_number as doc_no, customer_name as party_name, 'SALE_INVOICE' as type, grand_total as amount, paid_amount, balance_due, payment_status
       FROM invoices
       WHERE business_id = ? AND invoice_date = ?`,
      [businessId, targetDate]
    );

    // Payments received or made
    const payments = await dbQueryAll<any>(
      `SELECT id, direction, entity_type, entity_name as party_name, amount, payment_mode, reference_number, notes, created_at
       FROM payments
       WHERE business_id = ? AND payment_date = ?`,
      [businessId, targetDate]
    );

    // Purchases recorded on this day
    const purchases = await dbQueryAll<any>(
      `SELECT id, bill_number as doc_no, supplier_name as party_name, 'PURCHASE_BILL' as type, grand_total as amount, paid_amount, balance_due, payment_status
       FROM purchases
       WHERE business_id = ? AND bill_date = ?`,
      [businessId, targetDate]
    );

    // Expenses recorded on this day
    const expenses = await dbQueryAll<any>(
      `SELECT id, category, vendor_name as party_name, 'EXPENSE' as type, amount, payment_method, description
       FROM expenses
       WHERE business_id = ? AND expense_date = ?`,
      [businessId, targetDate]
    );

    const totalCashIn = payments.filter((p) => p.direction === 'IN').reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalCashOut = payments.filter((p) => p.direction === 'OUT').reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalSales = invoices.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalPurchases = purchases.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount || 0), 0);

    return {
      date: targetDate,
      summary: {
        total_sales: Math.round(totalSales * 100) / 100,
        total_purchases: Math.round(totalPurchases * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        cash_inflow: Math.round(totalCashIn * 100) / 100,
        cash_outflow: Math.round(totalCashOut * 100) / 100,
        net_cashflow: Math.round((totalCashIn - totalCashOut) * 100) / 100,
      },
      entries: {
        invoices,
        purchases,
        payments,
        expenses,
      },
    };
  }
}
