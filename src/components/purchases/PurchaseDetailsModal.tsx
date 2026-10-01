import React, { useState } from 'react';
import {
  X,
  Printer,
  CreditCard,
  Building2,
  Calendar,
  Package,
  Trash2,
  CheckCircle2,
  Clock,
  IndianRupee,
  FileText,
  AlertCircle
} from 'lucide-react';
import { PurchaseBill } from '../../types/purchases.types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface PurchaseDetailsModalProps {
  purchase: PurchaseBill | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
  purchase,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const { activeBusiness } = useAuth();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('BANK_TRANSFER');
  const [refNo, setRefNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !purchase || !activeBusiness) return null;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid payment amount');
      return;
    }
    if (amount > purchase.balance_due + 0.01) {
      setError(`Amount cannot exceed balance due of ₹${purchase.balance_due.toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.post(`/purchases/${purchase.id}/payments`, {
        amount,
        payment_mode: payMode,
        reference_number: refNo,
        payment_date: new Date().toISOString().split('T')[0],
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to record payment');
      }

      setShowPaymentForm(false);
      setPayAmount('');
      setRefNo('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidPurchase = async () => {
    try {
      const data = await api.delete(`/purchases/${purchase.id}`);
      if (!data.success) {
        throw new Error(data.message || 'Failed to void purchase bill');
      }

      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error voiding purchase');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Purchase Bill: {purchase.bill_number}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    purchase.payment_status === 'PAID'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : purchase.payment_status === 'PARTIAL'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {purchase.payment_status}
                </span>
              </div>
              <p className="text-xs text-slate-400">Recorded on {new Date(purchase.created_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Voucher
            </button>

            {purchase.balance_due > 0 && !showPaymentForm && (
              <button
                onClick={() => {
                  setShowPaymentForm(true);
                  setPayAmount(purchase.balance_due.toString());
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Record Payment
              </button>
            )}

            <button
              onClick={handleVoidPurchase}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Void Bill
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Payment Form Drawer */}
          {showPaymentForm && (
            <form
              onSubmit={handleRecordPayment}
              className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Record Payment to {purchase.supplier_name}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Amount to Pay (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    max={purchase.balance_due}
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ref / UTR Number</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder="e.g. UTR-98765432"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition"
                >
                  {submitting ? 'Recording...' : 'Confirm Outward Payment'}
                </button>
              </div>
            </form>
          )}

          {/* Supplier & Bill Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                Vendor / Supplier Details
              </span>
              <h3 className="text-base font-bold text-white">{purchase.supplier_name}</h3>
              {purchase.supplier_company && (
                <p className="text-slate-300 font-medium">{purchase.supplier_company}</p>
              )}
              {purchase.supplier_gstin && (
                <p className="text-slate-400 font-mono mt-1">GSTIN: {purchase.supplier_gstin}</p>
              )}
              {purchase.supplier_state && (
                <p className="text-slate-400">State / Place of Supply: {purchase.supplier_state}</p>
              )}
            </div>

            <div className="space-y-1 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                Purchase Document Info
              </span>
              <p className="text-slate-300">
                Vendor Bill No: <span className="text-white font-mono font-bold">{purchase.bill_number}</span>
              </p>
              <p className="text-slate-400">Bill Date: {purchase.bill_date}</p>
              {purchase.due_date && <p className="text-slate-400">Due Date: {purchase.due_date}</p>}
              {purchase.notes && <p className="text-slate-400 italic mt-2">"{purchase.notes}"</p>}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200">Purchased Goods &amp; Services</h4>
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-2.5">Item Name</th>
                    <th className="p-2.5">HSN</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Cost</th>
                    <th className="p-2.5 text-center">GST Rate</th>
                    <th className="p-2.5 text-right">Taxable</th>
                    <th className="p-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {purchase.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-2.5 font-sans font-semibold text-slate-100">{item.item_name}</td>
                      <td className="p-2.5 text-slate-400">{item.hsn_code || '-'}</td>
                      <td className="p-2.5 text-center text-slate-200">
                        {item.quantity} {item.unit || 'PCS'}
                      </td>
                      <td className="p-2.5 text-right text-slate-300">₹{item.unit_cost.toFixed(2)}</td>
                      <td className="p-2.5 text-center text-slate-300">{item.tax_rate}%</td>
                      <td className="p-2.5 text-right text-slate-300">₹{item.taxable_amount.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">₹{item.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Payments Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment History */}
            <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Payment Ledger
              </h4>
              {purchase.payments && purchase.payments.length > 0 ? (
                <div className="space-y-2 font-mono">
                  {purchase.payments.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{p.payment_mode}</span>
                          <span className="text-[10px] text-slate-400 font-sans">{p.payment_date}</span>
                        </div>
                        {p.reference_number && (
                          <p className="text-[10px] text-slate-500">Ref: {p.reference_number}</p>
                        )}
                      </div>
                      <span className="font-bold text-emerald-400">₹{p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">No payments recorded yet against this bill.</p>
              )}
            </div>

            {/* Total Math */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Taxable Subtotal:</span>
                <span>₹{(purchase.subtotal - purchase.discount_total).toFixed(2)}</span>
              </div>
              {purchase.igst_total > 0 ? (
                <div className="flex justify-between text-amber-400 text-[11px]">
                  <span>Integrated Tax (IGST ITC):</span>
                  <span>+₹{purchase.igst_total.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-emerald-400 text-[11px]">
                    <span>Central GST (CGST ITC):</span>
                    <span>+₹{purchase.cgst_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 text-[11px]">
                    <span>State GST (SGST ITC):</span>
                    <span>+₹{purchase.sgst_total.toFixed(2)}</span>
                  </div>
                </>
              )}
              {purchase.round_off !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round-off:</span>
                  <span>₹{purchase.round_off.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-slate-700">
                <span>Grand Bill Value:</span>
                <span className="text-emerald-400">₹{purchase.grand_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-400 pt-1 border-t border-slate-800">
                <span>Total Paid:</span>
                <span>₹{purchase.paid_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-400 font-bold">
                <span>Outstanding Balance:</span>
                <span>₹{purchase.balance_due.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
