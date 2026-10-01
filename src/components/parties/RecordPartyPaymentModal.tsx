import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PartyListItem } from '../../types/parties.types';
import { X, IndianRupee, Loader2, CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface RecordPartyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  party: PartyListItem;
}

export const RecordPartyPaymentModal: React.FC<RecordPartyPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  party,
}) => {
  const { activeBusiness, token } = useAuth();
  const isCustomer = party.party_type === 'CUSTOMER';
  
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('UPI');
  const [accountType, setAccountType] = useState<'CASH' | 'BANK'>('BANK');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBal = Number(party.current_balance) || 0;
  const numAmount = Number(amount) || 0;
  const projectedBalance = Math.max(0, currentBal - numAmount);

  const handleModeChange = (mode: 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE') => {
    setPaymentMode(mode);
    if (mode === 'CASH') {
      setAccountType('CASH');
    } else {
      setAccountType('BANK');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.post(`/parties/${party.id}/payment`, {
        partyType: party.party_type,
        amount: numAmount,
        paymentMode,
        accountType,
        paymentDate,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to record payment');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment recording failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-800 flex items-center justify-between ${
          isCustomer ? 'bg-emerald-950/30' : 'bg-blue-950/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isCustomer ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {isCustomer ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isCustomer ? 'Record Payment In (Collect Dues)' : 'Record Payment Out (Pay Supplier)'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Party: <span className="text-slate-200 font-semibold">{party.name}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Due vs Remaining Balance Card */}
          <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-800 grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {isCustomer ? 'Total Due to Collect' : 'Total Due to Pay'}
              </div>
              <div className={`text-base font-extrabold mt-0.5 ${
                currentBal > 0 ? (isCustomer ? 'text-rose-400' : 'text-amber-400') : 'text-emerald-400'
              }`}>
                ₹{currentBal.toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Projected Balance
              </div>
              <div className="text-base font-extrabold text-slate-100 mt-0.5">
                ₹{projectedBalance.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Payment Amount (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-base font-bold text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            {currentBal > 0 && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setAmount(String(currentBal))}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition"
                >
                  Full Settle (₹{currentBal.toLocaleString('en-IN')})
                </button>
              </div>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Method &amp; Gateway
            </label>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {(['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  className={`py-2 px-2 rounded-xl font-bold border transition text-center ${
                    paymentMode === mode
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {mode === 'UPI' ? 'UPI / QR' : mode === 'CASH' ? 'Cash Drawer' : mode === 'BANK_TRANSFER' ? 'NetBanking' : 'Cheque'}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ledger Account
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'CASH' | 'BANK')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="BANK" className="bg-slate-900">Current / Bank A/c</option>
                <option value="CASH" className="bg-slate-900">Cash-in-Hand Counter</option>
              </select>
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ref / Txn # (UPI Ref ID / Cheque No / IMPS)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI-92837482819 or CHQ-00129"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Internal Note / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Received via PhonePe QR at store billing counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg disabled:opacity-50 text-white ${
                isCustomer
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm {isCustomer ? 'Payment Receipt' : 'Payment Out'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
