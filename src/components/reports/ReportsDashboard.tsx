import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileCheck,
  TrendingUp,
  Calendar,
  Layers,
  BookOpen,
  PieChart
} from 'lucide-react';
import { Gstr1View } from './Gstr1View';
import { Gstr3bView } from './Gstr3bView';
import { ProfitLossView } from './ProfitLossView';
import { DaybookView } from './DaybookView';
import { GlassCard } from '../ui/3d-system';

export const ReportsDashboard: React.FC = () => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeReportTab, setActiveReportTab] = useState<'gstr1' | 'gstr3b' | 'pnl' | 'daybook'>('gstr1');

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 border border-white/15">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Analytics Command Center &amp; GST Returns
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Government GSTR-1 &amp; GSTR-3B filings, P&amp;L Financial Statements, and Daily Journals
            </p>
          </div>
        </div>

        {/* Month Selector for GST returns */}
        {(activeReportTab === 'gstr1' || activeReportTab === 'gstr3b') && (
          <div className="flex items-center gap-2 bg-slate-950/90 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400 font-semibold">Tax Period:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </GlassCard>

      {/* Report Module Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveReportTab('gstr1')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition whitespace-nowrap ${
            activeReportTab === 'gstr1'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          GSTR-1 Outward Supplies
        </button>

        <button
          onClick={() => setActiveReportTab('gstr3b')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition whitespace-nowrap ${
            activeReportTab === 'gstr3b'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          GSTR-3B Monthly Return
        </button>

        <button
          onClick={() => setActiveReportTab('pnl')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition whitespace-nowrap ${
            activeReportTab === 'pnl'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Profit &amp; Loss (P&amp;L)
        </button>

        <button
          onClick={() => setActiveReportTab('daybook')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition whitespace-nowrap ${
            activeReportTab === 'daybook'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Daily Cashbook / Daybook
        </button>
      </div>

      {/* Render Selected View */}
      {activeReportTab === 'gstr1' && <Gstr1View selectedMonth={selectedMonth} />}
      {activeReportTab === 'gstr3b' && <Gstr3bView selectedMonth={selectedMonth} />}
      {activeReportTab === 'pnl' && <ProfitLossView />}
      {activeReportTab === 'daybook' && <DaybookView />}
    </div>
  );
};
