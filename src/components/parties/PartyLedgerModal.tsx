import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PartyListItem, PartyLedgerEntry } from '../../types/parties.types';
import {
  X,
  IndianRupee,
  Loader2,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  MessageSquare,
  FileText,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface PartyLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: PartyListItem;
  onRecordPayment: (party: PartyListItem) => void;
  onSendReminder: (party: PartyListItem) => void;
}

export const PartyLedgerModal: React.FC<PartyLedgerModalProps> = ({
  isOpen,
  onClose,
  party,
  onRecordPayment,
  onSendReminder,
}) => {
  const { activeBusiness, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledgerEntries, setLedgerEntries] = useState<PartyLedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isCustomer = party.party_type === 'CUSTOMER';

  useEffect(() => {
    if (!isOpen || !party) return;

    const fetchLedger = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/parties/${party.id}?type=${party.party_type}`);
        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch ledger statement');
        }
        setLedgerEntries(data.ledgerEntries || []);
      } catch (err: any) {
        setError(err.message || 'Could not load ledger entries');
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [isOpen, party, token, activeBusiness]);

  if (!isOpen) return null;

  const currentBal = Number(party.current_balance) || 0;

  // Print Statement Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* Top Profile Banner */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-lg shrink-0 ${
              isCustomer ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
            }`}>
              {party.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">{party.name}</h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  isCustomer
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}>
                  {isCustomer ? 'Customer' : 'Supplier'}
                </span>
              </div>
              {party.company_name && (
                <p className="text-xs text-slate-300 font-medium">{party.company_name}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                {party.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {party.phone}
                  </span>
                )}
                {party.gstin && (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/50">
                    GSTIN: {party.gstin}
                  </span>
                )}
                {party.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {party.city}, {party.state || 'India'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handlePrint}
              title="Print Statement"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Balance & Action Strip */}
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {isCustomer ? 'Net Due to Collect' : 'Net Due to Pay'}
              </div>
              <div className={`text-xl font-black mt-0.5 ${
                currentBal > 0
                  ? (isCustomer ? 'text-rose-400' : 'text-amber-400')
                  : 'text-emerald-400'
              }`}>
                ₹{currentBal.toLocaleString('en-IN')}
              </div>
            </div>

            {isCustomer && party.credit_limit > 0 && (
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 hidden md:block">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Credit Limit</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  ₹{Number(party.credit_limit).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isCustomer && currentBal > 0 && (
              <button
                onClick={() => onSendReminder(party)}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl transition flex items-center gap-1.5 shadow"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Reminder
              </button>
            )}

            <button
              onClick={() => onRecordPayment(party)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 text-white shadow-lg ${
                isCustomer
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {isCustomer ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
              {isCustomer ? 'Record Payment In' : 'Record Payment Out'}
            </button>
          </div>
        </div>

        {/* Ledger Entries List */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Khata Ledger &amp; Transaction History
            </h3>
            <span className="text-xs text-slate-500">
              Opening Balance: <span className="font-mono text-slate-300">₹{(party.opening_balance || 0).toLocaleString('en-IN')}</span>
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
              <p className="text-xs">Loading ledger transactions...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs">
              {error}
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
              <p className="text-sm font-semibold text-slate-300">No Ledger Transactions Yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Invoices, purchases, and payments recorded for this party will appear here in chronological order.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Voucher Type</th>
                      <th className="py-3 px-4">Reference #</th>
                      <th className="py-3 px-4">Details / Description</th>
                      <th className="py-3 px-4 text-right">Debit (₹)</th>
                      <th className="py-3 px-4 text-right">Credit (₹)</th>
                      <th className="py-3 px-4 text-right">Running Due (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                    {/* Opening Balance Row */}
                    {(party.opening_balance || 0) > 0 && (
                      <tr className="bg-slate-900/40 text-slate-400 italic">
                        <td className="py-2.5 px-4">{party.created_at.slice(0, 10)}</td>
                        <td className="py-2.5 px-4">OPENING_BAL</td>
                        <td className="py-2.5 px-4 font-mono">-</td>
                        <td className="py-2.5 px-4">Opening Balance Carry Forward</td>
                        <td className="py-2.5 px-4 text-right">{isCustomer ? `₹${party.opening_balance.toLocaleString('en-IN')}` : '-'}</td>
                        <td className="py-2.5 px-4 text-right">{!isCustomer ? `₹${party.opening_balance.toLocaleString('en-IN')}` : '-'}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-200">
                          ₹{party.opening_balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}

                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id + entry.voucher_no} className="hover:bg-slate-900/50 transition">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{entry.date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            entry.type === 'INVOICE'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              : entry.type === 'PURCHASE'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                              : entry.type === 'PAYMENT_IN'
                              ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300 font-semibold">{entry.voucher_no || '-'}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{entry.description}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-rose-400">
                          {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                          {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          ₹{entry.runningBalance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
