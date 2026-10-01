export type DateFilterType = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export interface DashboardSalesSummary {
  periodTotal: number;
  periodCollected: number;
  periodDue: number;
  periodCount: number;
  todayTotal: number;
  todayCount: number;
  growthPct: number;
}

export interface DashboardPurchasesSummary {
  periodTotal: number;
  periodPaid: number;
  periodDue: number;
  periodCount: number;
  todayTotal: number;
  todayCount: number;
}

export interface DashboardExpensesSummary {
  periodTotal: number;
  periodCount: number;
  todayTotal: number;
  todayCount: number;
}

export interface DashboardLiquiditySummary {
  cashBalance: number;
  bankBalance: number;
  totalLiquid: number;
  totalReceivables: number;
  totalPayables: number;
  netWorkingCapital: number;
}

export interface DashboardProfitSummary {
  grossProfit: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface MonthMetrics {
  sales: number;
  purchases: number;
  expenses: number;
  profit: number;
}

export interface MonthlyComparison {
  currentMonth: MonthMetrics;
  lastMonth: MonthMetrics;
  salesDeltaPct: number;
}

export interface TimelinePoint {
  date: string;
  label: string;
  sales: number;
  purchases: number;
  profit: number;
}

export interface ExpenseBreakdownItem {
  category: string;
  amount: number;
  count: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  sku?: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock_alert: number;
  selling_price: number;
  deficit: number;
}

export interface TopSellingProduct {
  item_name: string;
  category?: string;
  total_qty: number;
  total_revenue: number;
}

export interface RecentInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  invoice_date: string;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  payment_method?: string;
}

export interface RecentPayment {
  id: string;
  direction: 'IN' | 'OUT';
  entity_type: 'CUSTOMER' | 'SUPPLIER' | 'OTHER';
  entity_name: string;
  amount: number;
  payment_mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';
  account_type: 'CASH' | 'BANK';
  payment_date: string;
  notes?: string;
}

export interface DashboardStatsResponse {
  success: boolean;
  filter: DateFilterType;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    sales: DashboardSalesSummary;
    purchases: DashboardPurchasesSummary;
    expenses: DashboardExpensesSummary;
    liquidity: DashboardLiquiditySummary;
    profit: DashboardProfitSummary;
  };
  monthlyComparison: MonthlyComparison;
  timeline: TimelinePoint[];
  expenseBreakdown: ExpenseBreakdownItem[];
  lowStockProducts: LowStockProduct[];
  topProducts: TopSellingProduct[];
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
}
