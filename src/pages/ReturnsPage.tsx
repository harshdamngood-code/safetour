import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, Search, CheckCircle2, AlertCircle, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, tokenStorage } from '../lib/api';

export const ReturnsPage: React.FC = () => {
  const { activeBusiness } = useAuth();
  const token = tokenStorage.getToken();
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASE'>('SALES');
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New return form state
  const [entityName, setEntityName] = useState('');
  const [returnNumber, setReturnNumber] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Damaged goods / Customer return');
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [taxRate, setTaxRate] = useState(18);

  const fetchReturns = async () => {
    if (!activeBusiness?.id || !token) return;
    try {
      setLoading(true);
      const [salesJson, purJson] = await Promise.all([
        api.get('/returns/sales'),
        api.get('/returns/purchases'),
      ]);

      if (salesJson.success) setSalesReturns(salesJson.data || []);
      if (purJson.success) setPurchaseReturns(purJson.data || []);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [activeBusiness?.id, token]);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || !token) return;

    const subtotal = itemQty * itemPrice;
    const taxTotal = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxTotal;

    const endpoint = activeTab === 'SALES' ? '/returns/sales' : '/returns/purchases';
    const payload = activeTab === 'SALES'
      ? {
          customer_name: entityName,
          return_number: returnNumber || `CN-${Date.now().toString().slice(-6)}`,
          return_date: returnDate,
          reason,
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          refund_amount: grandTotal,
          items: [
            {
              item_name: itemName,
              quantity: itemQty,
              unit_price: itemPrice,
              tax_rate: taxRate,
              taxable_amount: subtotal,
              total_amount: grandTotal,
            },
          ],
        }
      : {
          supplier_name: entityName,
          return_number: returnNumber || `DN-${Date.now().toString().slice(-6)}`,
          return_date: returnDate,
          reason,
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          refund_amount: grandTotal,
          items: [
            {
              item_name: itemName,
              quantity: itemQty,
              unit_cost: itemPrice,
              tax_rate: taxRate,
              taxable_amount: subtotal,
              total_amount: grandTotal,
            },
          ],
        };

    try {
      const json = await api.post(endpoint, payload);
      if (json.success) {
        setShowCreateModal(false);
        // Reset form
        setEntityName('');
        setItemName('');
        setItemPrice(0);
        fetchReturns();
      }
    } catch (err: any) {
      console.error('Error recording return:', err);
    }
  };

  return (
    <div id="returns-page-container" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Returns & Notes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage Sales Returns (Credit Notes) & Purchase Returns (Debit Notes) with automatic stock sync.
          </p>
        </div>

        <button
          id="create-return-btn"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {activeTab === 'SALES' ? 'Record Sales Return (Credit Note)' : 'Record Purchase Return (Debit Note)'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          id="tab-sales-returns"
          onClick={() => setActiveTab('SALES')}
          className={`flex items-center gap-2 border-b-2 py-3 px-5 text-sm font-semibold transition-colors ${
            activeTab === 'SALES'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" />
          Sales Returns (Credit Notes)
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{salesReturns.length}</span>
        </button>
        <button
          id="tab-purchase-returns"
          onClick={() => setActiveTab('PURCHASE')}
          className={`flex items-center gap-2 border-b-2 py-3 px-5 text-sm font-semibold transition-colors ${
            activeTab === 'PURCHASE'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          Purchase Returns (Debit Notes)
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{purchaseReturns.length}</span>
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading returns...</div>
        ) : (activeTab === 'SALES' ? salesReturns : purchaseReturns).length === 0 ? (
          <div className="py-16 text-center">
            <RotateCcw className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-900">No {activeTab.toLowerCase()} returns recorded</p>
            <p className="mt-1 text-xs text-slate-500">Record credit/debit notes to reverse inventory and customer balances.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="py-3.5 pl-6 pr-3">Note Number</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3">{activeTab === 'SALES' ? 'Customer' : 'Supplier'}</th>
                  <th className="py-3.5 px-3">Reason</th>
                  <th className="py-3.5 px-3 text-right">Taxable</th>
                  <th className="py-3.5 px-3 text-right">GST Total</th>
                  <th className="py-3.5 pr-6 pl-3 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeTab === 'SALES' ? salesReturns : purchaseReturns).map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/50">
                    <td className="py-4 pl-6 pr-3 font-semibold text-slate-900">{ret.return_number}</td>
                    <td className="py-4 px-3 text-slate-600">{ret.return_date}</td>
                    <td className="py-4 px-3 font-medium text-slate-800">{activeTab === 'SALES' ? ret.customer_name : ret.supplier_name}</td>
                    <td className="py-4 px-3 text-slate-500">{ret.reason || 'Standard Return'}</td>
                    <td className="py-4 px-3 text-right text-slate-600">₹{Number(ret.subtotal).toFixed(2)}</td>
                    <td className="py-4 px-3 text-right text-slate-600">₹{Number(ret.tax_total).toFixed(2)}</td>
                    <td className="py-4 pr-6 pl-3 text-right font-bold text-slate-900">₹{Number(ret.grand_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {activeTab === 'SALES' ? 'Record Sales Return (Credit Note)' : 'Record Purchase Return (Debit Note)'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateReturn} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {activeTab === 'SALES' ? 'Customer Name *' : 'Supplier Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="e.g. Ramesh Hardware"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Date *</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Returned Item Name *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Wireless Mouse"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Rate (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST Rate %</label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Return</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Defective unit, customer cancellation"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{(itemQty * itemPrice).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({taxRate}%):</span>
                  <span>₹{((itemQty * itemPrice * taxRate) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-1">
                  <span>Total Credit/Debit Value:</span>
                  <span>₹{(itemQty * itemPrice * (1 + taxRate / 100)).toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Confirm & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
