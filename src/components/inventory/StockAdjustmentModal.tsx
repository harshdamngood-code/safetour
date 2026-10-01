import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product } from '../../types/inventory.types';
import {
  X,
  PlusCircle,
  MinusCircle,
  Scale,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
}

const REASON_PRESETS: Record<'ADD' | 'REDUCE' | 'SET', string[]> = {
  ADD: [
    'Supplier Direct Delivery',
    'Customer Return Restocked',
    'Found Warehouse Surplus',
    'Packaging Conversion Surplus',
    'Manual Inflow Adjustment',
  ],
  REDUCE: [
    'Damaged / Broken in Transit',
    'Expired / Perished Goods',
    'Inventory Shrinkage / Missing',
    'Internal Company Consumption',
    'Promotional Samples Issued',
    'Defective Batch Write-off',
  ],
  SET: [
    'Monthly Physical Stock Audit',
    'Annual Year-End Stocktaking',
    'System Migration Recalibration',
    'Spot-Check Recount Verification',
  ],
};

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
}) => {
  const { activeBusiness, token } = useAuth();

  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REDUCE' | 'SET'>('ADD');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [reason, setReason] = useState<string>('Supplier Direct Delivery');
  const [customReason, setCustomReason] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>(
    `ADJ-${Date.now().toString().slice(-6)}`
  );
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const currentStock = Number(product.current_stock) || 0;
  const numQty = typeof quantity === 'number' ? quantity : 0;

  let calculatedNewStock = currentStock;
  let stockDelta = 0;

  if (adjustmentType === 'ADD') {
    calculatedNewStock = currentStock + numQty;
    stockDelta = numQty;
  } else if (adjustmentType === 'REDUCE') {
    calculatedNewStock = Math.max(0, currentStock - numQty);
    stockDelta = -Math.min(numQty, currentStock);
  } else if (adjustmentType === 'SET') {
    calculatedNewStock = Math.max(0, numQty);
    stockDelta = calculatedNewStock - currentStock;
  }

  const handleTypeChange = (type: 'ADD' | 'REDUCE' | 'SET') => {
    setAdjustmentType(type);
    setReason(REASON_PRESETS[type][0] || '');
    if (type === 'SET') {
      setQuantity(currentStock);
    } else {
      setQuantity(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !token) return;

    if (quantity === '' || quantity < 0) {
      setError('Please specify a valid non-negative quantity');
      return;
    }

    setLoading(true);
    setError(null);

    const finalReason = customReason.trim() ? customReason.trim() : reason;

    try {
      const data = await api.post(`/inventory/products/${product.id}/adjust-stock`, {
        adjustmentType,
        quantity: numQty,
        reason: finalReason,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to adjust stock');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl my-8 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold">
                {product.sku || 'SKU'}
              </span>
              <h2 className="text-base font-black text-white">{product.name}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Current Registered Stock: <span className="font-bold text-slate-200 font-mono">{currentStock} {product.unit}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Adjustment Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Adjustment Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('ADD')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  adjustmentType === 'ADD'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold">Stock In (+)</span>
                <span className="text-[10px] opacity-75">Goods Inflow</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('REDUCE')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  adjustmentType === 'REDUCE'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <MinusCircle className="w-5 h-5 text-rose-400" />
                <span className="text-xs font-bold">Stock Out (-)</span>
                <span className="text-[10px] opacity-75">Damage / Waste</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('SET')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  adjustmentType === 'SET'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Scale className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">Audit Recount</span>
                <span className="text-[10px] opacity-75">Set Exact Count</span>
              </button>
            </div>
          </div>

          {/* Quantity Input & Real-time calculation */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {adjustmentType === 'SET' ? 'Actual Verified Stock Quantity' : 'Adjustment Quantity'} ({product.unit})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-lg font-bold text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Calculated Preview */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
              <div className="text-slate-400">
                Previous: <span className="font-mono text-slate-200 font-bold">{currentStock} {product.unit}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600" />
              <div className="flex items-center gap-2">
                <span className="text-slate-400">New Balance:</span>
                <span className="font-mono text-base font-black text-white">
                  {calculatedNewStock} {product.unit}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                    stockDelta > 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : stockDelta < 0
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {stockDelta > 0 ? `+${stockDelta}` : stockDelta}
                </span>
              </div>
            </div>
          </div>

          {/* Preset Reasons */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Adjustment
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REASON_PRESETS[adjustmentType].map((pReason) => (
                <button
                  key={pReason}
                  type="button"
                  onClick={() => {
                    setReason(pReason);
                    setCustomReason('');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs transition ${
                    reason === pReason && !customReason
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {pReason}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Or write custom reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reference / Voucher #
              </label>
              <input
                type="text"
                placeholder="e.g. GRN-9482, AUDIT-2026"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Internal Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Verified by Store Manager"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? (
                'Recording...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm Stock Adjustment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
