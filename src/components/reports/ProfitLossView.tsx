import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Calendar,
  AlertCircle,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ProfitLossResponse } from '../../types/reports.types';

export const ProfitLossView: React.FC = () => {
  const { activeBusiness } = useAuth();

  const [data, setData] = useState<ProfitLossResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(
    `${new Date().getFullYear()}-04-01` // Indian FY start
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchPnl = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const json = await api.get<ProfitLossResponse>(`/reports/profit-loss?${params.toString()}`);
      if (!json.success) {
        throw new Error(json.message || 'Failed to generate P&L');
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading P&L');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnl();
  }, [activeBusiness, startDate, endDate]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Compiling Profit &amp; Loss Statement and Financial Health...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>{error || 'Failed to load report'}</span>
      </div>
    );
  }

  const isProfit = data.net_profit >= 0;

  return (
    <div className="space-y-6 text-xs">
      {/* Date Range Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Financial Statement: Profit &amp; Loss (P&amp;L)
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Indian Financial Accounting Standard • Revenue vs Cost of Goods Sold vs Operating Overheads
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
          />
        </div>
      </div>

      {/* Top Level Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Net Sales Revenue</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            ₹{data.income.net_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500">Gross: ₹{data.income.gross_sales.toFixed(2)}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cost of Goods Sold (COGS)</span>
          <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">
            ₹{data.cost_of_goods_sold.cogs_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500">Inward inventory purchase costs</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Gross Profit Margin</span>
          <p className="text-2xl font-bold text-indigo-400 mt-1 font-mono">
            ₹{data.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-indigo-400 font-semibold">{data.gross_margin_percent}% Gross Margin</span>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isProfit
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : 'bg-rose-950/20 border-rose-500/30'
          }`}
        >
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Net Operating Profit</span>
          <p className={`text-2xl font-bold mt-1 font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            ₹{data.net_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span
            className={`text-[10px] font-bold flex items-center gap-1 ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {data.net_profit_margin_percent}% Net Profit Margin
          </span>
        </div>
      </div>

      {/* Detailed P&L Structure Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Revenue & Cost of Goods Sold */}
        <div className="space-y-4">
          {/* Revenue */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">1. Operating Revenue / Income</span>
              <span className="font-mono text-emerald-400 font-bold">₹{data.income.net_sales.toFixed(2)}</span>
            </div>
            <div className="p-4 space-y-2 font-mono">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans">Gross Sales Invoices Issued</span>
                <span>₹{data.income.gross_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span className="font-sans">Less: Sales Discounts Allowed</span>
                <span>-₹{data.income.discounts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-800">
                <span className="font-sans">Net Sales Revenue</span>
                <span>₹{data.income.net_sales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* COGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">2. Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-rose-400 font-bold">₹{data.cost_of_goods_sold.cogs_total.toFixed(2)}</span>
            </div>
            <div className="p-4 space-y-2 font-mono">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans">Inward Inventory Purchases (Taxable)</span>
                <span>₹{data.cost_of_goods_sold.purchases.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-xs">
                <span className="font-sans">Current Closing Stock Valuation</span>
                <span>₹{data.cost_of_goods_sold.closing_inventory_valuation.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-800">
                <span className="font-sans">Gross Profit (Revenue - COGS)</span>
                <span className="text-indigo-400">₹{data.gross_profit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Operating Overheads & Net Profit Calculation */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">3. Operating Expenses &amp; Overheads</span>
              <span className="font-mono text-amber-400 font-bold">
                ₹{data.operating_expenses.total_expenses.toFixed(2)}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {data.operating_expenses.categories.length === 0 ? (
                <p className="text-slate-500 italic text-center py-4">No operating expenses logged in this period.</p>
              ) : (
                data.operating_expenses.categories.map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-sans text-slate-300">{cat.category}</span>
                      <span className="text-slate-100 font-bold">₹{cat.amount.toFixed(2)} ({cat.percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, cat.percent)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}

              {/* Net Profit Bottom Line Banner */}
              <div className="p-4 mt-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between font-mono">
                <div>
                  <span className="font-sans font-bold text-slate-200 block text-xs">
                    Net Operating Profit (EBIT)
                  </span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Gross Profit - Total Operating Expenses
                  </span>
                </div>
                <span className={`text-xl font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{data.net_profit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
