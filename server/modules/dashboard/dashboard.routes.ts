import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';
import { dbQueryAll, dbQueryOne, dbRun, withTransaction } from '../../db/db-adapter.js';

export const dashboardRouter = Router();

// Protect all dashboard endpoints with JWT auth and multi-tenant isolation
dashboardRouter.use(authenticateToken);
dashboardRouter.use(enforceTenant);

const formatYMD = (d: Date) => d.toISOString().split('T')[0];

/**
 * Helper to compute date bounds based on standard Indian accounting filters
 */
function getDateBounds(filter: string, customStart?: string, customEnd?: string): { start: string; end: string; prevStart: string; prevEnd: string } {
  const now = new Date();

  let start = formatYMD(now);
  let end = formatYMD(now);
  let prevStart = formatYMD(new Date(now.getTime() - 86400000));
  let prevEnd = formatYMD(new Date(now.getTime() - 86400000));

  if (filter === 'today') {
    start = formatYMD(now);
    end = formatYMD(now);
    const yesterday = new Date(now.getTime() - 86400000);
    prevStart = formatYMD(yesterday);
    prevEnd = formatYMD(yesterday);
  } else if (filter === 'yesterday') {
    const yest = new Date(now.getTime() - 86400000);
    start = formatYMD(yest);
    end = formatYMD(yest);
    const dayBefore = new Date(now.getTime() - 2 * 86400000);
    prevStart = formatYMD(dayBefore);
    prevEnd = formatYMD(dayBefore);
  } else if (filter === 'this_week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(now.setDate(diff));
    start = formatYMD(monday);
    end = formatYMD(new Date());

    const prevMon = new Date(monday.getTime() - 7 * 86400000);
    const prevSun = new Date(monday.getTime() - 1 * 86400000);
    prevStart = formatYMD(prevMon);
    prevEnd = formatYMD(prevSun);
  } else if (filter === 'this_month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    end = formatYMD(now);

    const prevMonthLastDate = new Date(y, m, 0);
    const prevMonthFirstDate = new Date(y, m - 1, 1);
    prevStart = formatYMD(prevMonthFirstDate);
    prevEnd = formatYMD(prevMonthLastDate);
  } else if (filter === 'last_month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const lastDay = new Date(y, m, 0);
    const firstDay = new Date(y, m - 1, 1);
    start = formatYMD(firstDay);
    end = formatYMD(lastDay);

    const prevLastDay = new Date(y, m - 1, 0);
    const prevFirstDay = new Date(y, m - 2, 1);
    prevStart = formatYMD(prevFirstDay);
    prevEnd = formatYMD(prevLastDay);
  } else if (filter === 'this_year') {
    // Indian Financial Year: April 1 to March 31
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    start = `${y}-04-01`;
    end = formatYMD(now);

    prevStart = `${y - 1}-04-01`;
    prevEnd = `${y}-03-31`;
  } else if (filter === 'custom' && customStart && customEnd) {
    start = customStart;
    end = customEnd;
    const diffDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
    prevEnd = formatYMD(new Date(new Date(start).getTime() - 86400000));
    prevStart = formatYMD(new Date(new Date(start).getTime() - (diffDays + 1) * 86400000));
  }

  return { start, end, prevStart, prevEnd };
}

/**
 * GET /api/dashboard/stats
 * Aggregates all live metrics, KPI indicators, graphs, recent ledgers, and inventory alerts
 */
dashboardRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const filter = (req.query.filter as string) || 'this_month';
    const customStart = req.query.startDate as string;
    const customEnd = req.query.endDate as string;

    const { start, end, prevStart, prevEnd } = getDateBounds(filter, customStart, customEnd);
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Period Sales (Invoices)
    const periodSalesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as total,
              COALESCE(SUM(paid_amount), 0) as collected,
              COALESCE(SUM(balance_due), 0) as due,
              COUNT(*) as count
       FROM invoices
       WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ?`,
      [businessId, start, end]
    );

    // Today's Sales
    const todaySalesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
       FROM invoices
       WHERE business_id = ? AND invoice_date = ?`,
      [businessId, todayStr]
    );

    // Previous Period Sales (for % comparison)
    const prevSalesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as total
       FROM invoices
       WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ?`,
      [businessId, prevStart, prevEnd]
    );

    // 2. Period Purchases
    const periodPurchasesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as total,
              COALESCE(SUM(paid_amount), 0) as paid,
              COALESCE(SUM(balance_due), 0) as due,
              COUNT(*) as count
       FROM purchases
       WHERE business_id = ? AND bill_date >= ? AND bill_date <= ?`,
      [businessId, start, end]
    );

    // Today's Purchases
    const todayPurchasesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
       FROM purchases
       WHERE business_id = ? AND bill_date = ?`,
      [businessId, todayStr]
    );

    // 3. Period Expenses
    const periodExpensesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses
       WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?`,
      [businessId, start, end]
    );

    // Today's Expenses
    const todayExpensesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses
       WHERE business_id = ? AND expense_date = ?`,
      [businessId, todayStr]
    );

    // 4. Cash & Bank Balances (Derived accurately from Payments Ledger)
    const cashInflowRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE business_id = ? AND account_type = 'CASH' AND direction = 'IN'`,
      [businessId]
    );
    const cashOutflowRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE business_id = ? AND account_type = 'CASH' AND direction = 'OUT'`,
      [businessId]
    );
    const cashBalance = Math.max(0, Number(cashInflowRow?.total || 0) - Number(cashOutflowRow?.total || 0));

    const bankInflowRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE business_id = ? AND account_type = 'BANK' AND direction = 'IN'`,
      [businessId]
    );
    const bankOutflowRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE business_id = ? AND account_type = 'BANK' AND direction = 'OUT'`,
      [businessId]
    );
    const bankBalance = Math.max(0, Number(bankInflowRow?.total || 0) - Number(bankOutflowRow?.total || 0));

    // 5. Total Receivables (from customers) and Payables (to suppliers)
    const receivablesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(balance_due), 0) as total FROM invoices WHERE business_id = ? AND balance_due > 0`,
      [businessId]
    );
    const payablesRow = await dbQueryOne<any>(
      `SELECT COALESCE(SUM(balance_due), 0) as total FROM purchases WHERE business_id = ? AND balance_due > 0`,
      [businessId]
    );

    // 6. Profit Calculations
    const salesTotal = Number(periodSalesRow?.total || 0);
    const purchasesTotal = Number(periodPurchasesRow?.total || 0);
    const expensesTotal = Number(periodExpensesRow?.total || 0);
    const grossProfit = salesTotal - purchasesTotal;
    const netProfit = salesTotal - purchasesTotal - expensesTotal;
    const netProfitMargin = salesTotal > 0 ? (netProfit / salesTotal) * 100 : 0;

    // Previous sales comparison percentage
    const prevSalesTotal = Number(prevSalesRow?.total || 0);
    const salesGrowthPct = prevSalesTotal > 0 ? ((salesTotal - prevSalesTotal) / prevSalesTotal) * 100 : 0;

    // 7. Sales & Purchases Graph / Trend data
    const salesByDate = await dbQueryAll<any>(
      `SELECT invoice_date as date, SUM(grand_total) as amount
       FROM invoices
       WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ?
       GROUP BY invoice_date
       ORDER BY invoice_date ASC`,
      [businessId, start, end]
    );

    const purchasesByDate = await dbQueryAll<any>(
      `SELECT bill_date as date, SUM(grand_total) as amount
       FROM purchases
       WHERE business_id = ? AND bill_date >= ? AND bill_date <= ?
       GROUP BY bill_date
       ORDER BY bill_date ASC`,
      [businessId, start, end]
    );

    // Merge into timeline
    const dateMap = new Map<string, { date: string; label: string; sales: number; purchases: number; profit: number }>();
    for (const s of salesByDate) {
      dateMap.set(s.date, {
        date: s.date,
        label: s.date.slice(5), // MM-DD
        sales: Number(s.amount),
        purchases: 0,
        profit: Number(s.amount),
      });
    }
    for (const p of purchasesByDate) {
      const existing = dateMap.get(p.date) || {
        date: p.date,
        label: p.date.slice(5),
        sales: 0,
        purchases: 0,
        profit: 0,
      };
      existing.purchases = Number(p.amount);
      existing.profit = existing.sales - existing.purchases;
      dateMap.set(p.date, existing);
    }

    const timeline = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 8. Expense Category Breakdown
    const expenseBreakdown = await dbQueryAll<any>(
      `SELECT category, SUM(amount) as amount, COUNT(*) as count
       FROM expenses
       WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY category
       ORDER BY amount DESC`,
      [businessId, start, end]
    );

    // 9. Low Stock Alert Products
    const lowStockProducts = await dbQueryAll<any>(
      `SELECT id, name, sku, category, unit, current_stock, min_stock_alert, selling_price,
              (min_stock_alert - current_stock) as deficit
       FROM products
       WHERE business_id = ? AND current_stock <= min_stock_alert AND is_active = 1
       ORDER BY current_stock ASC
       LIMIT 10`,
      [businessId]
    );

    // 10. Top Selling Products
    const topProducts = await dbQueryAll<any>(
      `SELECT ii.item_name, p.category, SUM(ii.quantity) as total_qty, SUM(ii.total_amount) as total_revenue
       FROM invoice_items ii
       JOIN invoices inv ON ii.invoice_id = inv.id
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE inv.business_id = ? AND inv.invoice_date >= ? AND inv.invoice_date <= ?
       GROUP BY ii.item_name, p.category
       ORDER BY total_revenue DESC
       LIMIT 5`,
      [businessId, start, end]
    );

    // 11. Recent Invoices
    const recentInvoices = await dbQueryAll<any>(
      `SELECT id, invoice_number, customer_name, customer_phone, invoice_date,
              grand_total, paid_amount, balance_due, payment_status, payment_method
       FROM invoices
       WHERE business_id = ?
       ORDER BY invoice_date DESC, created_at DESC
       LIMIT 8`,
      [businessId]
    );

    // 12. Recent Payments / Transactions
    const recentPayments = await dbQueryAll<any>(
      `SELECT id, direction, entity_type, entity_name, amount, payment_mode, account_type, payment_date, notes
       FROM payments
       WHERE business_id = ?
       ORDER BY payment_date DESC, created_at DESC
       LIMIT 8`,
      [businessId]
    );

    // 13. Monthly Comparison (This Month vs Last Month)
    const nowObj = new Date();
    const curYear = nowObj.getFullYear();
    const curMonth = nowObj.getMonth();
    const curMonthStart = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
    const curMonthEnd = formatYMD(nowObj);

    const prevMonthEndObj = new Date(curYear, curMonth, 0);
    const prevMonthStartObj = new Date(curYear, curMonth - 1, 1);
    const prevMonthStart = formatYMD(prevMonthStartObj);
    const prevMonthEnd = formatYMD(prevMonthEndObj);

    const curMonthSales = Number((await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as s FROM invoices WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ?`,
      [businessId, curMonthStart, curMonthEnd]
    ))?.s || 0);

    const prevMonthSales = Number((await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as s FROM invoices WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ?`,
      [businessId, prevMonthStart, prevMonthEnd]
    ))?.s || 0);

    const curMonthPurchases = Number((await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as p FROM purchases WHERE business_id = ? AND bill_date >= ? AND bill_date <= ?`,
      [businessId, curMonthStart, curMonthEnd]
    ))?.p || 0);

    const prevMonthPurchases = Number((await dbQueryOne<any>(
      `SELECT COALESCE(SUM(grand_total), 0) as p FROM purchases WHERE business_id = ? AND bill_date >= ? AND bill_date <= ?`,
      [businessId, prevMonthStart, prevMonthEnd]
    ))?.p || 0);

    const curMonthExpenses = Number((await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as e FROM expenses WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?`,
      [businessId, curMonthStart, curMonthEnd]
    ))?.e || 0);

    const prevMonthExpenses = Number((await dbQueryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as e FROM expenses WHERE business_id = ? AND expense_date >= ? AND expense_date <= ?`,
      [businessId, prevMonthStart, prevMonthEnd]
    ))?.e || 0);

    res.json({
      success: true,
      filter,
      dateRange: { start, end },
      summary: {
        sales: {
          periodTotal: salesTotal,
          periodCollected: Number(periodSalesRow?.collected || 0),
          periodDue: Number(periodSalesRow?.due || 0),
          periodCount: Number(periodSalesRow?.count || 0),
          todayTotal: Number(todaySalesRow?.total || 0),
          todayCount: Number(todaySalesRow?.count || 0),
          growthPct: salesGrowthPct,
        },
        purchases: {
          periodTotal: purchasesTotal,
          periodPaid: Number(periodPurchasesRow?.paid || 0),
          periodDue: Number(periodPurchasesRow?.due || 0),
          periodCount: Number(periodPurchasesRow?.count || 0),
          todayTotal: Number(todayPurchasesRow?.total || 0),
          todayCount: Number(todayPurchasesRow?.count || 0),
        },
        expenses: {
          periodTotal: expensesTotal,
          periodCount: Number(periodExpensesRow?.count || 0),
          todayTotal: Number(todayExpensesRow?.total || 0),
          todayCount: Number(todayExpensesRow?.count || 0),
        },
        liquidity: {
          cashBalance,
          bankBalance,
          totalLiquid: cashBalance + bankBalance,
          totalReceivables: Number(receivablesRow?.total || 0),
          totalPayables: Number(payablesRow?.total || 0),
          netWorkingCapital: (cashBalance + bankBalance + Number(receivablesRow?.total || 0)) - Number(payablesRow?.total || 0),
        },
        profit: {
          grossProfit,
          netProfit,
          netProfitMargin,
        },
      },
      monthlyComparison: {
        currentMonth: {
          sales: curMonthSales,
          purchases: curMonthPurchases,
          expenses: curMonthExpenses,
          profit: curMonthSales - curMonthPurchases - curMonthExpenses,
        },
        lastMonth: {
          sales: prevMonthSales,
          purchases: prevMonthPurchases,
          expenses: prevMonthExpenses,
          profit: prevMonthSales - prevMonthPurchases - prevMonthExpenses,
        },
        salesDeltaPct: prevMonthSales > 0 ? ((curMonthSales - prevMonthSales) / prevMonthSales) * 100 : 0,
      },
      timeline,
      expenseBreakdown: expenseBreakdown.map((e) => ({ ...e, amount: Number(e.amount), count: Number(e.count) })),
      lowStockProducts,
      topProducts: topProducts.map((p) => ({ ...p, total_qty: Number(p.total_qty), total_revenue: Number(p.total_revenue) })),
      recentInvoices,
      recentPayments,
    });
  } catch (error: any) {
    console.error('[Dashboard API] Failed to fetch stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to aggregate dashboard metrics',
      error: error.message,
    });
  }
});

/**
 * POST /api/dashboard/quick-expense
 * Directly records an operational expense and outward payment to update dashboard immediately.
 */
dashboardRouter.post('/quick-expense', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const userId = req.user?.userId;
    const { category, amount, paymentMethod, description, expenseDate } = req.body;

    if (!category || !amount || Number(amount) <= 0) {
      res.status(400).json({
        success: false,
        message: 'Category and a positive amount are required.',
      });
      return;
    }

    const expId = uuidv4();
    const date = expenseDate || new Date().toISOString().split('T')[0];
    const mode = paymentMethod || 'CASH';
    const accountType = mode === 'CASH' ? 'CASH' : 'BANK';
    const now = new Date().toISOString();

    await withTransaction(async (tx) => {
      // Insert expense
      await tx.run(
        `INSERT INTO expenses (id, business_id, category, amount, expense_date, payment_method, description, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [expId, businessId, category, Number(amount), date, mode, description || '', userId, now]
      );

      // Insert payment ledger entry
      await tx.run(
        `INSERT INTO payments (id, business_id, direction, entity_type, entity_name, amount, payment_mode, account_type, payment_date, notes, created_at)
         VALUES (?, ?, 'OUT', 'OTHER', ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), businessId, `Expense: ${category}`, Number(amount), mode, accountType, date, description || 'Quick expense recorded', now]
      );
    });

    res.json({
      success: true,
      message: 'Expense recorded successfully',
      expenseId: expId,
    });
  } catch (error: any) {
    console.error('[Dashboard API] Quick expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record expense',
      error: error.message,
    });
  }
});

/**
 * POST /api/dashboard/quick-product
 * Directly adds an inventory product to test live low-stock and catalog calculations.
 */
dashboardRouter.post('/quick-product', async (req: Request, res: Response) => {
  try {
    const businessId = req.businessId!;
    const { name, sku, category, unit, purchasePrice, sellingPrice, taxRate, currentStock, minStockAlert } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Product name is required.',
      });
      return;
    }

    const prodId = uuidv4();
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO products (
        id, business_id, name, sku, category, unit, purchase_price,
        selling_price, tax_rate, current_stock, min_stock_alert, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        prodId,
        businessId,
        name,
        sku || null,
        category || 'General',
        unit || 'PCS',
        Number(purchasePrice) || 0,
        Number(sellingPrice) || 0,
        Number(taxRate) || 18,
        Number(currentStock) || 0,
        Number(minStockAlert) || 10,
        now,
        now,
      ]
    );

    res.json({
      success: true,
      message: 'Product added successfully to inventory',
      productId: prodId,
    });
  } catch (error: any) {
    console.error('[Dashboard API] Quick product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product',
      error: error.message,
    });
  }
});
