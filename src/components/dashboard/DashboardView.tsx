import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  DateFilterType,
  DashboardStatsResponse,
  LowStockProduct,
  TopSellingProduct,
  RecentInvoice,
  RecentPayment,
} from '../../types/dashboard.types';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  Wallet,
  Building2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  RefreshCw,
  Plus,
  Package,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
  Search,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { QuickExpenseModal } from './QuickExpenseModal';
import { QuickProductModal } from './QuickProductModal';
import { AppView, SubViewHint } from '../layout/Navbar';
import {
  TiltCard,
  GlassCard,
  AnimatedNumber,
  KPISkeletonGrid,
  ChartSkeleton,
  ProfitVisualization3D,
  EmptyState3D,
} from '../ui/3d-system';

interface DashboardViewProps {
  onOpenOnboarding: () => void;
  onNavigate?: (view: AppView, hint?: SubViewHint) => void;
}

const FILTER_LABELS: { id: DateFilterType; label: string }[] = [
  { id: 'today', label: "Today" },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This FY (2026-27)' },
  { id: 'custom', label: 'Custom Range' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenOnboarding, onNavigate }) => {
  const { activeBusiness, token } = useAuth();
  const [filter, setFilter] = useState<DateFilterType>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick modals state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // Tab for operational views
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'invoices' | 'payments'>('overview');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeBusiness?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const fetchDashboardStats = useCallback(
    async (isRefresh = false) => {
      if (!activeBusiness || !token) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        let url = `/dashboard/stats?filter=${filter}`;
        if (filter === 'custom' && customStart && customEnd) {
          url += `&startDate=${customStart}&endDate=${customEnd}`;
        }

        const data = await api.get<DashboardStatsResponse>(url);
        if (!data.success) {
          throw new Error(data.message || 'Failed to aggregate metrics');
        }

        setStats(data as unknown as DashboardStatsResponse);
      } catch (err: any) {
        console.error('[DashboardView] Fetch failed:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeBusiness, token, filter, customStart, customEnd]
  );

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      setFilter('custom');
      fetchDashboardStats();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP WELCOME COMMAND CENTER & TIMEFRAME FILTER BAR */}
      <GlassCard className="p-5 sm:p-6 overflow-hidden relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500/15 via-cyan-500/10 to-emerald-500/15 blur-3xl"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Business & Tenant Info */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-600/25 border border-white/15 shrink-0">
              {activeBusiness?.business_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {activeBusiness?.business_name}
                </h1>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-xs font-semibold text-indigo-400">
                  {activeBusiness?.role}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                <span>
                  GSTIN:{' '}
                  <span className="font-mono text-slate-200">
                    {activeBusiness?.gstin || 'Unregistered'}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  State:{' '}
                  <span className="text-slate-200">
                    {activeBusiness?.state} ({activeBusiness?.state_code})
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Invoice Series:{' '}
                  <span className="font-mono text-emerald-400">
                    {activeBusiness?.invoice_prefix}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigate && (
              <button
                onClick={() => onNavigate('invoices', 'invoices')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New GST Invoice
              </button>
            )}
            <button
              onClick={() => setExpenseModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5" />
              + Expense
            </button>
            <button
              onClick={() => setProductModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5" />
              + Product
            </button>
            <button
              onClick={onOpenOnboarding}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              Setup Wizard
            </button>
            <button
              onClick={() => fetchDashboardStats(true)}
              disabled={refreshing}
              title="Refresh Live Metrics"
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Interactive Timeframe Segmented Filter Bar */}
        <div className="relative z-10 mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Period:
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80">
              {FILTER_LABELS.map((item) => {
                const active = filter === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Date Range Display or Custom Inputs */}
          {filter === 'custom' ? (
            <form onSubmit={handleApplyCustomFilter} className="flex items-center gap-2">
              <input
                type="date"
                required
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                required
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Apply
              </button>
            </form>
          ) : stats?.dateRange ? (
            <div className="text-xs text-slate-400 font-mono">
              Window: <span className="text-slate-200">{stats.dateRange.start}</span>
              <span aria-hidden="true" className="mx-1.5 text-slate-600">→</span>
              <span className="text-slate-200">{stats.dateRange.end}</span>
            </div>
          ) : null}
        </div>
      </GlassCard>

      {error && (
        <div className="p-4 glass-panel border border-rose-500/40 text-rose-200 rounded-2xl text-xs flex items-center gap-3 animate-shake">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => fetchDashboardStats()}
            className="ml-auto px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. FLOATING 3D KPI CARDS (8 PRIMARY METRICS WITH CURSOR TILT & ANIMATED NUMBERS) */}
      {loading && !stats ? (
        <KPISkeletonGrid count={8} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Sales */}
          <TiltCard
            glowColor="emerald"
            onClick={() => onNavigate && onNavigate('invoices', 'sales')}
            className="p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                {filter === 'today' ? "Today's Sales" : 'Total Sales'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
              <AnimatedNumber
                value={stats?.summary.sales.periodTotal || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/70">
              <span className="text-slate-400">
                Today:{' '}
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(stats?.summary.sales.todayTotal || 0)}
                </strong>
              </span>
              <span className="text-slate-400 font-mono">
                {stats?.summary.sales.periodCount || 0} bills
              </span>
            </div>
          </TiltCard>

          {/* KPI 2: Purchases */}
          <TiltCard
            glowColor="indigo"
            onClick={() => onNavigate && onNavigate('purchases', 'purchases')}
            className="p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                {filter === 'today' ? "Today's Purchases" : 'Purchases'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
              <AnimatedNumber
                value={stats?.summary.purchases.periodTotal || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/70">
              <span className="text-slate-400">
                Today:{' '}
                <strong className="text-blue-400 font-mono">
                  {formatCurrency(stats?.summary.purchases.todayTotal || 0)}
                </strong>
              </span>
              <span className="text-slate-400 font-mono">
                {stats?.summary.purchases.periodCount || 0} inward
              </span>
            </div>
          </TiltCard>

          {/* KPI 3: Operating Expenses */}
          <TiltCard
            glowColor="amber"
            onClick={() => onNavigate && onNavigate('purchases', 'expenses')}
            className="p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                {filter === 'today' ? "Today's Expenses" : 'Operating Expenses'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
              <AnimatedNumber
                value={stats?.summary.expenses.periodTotal || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/70">
              <span className="text-slate-400">
                Today:{' '}
                <strong className="text-amber-400 font-mono">
                  {formatCurrency(stats?.summary.expenses.todayTotal || 0)}
                </strong>
              </span>
              <span className="text-slate-400 font-mono">
                {stats?.summary.expenses.periodCount || 0} entries
              </span>
            </div>
          </TiltCard>

          {/* KPI 4: Net Profit */}
          <TiltCard
            glowColor={(stats?.summary.profit.netProfit || 0) >= 0 ? 'violet' : 'rose'}
            onClick={() => onNavigate && onNavigate('reports')}
            className="p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Net Profit
              </span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  (stats?.summary.profit.netProfit || 0) >= 0
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                }`}
              >
                {(stats?.summary.profit.netProfit || 0) >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </div>
            </div>
            <div
              className={`mt-2.5 text-2xl font-extrabold tracking-tight ${
                (stats?.summary.profit.netProfit || 0) >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              <AnimatedNumber
                value={stats?.summary.profit.netProfit || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/70">
              <span className="text-slate-400">
                Margin:{' '}
                <strong className="text-indigo-300 font-mono">
                  {(stats?.summary.profit.netProfitMargin || 0).toFixed(1)}%
                </strong>
              </span>
              <span className="text-slate-500 text-[11px]">
                Sales − Costs
              </span>
            </div>
          </TiltCard>

          {/* KPI 5: Cash Balance */}
          <TiltCard glowColor="cyan" className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Cash In Hand
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
              <AnimatedNumber
                value={stats?.summary.liquidity.cashBalance || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 text-xs text-slate-400 pt-2.5 border-t border-slate-800/70">
              Store cash drawer balance · Live ledger
            </div>
          </TiltCard>

          {/* KPI 6: Bank Balance */}
          <TiltCard glowColor="indigo" className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Bank &amp; UPI Balance
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-white tracking-tight">
              <AnimatedNumber
                value={stats?.summary.liquidity.bankBalance || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 text-xs text-slate-400 pt-2.5 border-t border-slate-800/70">
              Current accounts &amp; UPI settlements
            </div>
          </TiltCard>

          {/* KPI 7: Receivables */}
          <TiltCard
            glowColor="amber"
            onClick={() => onNavigate && onNavigate('parties', 'customers')}
            className="p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Receivables (To Collect)
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-amber-400 tracking-tight">
              <AnimatedNumber
                value={stats?.summary.liquidity.totalReceivables || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 text-xs text-slate-400 pt-2.5 border-t border-slate-800/70">
              Pending dues from customers
            </div>
          </TiltCard>

          {/* KPI 8: Payables */}
          <TiltCard
            glowColor="rose"
            onClick={() => onNavigate && onNavigate('parties', 'suppliers')}
            className="p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Payables (To Pay)
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl font-extrabold text-rose-400 tracking-tight">
              <AnimatedNumber
                value={stats?.summary.liquidity.totalPayables || 0}
                isCurrency
                currency={activeBusiness?.currency || 'INR'}
              />
            </div>
            <div className="mt-2.5 text-xs text-slate-400 pt-2.5 border-t border-slate-800/70">
              Pending dues to suppliers &amp; vendors
            </div>
          </TiltCard>
        </div>
      )}

      {/* 3. 3D PROFIT ARCHITECTURE & MONTH-ON-MONTH COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProfitVisualization3D
            revenue={stats?.summary.sales.periodTotal || 0}
            purchases={stats?.summary.purchases.periodTotal || 0}
            expenses={stats?.summary.expenses.periodTotal || 0}
            netProfit={stats?.summary.profit.netProfit || 0}
            marginPct={stats?.summary.profit.netProfitMargin || 0}
            formatCurrency={formatCurrency}
          />
        </div>

        <GlassCard className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Month-on-Month Velocity
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparing current month-to-date against full preceding month
              </p>
            </div>

            {stats?.monthlyComparison && (
              <div
                className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                  stats.monthlyComparison.salesDeltaPct >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {stats.monthlyComparison.salesDeltaPct >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {stats.monthlyComparison.salesDeltaPct >= 0 ? '+' : ''}
                  {stats.monthlyComparison.salesDeltaPct.toFixed(1)}% vs Last Month
                </span>
              </div>
            )}
          </div>

          {stats?.monthlyComparison ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-4 pt-4 border-t border-slate-800/80">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-medium text-slate-400">
                  This Month Sales
                </div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {formatCurrency(stats.monthlyComparison.currentMonth.sales)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Prev: {formatCurrency(stats.monthlyComparison.lastMonth.sales)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-medium text-slate-400">
                  This Month Purchases
                </div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {formatCurrency(stats.monthlyComparison.currentMonth.purchases)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Prev: {formatCurrency(stats.monthlyComparison.lastMonth.purchases)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-medium text-slate-400">
                  This Month Expenses
                </div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {formatCurrency(stats.monthlyComparison.currentMonth.expenses)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Prev: {formatCurrency(stats.monthlyComparison.lastMonth.expenses)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-medium text-slate-400">
                  This Month Profit
                </div>
                <div
                  className={`text-base font-bold font-mono mt-1 ${
                    stats.monthlyComparison.currentMonth.profit >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(stats.monthlyComparison.currentMonth.profit)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Prev: {formatCurrency(stats.monthlyComparison.lastMonth.profit)}
                </div>
              </div>
            </div>
          ) : (
            <ChartSkeleton height="h-28" />
          )}
        </GlassCard>
      </div>

      {/* 4. CHARTS ROW: SALES VS PURCHASES TIMELINE & EXPENSE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Purchases Graph */}
        <GlassCard className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Sales vs. Purchases Cashflow Curve
              </h2>
              <p className="text-xs text-slate-400">
                Real-time daily commercial velocity
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />{' '}
                Sales
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />{' '}
                Purchases
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading && !stats ? (
              <ChartSkeleton height="h-64" />
            ) : stats?.timeline && stats.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.timeline}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) =>
                      `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(99, 102, 241, 0.35)',
                      borderRadius: '14px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Sales"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="purchases"
                    name="Purchases"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#purchaseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No billing transactions recorded in this timeframe.
              </div>
            )}
          </div>
        </GlassCard>

        {/* Expense Category Breakdown */}
        <GlassCard className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              Expense Distribution
            </h2>
            <button
              onClick={() => setExpenseModalOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              + Log Expense
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {stats?.expenseBreakdown && stats.expenseBreakdown.length > 0 ? (
              <div className="space-y-3.5">
                {stats.expenseBreakdown.slice(0, 5).map((exp, idx) => {
                  const totalExp = stats.summary.expenses.periodTotal || 1;
                  const pct = Math.round((exp.amount / totalExp) * 100);
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300 font-medium truncate max-w-[150px]">
                          {exp.category}
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatCurrency(exp.amount)}{' '}
                          <span className="text-slate-500 text-[10px]">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No expenses logged for this timeframe.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Total Overheads:</span>
            <span className="font-mono font-bold text-amber-400">
              {formatCurrency(stats?.summary.expenses.periodTotal || 0)}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* 5. OPERATIONAL LEDGERS: LOW-STOCK ALERTS & TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert Panel */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Low-Stock Alerts</h2>
                <p className="text-[11px] text-slate-400">
                  Items below minimum reorder threshold
                </p>
              </div>
            </div>
            <button
              onClick={() => setProductModalOpen(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              + Add Item
            </button>
          </div>

          <div className="divide-y divide-slate-800/70">
            {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              stats.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-900/40 px-2 rounded-xl transition"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="font-semibold text-xs text-slate-200 truncate flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.sku && (
                        <span className="font-mono text-[10px] text-slate-400">
                          · {p.sku}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      <span>{p.category}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>
                        Rate:{' '}
                        <span className="text-slate-200 font-mono">
                          {formatCurrency(p.selling_price)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-rose-400">
                      {p.current_stock} {p.unit}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        / min {p.min_stock_alert}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-amber-400 mt-0.5">
                      Shortfall: -{p.deficit} {p.unit}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
                <span>All inventory items are above minimum alert levels.</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Top-Selling Products */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  Top-Selling Products
                </h2>
                <p className="text-[11px] text-slate-400">
                  Ranked by sales revenue in active window
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-800/70">
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              stats.topProducts.map((tp, idx) => (
                <div
                  key={idx}
                  className="py-3 flex items-center justify-between hover:bg-slate-900/40 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-200 truncate">
                        {tp.item_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Units Dispatched:{' '}
                        <strong className="text-white font-mono">
                          {tp.total_qty}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono font-bold text-xs text-emerald-400">
                    {formatCurrency(tp.total_revenue)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No product sales recorded in this timeframe.
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* 6. RECENT INVOICES & PAYMENTS LEDGER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices Table */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">
                Recent Sales Invoices
              </h2>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('invoices')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                View All →
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-2.5 font-semibold">Invoice #</th>
                  <th className="pb-2.5 font-semibold">Customer</th>
                  <th className="pb-2.5 font-semibold">Date</th>
                  <th className="pb-2.5 font-semibold text-right">Amount</th>
                  <th className="pb-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
                  stats.recentInvoices.map((inv) => {
                    const isPaid = inv.payment_status === 'PAID';
                    const isPartial = inv.payment_status === 'PARTIAL';
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-900/50 transition"
                      >
                        <td className="py-2.5 font-mono font-bold text-indigo-300">
                          {inv.invoice_number}
                        </td>
                        <td className="py-2.5 text-slate-200 truncate max-w-[130px]">
                          {inv.customer_name}
                        </td>
                        <td className="py-2.5 text-slate-400 text-[11px] font-mono">
                          {inv.invoice_date}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold text-white">
                          {formatCurrency(inv.grand_total)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-[11px] font-semibold">
                          <span
                            className={
                              isPaid
                                ? 'text-emerald-400'
                                : isPartial
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }
                          >
                            {inv.payment_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-500 text-xs"
                    >
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Recent Payments Ledger Table */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">
                Cash &amp; Bank Ledger
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Recent Settlements
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-2.5 font-semibold">Account</th>
                  <th className="pb-2.5 font-semibold">Party / Note</th>
                  <th className="pb-2.5 font-semibold">Mode</th>
                  <th className="pb-2.5 font-semibold">Date</th>
                  <th className="pb-2.5 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats?.recentPayments && stats.recentPayments.length > 0 ? (
                  stats.recentPayments.map((p) => {
                    const isInflow = p.direction === 'IN';
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-900/50 transition"
                      >
                        <td className="py-2.5 font-mono text-[11px] font-semibold">
                          <span
                            className={
                              isInflow ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {isInflow ? 'IN · ' : 'OUT · '}
                            {p.account_type}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-200 truncate max-w-[140px]">
                          {p.entity_name}
                        </td>
                        <td className="py-2.5 text-slate-400 text-[11px] font-mono">
                          {p.payment_mode}
                        </td>
                        <td className="py-2.5 text-slate-400 text-[11px] font-mono">
                          {p.payment_date}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono font-bold ${
                            isInflow ? 'text-emerald-400' : 'text-slate-200'
                          }`}
                        >
                          {isInflow ? '+' : '-'}
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-500 text-xs"
                    >
                      No payment ledger entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* QUICK MODALS */}
      <QuickExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        onSuccess={() => fetchDashboardStats(true)}
      />

      <QuickProductModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSuccess={() => fetchDashboardStats(true)}
      />
    </div>
  );
};
