import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Package,
  Calendar,
  CreditCard,
  Building2,
  FileText,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Eye,
  Trash2,
  Receipt,
  Download,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PurchaseBill, PurchaseKPIs } from '../../types/purchases.types';
import { CreatePurchaseModal } from './CreatePurchaseModal';
import { PurchaseDetailsModal } from './PurchaseDetailsModal';
import { ExpensesView } from './ExpensesView';
import { SubViewHint } from '../layout/Navbar';
import {
  TiltCard,
  GlassCard,
  AnimatedNumber,
  TableSkeleton,
  EmptyState3D,
} from '../ui/3d-system';

interface PurchasesDashboardProps {
  initialHint?: SubViewHint;
}

export const PurchasesDashboard: React.FC<PurchasesDashboardProps> = ({
  initialHint,
}) => {
  const { activeBusiness } = useAuth();

  const [activeTab, setActiveTab] = useState<'bills' | 'expenses'>(
    initialHint === 'expenses' ? 'expenses' : 'bills'
  );

  useEffect(() => {
    if (initialHint === 'expenses') setActiveTab('expenses');
    else if (initialHint === 'purchases') setActiveTab('bills');
  }, [initialHint]);
  const [purchases, setPurchases] = useState<PurchaseBill[]>([]);
  const [kpis, setKpis] = useState<PurchaseKPIs>({
    total_bills: 0,
    total_purchases_amount: 0,
    total_paid: 0,
    total_payables_due: 0,
    total_itc_available: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseBill | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchPurchases = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (paymentStatus !== 'ALL') params.append('paymentStatus', paymentStatus);

      const data = await api.get(`/purchases?${params.toString()}`);
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch purchase bills');
      }

      setPurchases(data.data?.purchases || []);
      setKpis(
        data.data?.kpis || {
          total_bills: 0,
          total_purchases_amount: 0,
          total_paid: 0,
          total_payables_due: 0,
          total_itc_available: 0,
        }
      );
    } catch (err: any) {
      setError(err.message || 'Error loading purchase bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bills') {
      fetchPurchases();
    }
  }, [activeBusiness, activeTab, search, paymentStatus]);

  const handleOpenDetails = async (purchase: PurchaseBill) => {
    try {
      const data = await api.get(`/purchases/${purchase.id}`);
      if (data.success) {
        setSelectedPurchase(data.data);
        setShowDetailsModal(true);
      }
    } catch (err) {
      setSelectedPurchase(purchase);
      setShowDetailsModal(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-emerald-400" />
            Purchases &amp; Vendor Bills
          </h1>
          <p className="text-xs text-slate-400">
            Inward supply register • Auto stock replenishment • Input Tax Credit (ITC) • Supplier payables
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveTab('bills')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
              activeTab === 'bills' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Inward Bills ({kpis.total_bills})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
              activeTab === 'expenses' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Operating Expenses
          </button>
        </div>
      </div>

      {activeTab === 'expenses' ? (
        <ExpensesView />
      ) : (
        <>
          {/* 3D KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TiltCard glowColor="emerald" className="p-5">
              <span className="text-xs font-semibold text-slate-400">Total Purchases</span>
              <div className="text-2xl font-extrabold text-white mt-1.5 font-mono">
                <AnimatedNumber value={kpis.total_purchases_amount} isCurrency />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block font-mono">
                {kpis.total_bills} inward bills recorded
              </span>
            </TiltCard>

            <TiltCard glowColor="cyan" className="p-5">
              <span className="text-xs font-semibold text-slate-400">Total Amount Paid</span>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1.5 font-mono">
                <AnimatedNumber value={kpis.total_paid} isCurrency />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Settled to vendors</span>
            </TiltCard>

            <TiltCard glowColor="amber" className="p-5">
              <span className="text-xs font-semibold text-slate-400">Payables Outstanding</span>
              <div className="text-2xl font-extrabold text-amber-400 mt-1.5 font-mono">
                <AnimatedNumber value={kpis.total_payables_due} isCurrency />
              </div>
              <span className="text-[11px] text-amber-400/80 mt-1 block">
                Due to suppliers (Khata liability)
              </span>
            </TiltCard>

            <TiltCard glowColor="indigo" className="p-5">
              <span className="text-xs font-semibold text-slate-400">Input Tax Credit (ITC)</span>
              <div className="text-2xl font-extrabold text-indigo-400 mt-1.5 font-mono">
                <AnimatedNumber value={kpis.total_itc_available} isCurrency />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Claimable in GSTR-3B Table 4
              </span>
            </TiltCard>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 text-xs">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Bill No, Supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Payment Status</option>
                  <option value="UNPAID">Unpaid / Due</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="PAID">Fully Paid</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-600/20 text-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Record Inward Bill
            </button>
          </div>

          {/* Purchases Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Bill Date</th>
                    <th className="p-3.5">Bill Number</th>
                    <th className="p-3.5">Supplier / Vendor</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Taxable</th>
                    <th className="p-3.5 text-right">GST (ITC)</th>
                    <th className="p-3.5 text-right">Grand Total (₹)</th>
                    <th className="p-3.5 text-right">Balance Due (₹)</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                        Loading purchase bills...
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                        No purchase bills recorded. Click "Record Inward Bill" to add your first supplier invoice.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 text-slate-300 font-sans">{p.bill_date}</td>
                        <td className="p-3.5 font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          {p.bill_number}
                        </td>
                        <td className="p-3.5 text-slate-200 font-sans font-semibold">
                          {p.supplier_name}
                          {p.supplier_gstin && (
                            <span className="block text-[10px] text-slate-500 font-mono font-normal">
                              GSTIN: {p.supplier_gstin}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              p.payment_status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : p.payment_status === 'PARTIAL'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right text-slate-300">
                          ₹{(p.subtotal - (p.discount_total || 0)).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right text-indigo-400">
                          ₹{(p.tax_total || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-bold text-white text-sm">
                          ₹{p.grand_total.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-bold">
                          {p.balance_due > 0 ? (
                            <span className="text-amber-400">₹{p.balance_due.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-500">₹0.00</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-sans">
                          <button
                            onClick={() => handleOpenDetails(p)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 mx-auto"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <CreatePurchaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => fetchPurchases()}
      />

      <PurchaseDetailsModal
        isOpen={showDetailsModal}
        purchase={selectedPurchase}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedPurchase(null);
        }}
        onRefresh={() => fetchPurchases()}
      />
    </div>
  );
};
