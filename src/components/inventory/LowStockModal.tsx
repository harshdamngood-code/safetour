import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { LowStockItem, LowStockAlertResponse, Product } from '../../types/inventory.types';
import {
  X,
  AlertTriangle,
  AlertOctagon,
  Scale,
  PackageCheck,
  TrendingDown,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface LowStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdjustModal: (product: Product) => void;
}

export const LowStockModal: React.FC<LowStockModalProps> = ({
  isOpen,
  onClose,
  onOpenAdjustModal,
}) => {
  const { activeBusiness, token } = useAuth();
  const [data, setData] = useState<LowStockAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !activeBusiness || !token) return;

    const fetchAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const resData = (await api.get<LowStockAlertResponse>(
          '/inventory/low-stock'
        )) as unknown as LowStockAlertResponse;
        if (!resData.success) {
          throw new Error((resData as any).message || 'Failed to fetch low stock alerts');
        }
        setData(resData);
      } catch (err: any) {
        setError(err.message || 'Error fetching low stock items');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [isOpen, activeBusiness, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Stock Reorder &amp; Depletion Alerts</h2>
              <p className="text-xs text-slate-400">
                Items currently at or below minimum threshold requiring replenishment
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
              <p className="text-xs font-semibold">Calculating stock replenishment requirements...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Items to Reorder</div>
                  <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                    {data.count} <span className="text-xs font-normal text-slate-400">SKUs</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completely Out of Stock</div>
                  <div className="text-2xl font-black text-rose-400 font-mono mt-1">
                    {data.criticalCount} <span className="text-xs font-normal text-slate-400">Critical SKUs</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated Reorder Capital</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                    ₹{data.totalRestockCost.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Item &amp; Category</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-center">Min Alert</th>
                      <th className="py-3 px-4 text-center">Deficit</th>
                      <th className="py-3 px-4 text-center">Suggested Reorder</th>
                      <th className="py-3 px-4 text-right">Est. Cost (₹)</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          <PackageCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <div className="text-sm font-bold text-white">All Stock Levels Optimal</div>
                          <div className="text-xs text-slate-500">No items are currently below their minimum threshold.</div>
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {item.isCritical ? (
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                              )}
                              <span>{item.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {item.sku} • {item.category}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span
                              className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                                item.current_stock <= 0
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {item.current_stock} {item.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {item.min_stock_alert} {item.unit}
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-rose-400">
                            {item.deficit > 0 ? `-${item.deficit}` : 0} {item.unit}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                              +{item.suggestedReorderQty} {item.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            ₹{item.estimatedReorderCost.toLocaleString('en-IN')}
                            <div className="text-[10px] font-normal text-slate-500">
                              @ ₹{item.purchase_price}/{item.unit}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                onClose();
                                onOpenAdjustModal(item);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 ml-auto shadow"
                            >
                              <Scale className="w-3 h-3" /> Adjust
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end bg-slate-900/90 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
          >
            Close Alerts
          </button>
        </div>
      </div>
    </div>
  );
};
