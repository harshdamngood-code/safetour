import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { X, PackagePlus, Loader2, IndianRupee, CheckCircle2, AlertCircle } from 'lucide-react';

interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UNITS = ['PCS', 'KG', 'GM', 'LTR', 'ML', 'BAG', 'BOX', 'CAN', 'MTR', 'PKT', 'SET'];
const TAX_RATES = [0, 5, 12, 18, 28];

export const QuickProductModal: React.FC<QuickProductModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeBusiness, token } = useAuth();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [taxRate, setTaxRate] = useState(18);
  const [currentStock, setCurrentStock] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.post('/dashboard/quick-product', {
        name: name.trim(),
        sku: sku.trim() || undefined,
        category: category.trim() || 'General',
        unit,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        taxRate: Number(taxRate),
        currentStock: Number(currentStock) || 0,
        minStockAlert: Number(minStockAlert) || 10,
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to add product');
      }

      // Reset and trigger refresh
      setName('');
      setSku('');
      setCategory('');
      setPurchasePrice('');
      setSellingPrice('');
      setCurrentStock('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add Inventory Product</h3>
              <p className="text-xs text-slate-400">
                Track stock and low-stock alerts for <span className="text-emerald-300 font-semibold">{activeBusiness?.business_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Name & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Item Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Basmati Rice 25kg / Dell Wireless Mouse"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SKU / Code
              </label>
              <input
                type="text"
                placeholder="PROD-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Grains, Electronics"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Primary Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u} className="bg-slate-900 text-white">
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & GST Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Purchase Price (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-8 pr-2.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Selling Price (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-8 pr-2.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                GST Rate (%)
              </label>
              <select
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {TAX_RATES.map((rate) => (
                  <option key={rate} value={rate} className="bg-slate-900 text-white">
                    {rate}% GST
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Stock & Low Stock Alert */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Opening Stock
              </label>
              <input
                type="number"
                placeholder="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
              <p className="text-[10px] text-slate-500 mt-1">Available inventory count on hand</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1">
                Min. Stock Alert Threshold
              </label>
              <input
                type="number"
                placeholder="10"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                className="w-full bg-slate-800/80 border border-amber-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
              />
              <p className="text-[10px] text-amber-400/80 mt-1">Triggers alert on Dashboard when stock falls below this</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
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
              className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Add to Inventory
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
