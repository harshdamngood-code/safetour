import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { InvoiceRecord, InvoiceKPIs, InvoiceType } from '../../types/invoices.types';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { PosBillingModal } from './PosBillingModal';
import { SubViewHint } from '../layout/Navbar';
import {
  TiltCard,
  GlassCard,
  AnimatedNumber,
  TableSkeleton,
  EmptyState3D,
  useToast,
} from '../ui/3d-system';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CreditCard,
  Printer,
  Share2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  Receipt,
  Download,
  DollarSign,
  FileCheck,
  RefreshCw,
  Eye,
  Calendar,
} from 'lucide-react';

interface InvoicesViewProps {
  initialHint?: SubViewHint;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ initialHint }) => {
  const { activeBusiness } = useAuth();
  const { showToast } = useToast();
  
  // Data State
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [kpis, setKpis] = useState<InvoiceKPIs>({
    total_invoices_count: 0,
    total_sales_volume: 0,
    total_collected: 0,
    total_receivable_due: 0,
    total_gst_billed: 0,
    paid_invoices_count: 0,
    partial_invoices_count: 0,
    unpaid_invoices_count: 0,
    quotations_count: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<InvoiceType>('TAX_INVOICE');
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<InvoiceRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialHint === 'sales') {
      setStatusFilter('ALL');
    }
  }, [initialHint]);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('invoice_type', typeFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const data = await api.get(`/invoices?${params.toString()}`);
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch invoices');
      }

      setInvoices(data.data?.invoices || []);
      setKpis(data.data?.kpis || {});
    } catch (err: any) {
      console.error('Fetch invoices error:', err);
      setError(err.message || 'Error loading invoices');
    } finally {
      setLoading(false);
    }
  }, [activeBusiness, searchQuery, statusFilter, typeFilter, startDate, endDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // View Invoice Detail
  const handleOpenDetail = async (invoiceId: string) => {
    try {
      const data = await api.get(`/invoices/${invoiceId}`);
      if (data.success) {
        setSelectedInvoice(data.data);
        setDetailModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load invoice details', err);
    }
  };

  // Convert Quotation to Invoice
  const handleConvertQuotation = async (quotationId: string) => {
    try {
      const data = await api.post(`/invoices/${quotationId}/convert-quote`);
      if (data.success) {
        showToast('success', 'Quotation Converted to GST Invoice', 'Inventory stock and party ledger updated.');
        fetchInvoices();
        if (detailModalOpen) {
          setSelectedInvoice(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to convert quotation', err);
    }
  };

  // Delete / Void Invoice
  const handleDeleteInvoice = async (invoice: InvoiceRecord) => {
    try {
      const data = await api.delete(`/invoices/${invoice.id}`);
      if (data.success) {
        showToast('info', `Invoice ${invoice.invoice_number} Voided`, 'Stock and customer balance restored.');
        fetchInvoices();
      }
    } catch (err) {
      console.error('Failed to delete invoice', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Main Actions */}
      <GlassCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              GST Invoicing &amp; Sales Ledger
            </h1>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-xs font-mono font-semibold text-indigo-400">
              CGST / SGST / IGST Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Issue GST-compliant Tax Invoices, Quotations &amp; POS Counter Bills with automatic stock deduction and party balance sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* POS Quick Button */}
          <button
            onClick={() => setPosModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/25 border border-amber-400/30 flex items-center gap-1.5 transition active:scale-95"
          >
            <Zap className="w-4 h-4" />
            POS Counter
          </button>

          {/* Quotation Button */}
          <button
            onClick={() => {
              setCreateInitialType('QUOTATION');
              setCreateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700/80"
          >
            <FileCheck className="w-4 h-4 text-blue-400" />
            + Quotation
          </button>

          {/* New Tax Invoice Button */}
          <button
            onClick={() => {
              setCreateInitialType('TAX_INVOICE');
              setCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 border border-indigo-400/30 flex items-center gap-2 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + New Tax Invoice
          </button>
        </div>
      </GlassCard>

      {/* 3D Floating KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Billed Revenue */}
        <TiltCard glowColor="indigo" className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Total Billed Revenue</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            <AnimatedNumber value={kpis.total_sales_volume || 0} isCurrency />
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Across {kpis.total_invoices_count || 0} invoices issued
          </div>
        </TiltCard>

        {/* Payments Collected */}
        <TiltCard glowColor="emerald" className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Collected Inflows</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">
            <AnimatedNumber value={kpis.total_collected || 0} isCurrency />
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {kpis.paid_invoices_count || 0} settled bills
          </div>
        </TiltCard>

        {/* Pending Receivables */}
        <TiltCard glowColor="rose" className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Outstanding Receivables</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400">
            <AnimatedNumber value={kpis.total_receivable_due || 0} isCurrency />
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {(kpis.unpaid_invoices_count || 0) + (kpis.partial_invoices_count || 0)} pending / partial bills
          </div>
        </TiltCard>

        {/* GST Tax Output Billed */}
        <TiltCard glowColor="cyan" className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">GST Output Liability</span>
            <Receipt className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-cyan-400">
            <AnimatedNumber value={kpis.total_gst_billed || 0} isCurrency />
          </div>
          <div className="text-[11px] text-slate-400">
            CGST, SGST &amp; IGST Output
          </div>
        </TiltCard>
      </div>

      {/* Filter Toolbar & Search Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Status Filter Controls */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-x-auto text-xs">
            {[
              { key: 'ALL', label: 'All Invoices' },
              { key: 'PAID', label: 'Paid' },
              { key: 'PARTIAL', label: 'Partial' },
              { key: 'UNPAID', label: 'Unpaid' },
              { key: 'OVERDUE', label: 'Overdue' },
              { key: 'QUOTATION', label: 'Quotations' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  statusFilter === st.key
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchInvoices}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 transition"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        {/* Search Bar & Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by invoice #, customer name, mobile, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <input
              type="date"
              placeholder="From Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <input
              type="date"
              placeholder="To Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </GlassCard>

      {/* Invoices List Table */}
      <GlassCard className="overflow-hidden">
        {loading && invoices.length === 0 ? (
          <TableSkeleton rows={6} cols={8} />
        ) : invoices.length === 0 ? (
          <EmptyState3D
            title="No Invoices Matching Filters"
            description="Create a GST-compliant Tax Invoice, Bill of Supply, or Quotation to begin tracking sales revenue and inventory movement."
            actionLabel="Create First Tax Invoice"
            onAction={() => {
              setCreateInitialType('TAX_INVOICE');
              setCreateModalOpen(true);
            }}
            icon="invoice"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="p-3.5">Invoice # &amp; Type</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer Details</th>
                  <th className="p-3.5 text-right">Taxable</th>
                  <th className="p-3.5 text-right">GST Total</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-right">Paid</th>
                  <th className="p-3.5 text-right">Balance Due</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.map((inv) => {
                  const isPaid = inv.payment_status === 'PAID';
                  const isPartial = inv.payment_status === 'PARTIAL';
                  const isQuotation = inv.invoice_type === 'QUOTATION';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-900/50 transition group">
                      {/* Number & Type */}
                      <td className="p-3.5">
                        <div
                          className="font-mono font-bold text-indigo-300 group-hover:text-indigo-200 transition cursor-pointer"
                          onClick={() => handleOpenDetail(inv.id)}
                        >
                          {inv.invoice_number}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {inv.invoice_type === 'QUOTATION'
                            ? 'Quotation'
                            : inv.invoice_type === 'BILL_OF_SUPPLY'
                            ? 'Bill of Supply'
                            : 'GST Tax Invoice'}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-slate-300 font-mono">
                        {inv.invoice_date}
                        {inv.due_date && (
                          <div className="text-[10px] text-slate-500">Due: {inv.due_date}</div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{inv.customer_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {inv.customer_phone ||
                            (inv.customer_gstin ? `GST: ${inv.customer_gstin}` : 'Walk-in')}
                        </div>
                      </td>

                      {/* Taxable */}
                      <td className="p-3.5 text-right font-mono text-slate-300">
                        ₹{inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* GST */}
                      <td className="p-3.5 text-right font-mono text-slate-400">
                        ₹{inv.tax_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Grand Total */}
                      <td className="p-3.5 text-right font-mono font-bold text-white">
                        ₹{inv.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Paid */}
                      <td className="p-3.5 text-right font-mono text-emerald-400">
                        ₹{inv.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Balance Due */}
                      <td className="p-3.5 text-right font-mono font-bold text-rose-400">
                        {isQuotation
                          ? '—'
                          : `₹${inv.balance_due.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}`}
                      </td>

                      {/* Clean Unboxed Status Text */}
                      <td className="p-3.5 text-center font-mono text-[11px] font-bold">
                        <span
                          className={
                            isPaid
                              ? 'text-emerald-400'
                              : isPartial
                              ? 'text-amber-400'
                              : isQuotation
                              ? 'text-blue-400'
                              : 'text-rose-400'
                          }
                        >
                          {inv.payment_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View / Print */}
                          <button
                            onClick={() => handleOpenDetail(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            title="View 3D Invoice & Print"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Collect Payment */}
                          {!isQuotation && inv.balance_due > 0 && (
                            <button
                              onClick={() => {
                                setPaymentTargetInvoice(inv);
                                setPaymentModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold transition"
                              title="Collect Payment"
                            >
                              Collect
                            </button>
                          )}

                          {/* Convert Quotation */}
                          {isQuotation && (
                            <button
                              onClick={() => handleConvertQuotation(inv.id)}
                              className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-semibold transition"
                              title="Convert to Tax Invoice"
                            >
                              Convert
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteInvoice(inv)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                            title="Void / Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Create Invoice / Quotation Modal */}
      <CreateInvoiceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialType={createInitialType}
        onInvoiceCreated={(newInv) => {
          fetchInvoices();
          setSelectedInvoice(newInv);
          setDetailModalOpen(true);
        }}
      />

      {/* POS Billing Modal */}
      <PosBillingModal
        isOpen={posModalOpen}
        onClose={() => setPosModalOpen(false)}
        onInvoiceCreated={(newInv) => {
          fetchInvoices();
          setSelectedInvoice(newInv);
          setDetailModalOpen(true);
        }}
      />

      {/* Invoice Detail / Print / WhatsApp View Modal */}
      <InvoiceDetailModal
        isOpen={detailModalOpen}
        invoice={selectedInvoice}
        onClose={() => setDetailModalOpen(false)}
        onOpenRecordPayment={(inv) => {
          setPaymentTargetInvoice(inv);
          setPaymentModalOpen(true);
        }}
        onConvertQuotation={handleConvertQuotation}
        onInvoiceUpdated={fetchInvoices}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={paymentModalOpen}
        invoice={paymentTargetInvoice}
        onClose={() => setPaymentModalOpen(false)}
        onPaymentRecorded={() => {
          fetchInvoices();
          if (detailModalOpen && selectedInvoice && paymentTargetInvoice && selectedInvoice.id === paymentTargetInvoice.id) {
            handleOpenDetail(selectedInvoice.id);
          }
        }}
      />
    </div>
  );
};
