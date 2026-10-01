import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PartyListItem, PartySummary, PartyType } from '../../types/parties.types';
import { CreatePartyModal } from './CreatePartyModal';
import { RecordPartyPaymentModal } from './RecordPartyPaymentModal';
import { WhatsAppReminderModal } from './WhatsAppReminderModal';
import { PartyLedgerModal } from './PartyLedgerModal';
import { SubViewHint } from '../layout/Navbar';
import {
  TiltCard,
  GlassCard,
  AnimatedNumber,
  TableSkeleton,
  EmptyState3D,
} from '../ui/3d-system';
import {
  Users,
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  IndianRupee,
  Phone,
  MessageSquare,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface PartiesViewProps {
  initialHint?: SubViewHint;
}

export const PartiesView: React.FC<PartiesViewProps> = ({ initialHint }) => {
  const { activeBusiness, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyListItem[]>([]);
  const [summary, setSummary] = useState<PartySummary | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier'>(
    initialHint === 'customers'
      ? 'customer'
      : initialHint === 'suppliers'
      ? 'supplier'
      : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'settled'>(
    initialHint === 'payments' ? 'due' : 'all'
  );

  useEffect(() => {
    if (initialHint === 'customers') {
      setActiveTab('customer');
      setStatusFilter('all');
    } else if (initialHint === 'suppliers') {
      setActiveTab('supplier');
      setStatusFilter('all');
    } else if (initialHint === 'payments') {
      setActiveTab('all');
      setStatusFilter('due');
    }
  }, [initialHint]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<PartyType>('CUSTOMER');
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState<PartyListItem | null>(null);
  const [selectedPartyForReminder, setSelectedPartyForReminder] = useState<PartyListItem | null>(null);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<PartyListItem | null>(null);

  const fetchParties = useCallback(async () => {
    if (!activeBusiness || !token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeTab !== 'all') queryParams.append('type', activeTab);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);

      const data = await api.get(`/parties?${queryParams.toString()}`);
      if (data.success) {
        setParties(data.parties || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load parties:', err);
    } finally {
      setLoading(false);
    }
  }, [activeBusiness, token, activeTab, searchQuery, statusFilter]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const handleOpenCreateParty = (type: PartyType) => {
    setCreateInitialType(type);
    setCreateModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Parties &amp; Khata Book</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
              Udhar Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your customer receivables, supplier payables, credit limits, and payment statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchParties()}
            title="Refresh Directory"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => handleOpenCreateParty('CUSTOMER')}
            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            + Customer
          </button>

          <button
            onClick={() => handleOpenCreateParty('SUPPLIER')}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            + Supplier
          </button>
        </div>
      </div>

      {/* Udhar / Khata Aggregated 3D Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables (Customers Dues) */}
        <TiltCard glowColor="rose" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">To Collect (Receivables)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-400 mt-2 font-mono">
            <AnimatedNumber value={summary?.totalReceivable || 0} isCurrency />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Pending market dues from {summary?.customerCount || 0} customers
          </p>
        </TiltCard>

        {/* Total Payables (Suppliers Dues) */}
        <TiltCard glowColor="amber" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">To Pay (Payables)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2 font-mono">
            <AnimatedNumber value={summary?.totalPayable || 0} isCurrency />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Pending supplier dues across {summary?.supplierCount || 0} vendors
          </p>
        </TiltCard>

        {/* Net Market Balance */}
        <TiltCard glowColor="indigo" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Net Market Position</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold mt-2 font-mono ${
            (summary?.netKhata || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            <AnimatedNumber value={Math.abs(summary?.netKhata || 0)} isCurrency />
            <span className="text-xs font-sans ml-1.5 text-slate-400 font-semibold">
              {(summary?.netKhata || 0) >= 0 ? '(In Hand)' : '(Net Debt)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Receivables minus payables balance
          </p>
        </TiltCard>

        {/* Total Active Commercial Parties */}
        <TiltCard glowColor="cyan" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Registered Parties</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">
            <AnimatedNumber value={summary?.totalParties || 0} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary?.customerCount || 0} Buyers · {summary?.supplierCount || 0} Suppliers
          </p>
        </TiltCard>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Party Type Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 w-full md:w-auto text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold transition ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Parties ({summary?.totalParties || 0})
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold transition ${
                activeTab === 'customer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Customers / Buyers ({summary?.customerCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('supplier')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold transition ${
                activeTab === 'supplier'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Suppliers / Vendors ({summary?.supplierCount || 0})
            </button>
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end text-xs">
            <span className="text-slate-500 font-semibold hidden lg:inline">Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-600'
                  : 'bg-transparent text-slate-400 border-slate-800 hover:bg-slate-800/40'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('due')}
              className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
                statusFilter === 'due'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-transparent text-slate-400 border-slate-800 hover:bg-slate-800/40'
              }`}
            >
              Pending Dues Only
            </button>
            <button
              onClick={() => setStatusFilter('settled')}
              className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
                statusFilter === 'settled'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-transparent text-slate-400 border-slate-800 hover:bg-slate-800/40'
              }`}
            >
              Settled / Nil
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
          <input
            type="text"
            placeholder="Search party by name, phone (+91), GSTIN number, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Parties Table / Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-xs font-semibold">Loading commercial parties directory...</p>
          </div>
        ) : parties.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-200">No parties found matching criteria</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your first customer or vendor to begin tracking billing khata, payments, and GST vouchers.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => handleOpenCreateParty('CUSTOMER')}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition"
              >
                + Add Customer
              </button>
              <button
                onClick={() => handleOpenCreateParty('SUPPLIER')}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition"
              >
                + Add Supplier
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Party Details</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">GSTIN &amp; Location</th>
                  <th className="py-3.5 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {parties.map((party) => {
                  const isCust = party.party_type === 'CUSTOMER';
                  const bal = Number(party.current_balance) || 0;

                  return (
                    <tr
                      key={party.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => setSelectedPartyForLedger(party)}
                    >
                      {/* Party Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                            isCust ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
                          }`}>
                            {party.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition flex items-center gap-2">
                              <span>{party.name}</span>
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                                isCust
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                              }`}>
                                {isCust ? 'Customer' : 'Supplier'}
                              </span>
                            </div>
                            {party.company_name && (
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{party.company_name}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-4 px-4 text-slate-300" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-0.5">
                          {party.phone ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{party.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No phone</span>
                          )}
                          {party.email && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{party.email}</div>
                          )}
                        </div>
                      </td>

                      {/* GSTIN & City */}
                      <td className="py-4 px-4 text-slate-300">
                        <div className="space-y-0.5">
                          {party.gstin ? (
                            <div className="font-mono text-[11px] text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/50 inline-block">
                              {party.gstin}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">Unregistered</span>
                          )}
                          <div className="text-[11px] text-slate-400">
                            {party.city || 'India'}, {party.state || ''}
                          </div>
                        </div>
                      </td>

                      {/* Outstanding Balance */}
                      <td className="py-4 px-4 text-right">
                        <div className={`font-mono text-sm font-black ${
                          bal > 0
                            ? (isCust ? 'text-rose-400' : 'text-amber-400')
                            : 'text-emerald-400'
                        }`}>
                          ₹{bal.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {bal > 0 ? (isCust ? 'To Collect' : 'To Pay') : 'Settled'}
                        </div>
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp Reminder (Customers with balance) */}
                          {isCust && bal > 0 && (
                            <button
                              onClick={() => setSelectedPartyForReminder(party)}
                              title="Send WhatsApp Payment Reminder"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Record Payment In / Out */}
                          <button
                            onClick={() => setSelectedPartyForPayment(party)}
                            title={isCust ? 'Record Payment In' : 'Record Payment Out'}
                            className={`p-1.5 rounded-lg border transition ${
                              isCust
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {isCust ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          </button>

                          {/* Open Statement */}
                          <button
                            onClick={() => setSelectedPartyForLedger(party)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-[11px] flex items-center gap-1 transition"
                          >
                            <FileText className="w-3 h-3 text-slate-400" />
                            Statement
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
      </div>

      {/* CREATE PARTY MODAL */}
      <CreatePartyModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchParties()}
        initialType={createInitialType}
      />

      {/* RECORD PAYMENT MODAL */}
      {selectedPartyForPayment && (
        <RecordPartyPaymentModal
          isOpen={!!selectedPartyForPayment}
          party={selectedPartyForPayment}
          onClose={() => setSelectedPartyForPayment(null)}
          onSuccess={() => {
            fetchParties();
          }}
        />
      )}

      {/* WHATSAPP REMINDER MODAL */}
      {selectedPartyForReminder && (
        <WhatsAppReminderModal
          isOpen={!!selectedPartyForReminder}
          party={selectedPartyForReminder}
          onClose={() => setSelectedPartyForReminder(null)}
        />
      )}

      {/* PARTY LEDGER STATEMENT MODAL */}
      {selectedPartyForLedger && (
        <PartyLedgerModal
          isOpen={!!selectedPartyForLedger}
          party={selectedPartyForLedger}
          onClose={() => setSelectedPartyForLedger(null)}
          onRecordPayment={(p) => {
            setSelectedPartyForLedger(null);
            setSelectedPartyForPayment(p);
          }}
          onSendReminder={(p) => {
            setSelectedPartyForReminder(p);
          }}
        />
      )}

    </div>
  );
};
