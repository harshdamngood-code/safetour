import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  Package,
  CreditCard,
  Building2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { DaybookResponse } from '../../types/reports.types';

export const DaybookView: React.FC = () => {
  const { activeBusiness } = useAuth();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<DaybookResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDaybook = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<DaybookResponse>(`/reports/daybook?date=${date}`);
      if (!json.success) {
        throw new Error(json.message || 'Failed to fetch Daybook');
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading Daybook');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDaybook();
  }, [activeBusiness, date]);

  return (
    <div className="space-y-6 text-xs">
      {/* Date Bar & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Daily Cash &amp; Bank Daybook
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Real-time daily journal • Sales, collections, purchases, vendor payouts &amp; operational expenses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-semibold">Select Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading Daybook entries...
        </div>
      ) : error || !data ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error || 'Failed to load daybook'}</span>
        </div>
      ) : (
        <>
          {/* Day KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Total Sales Issued</span>
              <p className="text-xl font-bold text-white mt-1 font-mono">
                ₹{data.summary.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">{data.entries.invoices.length} invoices</span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Cash/Bank Inflow</span>
              <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                ₹{data.summary.cash_inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">Collected today</span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Cash/Bank Outflow</span>
              <p className="text-xl font-bold text-rose-400 mt-1 font-mono">
                ₹{data.summary.cash_outflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">Paid out today</span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Net Daily Cashflow</span>
              <p
                className={`text-xl font-bold mt-1 font-mono ${
                  data.summary.net_cashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ₹{data.summary.net_cashflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">Inflow minus Outflow</span>
            </div>
          </div>

          {/* Chronological Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INFLOWS / COLLECTIONS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4" />
                  Money In (Customer Collections &amp; Sales)
                </span>
                <span className="font-mono text-emerald-400 font-bold">₹{data.summary.cash_inflow.toFixed(2)}</span>
              </div>
              <div className="p-3 space-y-2">
                {data.entries.payments.filter((p) => p.direction === 'IN').length === 0 ? (
                  <p className="text-slate-500 text-center py-6 italic">No customer collections logged on this day.</p>
                ) : (
                  data.entries.payments
                    .filter((p) => p.direction === 'IN')
                    .map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between font-mono"
                      >
                        <div>
                          <p className="font-sans font-bold text-slate-200">{p.party_name}</p>
                          <p className="text-[10px] text-slate-400 font-sans">
                            {p.payment_mode} • {p.notes || 'Collection'}
                          </p>
                        </div>
                        <span className="text-emerald-400 font-bold text-sm">₹{p.amount.toFixed(2)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* OUTFLOWS / PAYOUTS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4" />
                  Money Out (Vendor Payments &amp; Expenses)
                </span>
                <span className="font-mono text-rose-400 font-bold">₹{data.summary.cash_outflow.toFixed(2)}</span>
              </div>
              <div className="p-3 space-y-2">
                {data.entries.payments.filter((p) => p.direction === 'OUT').length === 0 ? (
                  <p className="text-slate-500 text-center py-6 italic">No outward payments made on this day.</p>
                ) : (
                  data.entries.payments
                    .filter((p) => p.direction === 'OUT')
                    .map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between font-mono"
                      >
                        <div>
                          <p className="font-sans font-bold text-slate-200">{p.party_name}</p>
                          <p className="text-[10px] text-slate-400 font-sans">
                            {p.payment_mode} • {p.notes || 'Payout'}
                          </p>
                        </div>
                        <span className="text-rose-400 font-bold text-sm">-₹{p.amount.toFixed(2)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
