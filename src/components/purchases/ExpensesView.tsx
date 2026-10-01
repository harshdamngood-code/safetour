import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Receipt,
  DollarSign,
  TrendingDown,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Tag,
  Filter
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ExpenseRecord, ExpenseSummary } from '../../types/purchases.types';

const EXPENSE_CATEGORIES = [
  'Office Rent',
  'Electricity & Utilities',
  'Staff Salary & Wages',
  'Logistics & Freight',
  'Packaging Material',
  'Marketing & Advertising',
  'Tea & Refreshments',
  'Software & Subscriptions',
  'Printing & Stationery',
  'Maintenance & Repairs',
  'Travel & Conveyance',
  'Miscellaneous',
];

export const ExpensesView: React.FC = () => {
  const { activeBusiness } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    total_expenses: 0,
    total_expense_gst_itc: 0,
    total_entries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // New Expense Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [description, setDescription] = useState('');
  const [gstin, setGstin] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [isItcEligible, setIsItcEligible] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);

      const data = await api.get(`/purchases/expenses?${params.toString()}`);
      if (data.success) {
        setExpenses(data.data?.expenses || []);
        setSummary(data.data?.summary || { total_expenses: 0, total_expense_gst_itc: 0, total_entries: 0 });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [activeBusiness, selectedCategory]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post('/purchases/expenses', {
        category,
        vendor_name: vendorName.trim() || undefined,
        amount: Number(amount),
        expense_date: expenseDate,
        payment_method: paymentMethod,
        description: description.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        tax_rate: Number(taxRate) || 0,
        is_itc_eligible: isItcEligible,
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to record expense');
      }

      setShowAddModal(false);
      setAmount('');
      setDescription('');
      setVendorName('');
      setGstin('');
      fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Error recording expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const data = await api.delete(`/purchases/expenses/${id}`);
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete expense');
      }
      fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Error deleting expense');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Operating Expenses &amp; Overheads
          </h2>
          <p className="text-xs text-slate-400">
            Track business expenses, overheads, and claim GST Input Tax Credit (ITC)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-amber-600/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Expenses</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            ₹{summary.total_expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">{summary.total_entries} records logged</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Eligible GST ITC Claim</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            ₹{summary.total_expense_gst_itc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Reduces output GST liability in GSTR-3B</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Top Spending Category</span>
          <p className="text-lg font-bold text-amber-400 mt-1 truncate">
            {expenses.length > 0 ? expenses[0].category : 'No Expenses Yet'}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Based on logged entries</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 overflow-x-auto text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1.5 flex-shrink-0">
          <Filter className="w-3.5 h-3.5" />
          Filter Category:
        </span>
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1 rounded-lg font-bold transition flex-shrink-0 ${
            selectedCategory === 'ALL'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All Categories
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-lg font-bold transition flex-shrink-0 ${
              selectedCategory === cat
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Vendor / Payee</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 text-center">Payment Mode</th>
                <th className="p-3.5 text-right">GST ITC (₹)</th>
                <th className="p-3.5 text-right">Total Amount (₹)</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No expense records found. Click "Record Expense" to add one.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 text-slate-300 font-mono">{exp.expense_date}</td>
                    <td className="p-3.5 font-bold text-slate-100 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      {exp.category}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {exp.vendor_name || '-'}
                      {exp.gstin && (
                        <span className="block text-[10px] text-slate-500 font-mono">GST: {exp.gstin}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-400 max-w-xs truncate">{exp.description || '-'}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold text-[10px]">
                        {exp.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-emerald-400 font-semibold">
                      {exp.gst_amount && exp.gst_amount > 0 ? `₹${exp.gst_amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-white text-sm">
                      ₹{exp.amount.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded hover:bg-slate-800"
                        title="Delete expense entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                Record Business Expense
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expense Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expense Date *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">Cash in Hand</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CARD">Credit/Debit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vendor / Payee Name</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Mahavitaran Power Ltd, Landlord, etc."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* GST ITC Claim Toggle */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    GST Input Tax Credit (ITC)
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isItcEligible}
                      onChange={(e) => setIsItcEligible(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-amber-600 focus:ring-0"
                    />
                    <span className="text-slate-400">Claim ITC</span>
                  </label>
                </div>

                {isItcEligible && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">GST Rate (%)</label>
                      <select
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                      >
                        <option value="0">0% (Nil / Exempt)</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Vendor GSTIN (Optional)</label>
                      <input
                        type="text"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        placeholder="27ABCDE1234F1Z5"
                        maxLength={15}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Notes</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly electricity bill for warehouse unit 3..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition text-xs shadow-lg shadow-amber-600/20"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
