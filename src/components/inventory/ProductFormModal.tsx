import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product } from '../../types/inventory.types';
import {
  X,
  Package,
  Barcode,
  Hash,
  Sparkles,
  Percent,
  AlertTriangle,
  ArrowRight,
  Check,
  TrendingUp,
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  categories: string[];
}

const COMMON_HSN_CODES = [
  { hsn: '1006', desc: 'Rice & Grains', gst: 5 },
  { hsn: '1509', desc: 'Edible Oils', gst: 5 },
  { hsn: '1905', desc: 'Bakery & Biscuits', gst: 18 },
  { hsn: '2202', desc: 'Packaged Beverages', gst: 28 },
  { hsn: '3402', desc: 'Soaps & Detergents', gst: 18 },
  { hsn: '8471', desc: 'Computers & Electronics', gst: 18 },
  { hsn: '9983', desc: 'Professional Services', gst: 18 },
  { hsn: '6203', desc: 'Apparel & Garments', gst: 12 },
  { hsn: '0402', desc: 'Milk & Dairy Products', gst: 5 },
  { hsn: '2106', desc: 'Food Preparations & Spices', gst: 18 },
];

const STANDARD_UNITS = [
  'PCS',
  'KG',
  'GM',
  'LTR',
  'ML',
  'BOX',
  'PKT',
  'DOZ',
  'MTR',
  'BAG',
  'CAN',
  'PAIR',
  'TON',
  'SET',
  'HRS',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
  categories,
}) => {
  const { activeBusiness, token } = useAuth();
  const isEditing = !!product;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    hsn_code: '',
    category: '',
    unit: 'PCS',
    purchase_price: 0,
    selling_price: 0,
    mrp: 0,
    tax_rate: 18,
    is_tax_inclusive: false,
    opening_stock: 0,
    min_stock_alert: 10,
  });

  const [customCategory, setCustomCategory] = useState('');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        hsn_code: product.hsn_code || '',
        category: product.category || 'General',
        unit: product.unit || 'PCS',
        purchase_price: product.purchase_price || 0,
        selling_price: product.selling_price || 0,
        mrp: product.mrp || product.selling_price || 0,
        tax_rate: product.tax_rate !== undefined ? product.tax_rate : 18,
        is_tax_inclusive: Boolean(product.is_tax_inclusive),
        opening_stock: product.current_stock || 0,
        min_stock_alert: product.min_stock_alert !== undefined ? product.min_stock_alert : 10,
      });
      setIsAddingNewCategory(false);
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        hsn_code: '',
        category: categories[0] || 'Grains & Pulses',
        unit: 'PCS',
        purchase_price: 0,
        selling_price: 0,
        mrp: 0,
        tax_rate: 18,
        is_tax_inclusive: false,
        opening_stock: 0,
        min_stock_alert: 10,
      });
      setIsAddingNewCategory(false);
    }
    setError(null);
  }, [product, isOpen, categories]);

  if (!isOpen) return null;

  // Auto-generate SKU
  const handleGenerateSku = () => {
    const prefix = formData.name
      ? formData.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
      : 'ITEM';
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${rand}` }));
  };

  // Auto-generate Barcode (EAN-13 style simulation)
  const handleGenerateBarcode = () => {
    const randomDigits = Math.floor(100000000000 + Math.random() * 900000000000);
    setFormData((prev) => ({ ...prev, barcode: `890${randomDigits}`.slice(0, 13) }));
  };

  // Profit margin calculation
  const purchase = Number(formData.purchase_price) || 0;
  const selling = Number(formData.selling_price) || 0;
  const profitMarginAmount = selling - purchase;
  const profitMarginPercent = purchase > 0 ? ((profitMarginAmount / purchase) * 100).toFixed(1) : '0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !token) return;

    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const targetCategory = isAddingNewCategory && customCategory.trim()
      ? customCategory.trim()
      : formData.category || 'General';

    try {
      const payload = {
        ...formData,
        category: targetCategory,
        purchase_price: Number(formData.purchase_price) || 0,
        selling_price: Number(formData.selling_price) || 0,
        mrp: Number(formData.mrp) || Number(formData.selling_price) || 0,
        tax_rate: Number(formData.tax_rate) || 0,
        is_tax_inclusive: formData.is_tax_inclusive,
        opening_stock: Number(formData.opening_stock) || 0,
        min_stock_alert: Number(formData.min_stock_alert) || 0,
      };

      const data = isEditing
        ? await api.put(`/inventory/products/${product.id}`, payload)
        : await api.post('/inventory/products', payload);

      if (!data.success) {
        throw new Error(data.message || 'Failed to save product');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl my-8 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                {isEditing ? 'Edit Item / Service' : 'Add New Item to Inventory'}
              </h2>
              <p className="text-xs text-slate-400">
                GST compliant item details with auto-tax computation &amp; stock alert rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Identity */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Item Identification &amp; Classification
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Item Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Basmati Rice 10kg, Tata Tea Premium, Consultation Service"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Category</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[11px] text-indigo-400 hover:underline font-normal"
                  >
                    {isAddingNewCategory ? 'Select from list' : '+ Custom Category'}
                  </button>
                </label>

                {isAddingNewCategory ? (
                  <input
                    type="text"
                    placeholder="Enter custom category name"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-indigo-500/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Unit of Measure */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Unit of Measurement
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {STANDARD_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>SKU / Item Code</span>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-normal"
                  >
                    <Sparkles className="w-3 h-3" /> Auto Generate
                  </button>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="e.g. RICE-BAS-01"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Barcode (EAN / UPC)</span>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-normal"
                  >
                    <Sparkles className="w-3 h-3" /> Generate EAN-13
                  </button>
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="e.g. 8901030383721"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & GST Tax Rates */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Pricing &amp; GST Configuration
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Purchase Cost */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Purchase Cost (₹)
                </label>
                <div className="relative">
                  <span className="text-slate-500 font-bold absolute left-3.5 top-2.5 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.purchase_price || ''}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Selling Price (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="text-slate-500 font-bold absolute left-3.5 top-2.5 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.selling_price || ''}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* MRP */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Maximum Retail Price / MRP (₹)
                </label>
                <div className="relative">
                  <span className="text-slate-500 font-bold absolute left-3.5 top-2.5 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.mrp || ''}
                    onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Live Profit Margin Bar */}
            {selling > 0 && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>
                    Gross Margin:{' '}
                    <strong className="text-white font-mono">₹{profitMarginAmount.toFixed(2)}</strong> per {formData.unit}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    {profitMarginPercent}% Markup
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* GST Rate */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  GST Tax Rate (%)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setFormData({ ...formData, tax_rate: rate })}
                      className={`py-2 rounded-xl text-xs font-bold font-mono transition ${
                        formData.tax_rate === rate
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* HSN / SAC code */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  HSN / SAC Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1006, 1905, 8471"
                  value={formData.hsn_code}
                  onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Quick HSN Suggestions */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5">Popular Indian HSN Codes:</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_HSN_CODES.map((item) => (
                  <button
                    key={item.hsn}
                    type="button"
                    onClick={() => setFormData({ ...formData, hsn_code: item.hsn, tax_rate: item.gst })}
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300 hover:border-indigo-500 hover:text-white transition flex items-center gap-1"
                  >
                    <span className="font-mono font-bold text-indigo-400">{item.hsn}</span>
                    <span>({item.desc} - {item.gst}%)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tax Inclusive Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
              <div>
                <div className="text-xs font-semibold text-white">Prices are Tax Inclusive</div>
                <div className="text-[11px] text-slate-400">
                  When enabled, invoice calculations will reverse-calculate base price from selling price.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_tax_inclusive: !formData.is_tax_inclusive })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  formData.is_tax_inclusive ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    formData.is_tax_inclusive ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 3: Stock Control & Thresholds */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Stock Management &amp; Reorder Alerts
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opening / Initial Stock */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isEditing ? 'Current Stock Level' : 'Initial Opening Stock'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={isEditing}
                  value={formData.opening_stock}
                  onChange={(e) => setFormData({ ...formData, opening_stock: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono focus:outline-none ${
                    isEditing ? 'text-slate-400 bg-slate-950/50 cursor-not-allowed' : 'text-white focus:border-amber-500'
                  }`}
                />
                {isEditing && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    To modify existing stock, use the "Adjust Stock" button on the inventory ledger.
                  </p>
                )}
              </div>

              {/* Min Stock Alert Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.min_stock_alert}
                  onChange={(e) => setFormData({ ...formData, min_stock_alert: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Triggers reorder suggestions when stock falls to or below this count.
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? (
                'Saving...'
              ) : isEditing ? (
                'Update Item Details'
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Item to Catalog
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
