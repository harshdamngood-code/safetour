import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product, ProductDetailResponse, StockAdjustment, SalesMovement, PurchaseMovement } from '../../types/inventory.types';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Package,
  Calendar,
  User,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ProductLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  onOpenAdjustModal: (product: Product) => void;
}

export const ProductLedgerModal: React.FC<ProductLedgerModalProps> = ({
  isOpen,
  onClose,
  productId,
  onOpenAdjustModal,
}) => {
  const { activeBusiness, token } = useAuth();
  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'adjustments' | 'sales' | 'purchases'>('all');

  useEffect(() => {
    if (!isOpen || !productId || !activeBusiness || !token) return;

    const fetchLedger = async () => {
      setLoading(true);
      setError(null);
      try {
        const resData = (await api.get<ProductDetailResponse>(
          `/inventory/products/${productId}`
        )) as unknown as ProductDetailResponse;
        if (!resData.success) {
          throw new Error((resData as any).message || 'Failed to fetch product movement ledger');
        }
        setData(resData);
      } catch (err: any) {
        setError(err.message || 'Failed to load stock ledger');
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [isOpen, productId, activeBusiness, token]);

  if (!isOpen) return null;

  const product = data?.product;

  // Combine movements chronologically
  const allEvents: Array<{
    id?: string;
    date: string;
    category: 'ADJUSTMENT' | 'SALE' | 'PURCHASE';
    badge: string;
    type: string;
    refNo: string;
    partyOrReason: string;
    qtyDelta: number;
    unitPrice?: number;
    totalAmount?: number;
    notes?: string;
    author?: string;
  }> = [];

  if (data) {
    // Adjustments
    data.adjustments.forEach((a) => {
      const delta =
        a.type === 'ADD'
          ? a.quantity
          : a.type === 'REDUCE'
          ? -a.quantity
          : a.newStock - a.previousStock;

      allEvents.push({
        id: a.id,
        date: a.date,
        category: 'ADJUSTMENT',
        badge: a.type,
        type: `Stock ${a.type === 'ADD' ? 'Inward' : a.type === 'REDUCE' ? 'Outward / Loss' : 'Audit Recount'}`,
        refNo: a.referenceNo || 'ADJ-MANUAL',
        partyOrReason: a.reason,
        qtyDelta: delta,
        notes: a.notes,
        author: a.adjustedBy,
      });
    });

    // Sales
    data.salesMovements.forEach((s, idx) => {
      allEvents.push({
        id: `sale-${idx}`,
        date: s.date,
        category: 'SALE',
        badge: 'SALE_OUT',
        type: 'Customer Sales Invoice',
        refNo: s.voucherNo,
        partyOrReason: s.partyName,
        qtyDelta: -s.quantity,
        unitPrice: s.unitPrice,
        totalAmount: s.totalAmount,
      });
    });

    // Purchases
    data.purchaseMovements.forEach((p, idx) => {
      allEvents.push({
        id: `purchase-${idx}`,
        date: p.date,
        category: 'PURCHASE',
        badge: 'PURCHASE_IN',
        type: 'Vendor Purchase Bill',
        refNo: p.voucherNo,
        partyOrReason: p.partyName,
        qtyDelta: p.quantity,
        unitPrice: p.unitPrice,
        totalAmount: p.totalAmount,
      });
    });

    // Sort descending by date
    allEvents.sort((a, b) => b.date.localeCompare(a.date));
  }

  // Filter based on tab
  const displayedEvents = allEvents.filter((e) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'adjustments') return e.category === 'ADJUSTMENT';
    if (activeTab === 'sales') return e.category === 'SALE';
    if (activeTab === 'purchases') return e.category === 'PURCHASE';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Stock Movement &amp; Item Ledger</h2>
              <p className="text-xs text-slate-400">Complete audit trail of sales dispatch, purchase receipts, and inventory reconciliations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-xs font-semibold">Loading stock ledger &amp; transactions...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : product ? (
            <>
              {/* Product Info Top Strip */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                      {product.sku || 'SKU-NONE'}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                      {product.category}
                    </span>
                    {product.hsn_code && (
                      <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-lg">
                        HSN: {product.hsn_code}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white">{product.name}</h3>
                </div>

                {/* KPI Metrics */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Current Stock</div>
                    <div className="text-lg font-black text-white font-mono">
                      {product.current_stock} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                    </div>
                  </div>

                  <div className="text-right pl-4 border-l border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Purchase Price</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      ₹{product.purchase_price}
                    </div>
                  </div>

                  <div className="text-right pl-4 border-l border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Selling Price</div>
                    <div className="text-sm font-bold text-indigo-400 font-mono">
                      ₹{product.selling_price}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenAdjustModal(product);
                    }}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <Scale className="w-3.5 h-3.5" /> Adjust Stock
                  </button>
                </div>
              </div>

              {/* Ledger Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  All Events ({allEvents.length})
                </button>
                <button
                  onClick={() => setActiveTab('adjustments')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'adjustments'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Adjustments ({data.adjustments.length})
                </button>
                <button
                  onClick={() => setActiveTab('sales')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'sales'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Sales Outflow ({data.salesMovements.length})
                </button>
                <button
                  onClick={() => setActiveTab('purchases')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'purchases'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Purchase Receipts ({data.purchaseMovements.length})
                </button>
              </div>

              {/* Transactions Timeline Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type &amp; Event</th>
                      <th className="py-3 px-4">Ref / Voucher #</th>
                      <th className="py-3 px-4">Party / Reason</th>
                      <th className="py-3 px-4 text-right">Quantity Delta</th>
                      <th className="py-3 px-4 text-right">Rate / Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {displayedEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No stock movements found under this category.
                        </td>
                      </tr>
                    ) : (
                      displayedEvents.map((evt, idx) => (
                        <tr key={evt.id || idx} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {evt.date}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {evt.qtyDelta > 0 ? (
                                <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                                  <ArrowDownLeft className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <div>
                                <div className="font-bold text-white">{evt.type}</div>
                                {evt.author && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <User className="w-2.5 h-2.5" /> {evt.author}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {evt.refNo}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-200">{evt.partyOrReason}</div>
                            {evt.notes && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5">{evt.notes}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${
                                evt.qtyDelta > 0
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {evt.qtyDelta > 0 ? `+${evt.qtyDelta}` : evt.qtyDelta} {product.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {evt.unitPrice !== undefined ? (
                              <div>
                                <div className="text-white font-bold">₹{evt.totalAmount?.toLocaleString('en-IN')}</div>
                                <div className="text-[10px] text-slate-400">@ ₹{evt.unitPrice}/{product.unit}</div>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
