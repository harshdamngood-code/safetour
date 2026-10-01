import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { InvoiceRecord, PaymentMethod } from '../../types/invoices.types';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Smartphone,
  Banknote,
  Building,
} from 'lucide-react';

interface RecordPaymentModalProps {
  invoice: InvoiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: (updatedInvoice: InvoiceRecord) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onPaymentRecorded,
}) => {
  const { activeBusiness } = useAuth();
  if (!isOpen || !invoice) return null;

  const [amount, setAmount] = useState<number>(invoice.balance_due || 0);
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(`Payment for Invoice ${invoice.invoice_number}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayFull = () => {
    setAmount(invoice.balance_due);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const paymentAmount = Number(amount);
    if (paymentAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (paymentAmount > invoice.balance_due + 0.01) {
      setError(`Payment amount (₹${paymentAmount}) cannot exceed outstanding balance (₹${invoice.balance_due}).`);
      return;
    }

    setLoading(true);

    try {
      const data = await api.post(`/invoices/${invoice.id}/payments`, {
        amount: paymentAmount,
        payment_mode: paymentMode,
        reference_number: referenceNumber.trim() || undefined,
        payment_date: paymentDate,
        notes: notes.trim() || undefined,
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to record payment');
      }

      onPaymentRecorded(data.data);
      onClose();
    } catch (err: any) {
      console.error('Record payment error:', err);
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Invoice Payment</h2>
              <p className="text-xs text-slate-400 font-mono">
                {invoice.invoice_number} • {invoice.customer_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoice Summary Card */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-slate-500 text-[10px]">Invoice Total</div>
              <div className="font-mono font-bold text-white">₹{invoice.grand_total.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">Already Paid</div>
              <div className="font-mono font-bold text-emerald-400">₹{invoice.paid_amount.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">Balance Due</div>
              <div className="font-mono font-extrabold text-rose-400">₹{invoice.balance_due.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Payment Amount (₹) *</label>
              <button
                type="button"
                onClick={handlePayFull}
                className="text-[11px] font-bold text-emerald-400 hover:underline"
              >
                Pay Full Balance (₹{invoice.balance_due.toLocaleString('en-IN')})
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              max={invoice.balance_due}
              step="any"
              required
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Payment Mode *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('UPI')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  paymentMode === 'UPI'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                UPI / GPay
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('CASH')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  paymentMode === 'CASH'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('BANK_TRANSFER')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  paymentMode === 'BANK_TRANSFER'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                Bank Transfer
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('CHEQUE')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  paymentMode === 'CHEQUE'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Cheque
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Ref / UTR / Cheque #</label>
              <input
                type="text"
                placeholder="Optional"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Confirm &amp; Record Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
