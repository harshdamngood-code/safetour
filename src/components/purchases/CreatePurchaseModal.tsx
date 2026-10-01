import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Package,
  Calculator,
  Building2,
  Calendar,
  AlertCircle,
  CreditCard,
  Percent,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { CreatePurchasePayload, CreatePurchaseItemPayload } from '../../types/purchases.types';

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeBusiness } = useAuth();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [supplierState, setSupplierState] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [isFullPaid, setIsFullPaid] = useState(false);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<CreatePurchaseItemPayload[]>([
    {
      product_id: '',
      item_name: '',
      hsn_code: '',
      quantity: 1,
      unit: 'PCS',
      unit_cost: 0,
      discount_percent: 0,
      tax_rate: 18,
    },
  ]);

  useEffect(() => {
    if (!isOpen || !activeBusiness) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [suppData, prodData] = await Promise.all([
          api.get('/parties/suppliers') as Promise<any>,
          api.get('/inventory/products') as Promise<any>,
        ]);

        if (suppData.success) {
          setSuppliers(suppData.data?.suppliers || suppData.suppliers || suppData.data || []);
        }
        if (prodData.success) {
          setProducts(prodData.data?.products || prodData.products || []);
        }
      } catch (err: any) {
        console.error('Failed to load purchase prerequisites:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setSupplierState(activeBusiness.state || 'Maharashtra');
  }, [isOpen, activeBusiness]);

  if (!isOpen || !activeBusiness) return null;

  const handleSupplierSelect = (id: string) => {
    setSupplierId(id);
    if (id === 'NEW') {
      setSupplierName('');
      setSupplierGstin('');
      setSupplierState(activeBusiness.state || 'Maharashtra');
      return;
    }

    const supp = suppliers.find((s) => s.id === id);
    if (supp) {
      setSupplierName(supp.name);
      setSupplierGstin(supp.gstin || '');
      setSupplierState(supp.state || activeBusiness.state || 'Maharashtra');
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const newItems = [...items];
    if (prodId === 'CUSTOM') {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        item_name: '',
        hsn_code: '',
        unit_cost: 0,
        tax_rate: 18,
      };
      setItems(newItems);
      return;
    }

    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      newItems[index] = {
        ...newItems[index],
        product_id: prod.id,
        item_name: prod.name,
        hsn_code: prod.hsn_code || '',
        unit: prod.unit || 'PCS',
        unit_cost: prod.purchase_price || 0,
        tax_rate: prod.tax_rate ?? 18,
      };
      setItems(newItems);
    }
  };

  const updateItemField = (index: number, field: keyof CreatePurchaseItemPayload, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        product_id: '',
        item_name: '',
        hsn_code: '',
        quantity: 1,
        unit: 'PCS',
        unit_cost: 0,
        discount_percent: 0,
        tax_rate: 18,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Tax calculations
  const businessState = (activeBusiness.state || '').trim().toLowerCase();
  const isInterState = supplierState.trim().toLowerCase() !== businessState && supplierState.trim() !== '';

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  items.forEach((it) => {
    const qty = Number(it.quantity) || 0;
    const cost = Number(it.unit_cost) || 0;
    const disc = Number(it.discount_percent) || 0;
    const rate = Number(it.tax_rate) || 0;

    const raw = qty * cost;
    const d = raw * (disc / 100);
    const taxable = raw - d;
    const tax = taxable * (rate / 100);

    subtotal += raw;
    discountTotal += d;
    taxTotal += tax;

    if (isInterState) {
      igstTotal += tax;
    } else {
      cgstTotal += tax / 2;
      sgstTotal += tax / 2;
    }
  });

  const grossTotal = subtotal - discountTotal + taxTotal;
  const roundOff = Math.round(grossTotal) - grossTotal;
  const grandTotal = Math.round(grossTotal);

  const handleFullPaidToggle = (checked: boolean) => {
    setIsFullPaid(checked);
    if (checked) {
      setPaidAmount(grandTotal.toString());
    } else {
      setPaidAmount('0');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError('Please select or specify a supplier name');
      return;
    }
    if (!billNumber.trim()) {
      setError('Please enter the vendor bill/invoice number');
      return;
    }
    if (items.some((i) => !i.item_name.trim() || Number(i.quantity) <= 0)) {
      setError('Please complete all item lines with valid names and quantities');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreatePurchasePayload = {
        supplier_id: supplierId && supplierId !== 'NEW' ? supplierId : undefined,
        supplier_name: supplierName.trim(),
        supplier_gstin: supplierGstin.trim() || undefined,
        supplier_state: supplierState.trim() || activeBusiness.state,
        bill_number: billNumber.trim(),
        bill_date: billDate,
        due_date: dueDate || undefined,
        payment_method: Number(paidAmount) > 0 ? paymentMethod : undefined,
        paid_amount: Number(paidAmount) || 0,
        round_off: roundOff,
        notes: notes.trim() || undefined,
        items,
      };

      const data = await api.post('/purchases', payload);
      if (!data.success) {
        throw new Error(data.message || 'Failed to record purchase bill');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while recording the purchase bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Record Inward Purchase Bill</h2>
              <p className="text-xs text-slate-400">
                Inward stock from supplier • Increases inventory &amp; updates supplier Khata balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier & Bill Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Supplier / Vendor *</label>
              <select
                value={supplierId}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
              >
                <option value="">Select Existing Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.company_name || s.phone || 'No Phone'})
                  </option>
                ))}
                <option value="NEW">+ Enter Custom / New Supplier</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Supplier Name *</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Apex Electronics Ltd"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Supplier GSTIN (15 Digits)</label>
              <input
                type="text"
                value={supplierGstin}
                onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())}
                placeholder="27ABCDE1234F1Z5"
                maxLength={15}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 uppercase text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Supplier State (Place of Supply)</label>
              <input
                type="text"
                value={supplierState}
                onChange={(e) => setSupplierState(e.target.value)}
                placeholder="e.g. Maharashtra or Gujarat"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {isInterState ? (
                  <span className="text-amber-400 font-semibold">Inter-State Supply (IGST Applicable)</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">Intra-State Supply (CGST + SGST Applicable)</span>
                )}
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Vendor Bill / Invoice No *</label>
              <input
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="e.g. VEND-98432"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Bill Date *</label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                Inward Purchase Line Items
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg font-semibold flex items-center gap-1.5 transition text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-2.5 min-w-[220px]">Item / Product</th>
                    <th className="p-2.5 w-24">HSN</th>
                    <th className="p-2.5 w-20">Qty</th>
                    <th className="p-2.5 w-20">Unit</th>
                    <th className="p-2.5 w-28">Unit Cost (₹)</th>
                    <th className="p-2.5 w-20">Disc %</th>
                    <th className="p-2.5 w-24">GST Rate</th>
                    <th className="p-2.5 w-28 text-right">Taxable (₹)</th>
                    <th className="p-2.5 w-28 text-right">Total (₹)</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const cost = Number(item.unit_cost) || 0;
                    const disc = Number(item.discount_percent) || 0;
                    const rate = Number(item.tax_rate) || 0;
                    const taxable = qty * cost * (1 - disc / 100);
                    const lineTot = taxable * (1 + rate / 100);

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2 space-y-1">
                          <select
                            value={item.product_id || 'CUSTOM'}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="CUSTOM">Custom Line Item</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.current_stock} {p.unit || 'PCS'})
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => updateItemField(idx, 'item_name', e.target.value)}
                            placeholder="Enter description..."
                            required
                            className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.hsn_code || ''}
                            onChange={(e) => updateItemField(idx, 'hsn_code', e.target.value)}
                            placeholder="HSN"
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.unit || 'PCS'}
                            onChange={(e) => updateItemField(idx, 'unit', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_cost}
                            onChange={(e) => updateItemField(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount_percent || 0}
                            onChange={(e) =>
                              updateItemField(idx, 'discount_percent', parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.tax_rate}
                            onChange={(e) => updateItemField(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-mono text-slate-300">
                          ₹{taxable.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-400">
                          ₹{lineTot.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
                            className="text-slate-500 hover:text-rose-400 disabled:opacity-30 transition p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Stock automatically increases in your inventory catalog upon saving this inward bill.
              </span>
            </div>
          </div>

          {/* Payment & Totals Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Payment & Notes */}
            <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                Supplier Payment Settlement
              </h4>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFullPaid}
                    onChange={(e) => handleFullPaidToggle(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0 w-4 h-4"
                  />
                  <span className="text-slate-300 font-semibold">Mark Full Bill as Paid Now</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="any"
                    value={paidAmount}
                    onChange={(e) => {
                      setPaidAmount(e.target.value);
                      setIsFullPaid(Number(e.target.value) >= grandTotal && grandTotal > 0);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BANK_TRANSFER">Bank NEFT/RTGS/IMPS</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Vendor Notes / Remarks</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Received in good condition at warehouse gate 2..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            {/* Bill Summary Calculations */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2.5 font-mono">
              <h4 className="font-bold text-slate-200 font-sans flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-emerald-400" />
                Purchase Calculation Breakdown
              </h4>

              <div className="flex justify-between text-slate-400">
                <span>Gross Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Supplier Discount:</span>
                  <span>-₹{discountTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-300 font-semibold pt-1 border-t border-slate-800">
                <span>Taxable Inward Value:</span>
                <span>₹{(subtotal - discountTotal).toFixed(2)}</span>
              </div>

              {isInterState ? (
                <div className="flex justify-between text-amber-400 text-[11px]">
                  <span>Integrated Tax (IGST - ITC):</span>
                  <span>+₹{igstTotal.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-emerald-400 text-[11px]">
                    <span>Central GST (CGST - ITC):</span>
                    <span>+₹{cgstTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 text-[11px]">
                    <span>State GST (SGST - ITC):</span>
                    <span>+₹{sgstTotal.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Round-off:</span>
                <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
              </div>

              <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-slate-700">
                <span>Grand Total (Bill Value):</span>
                <span className="text-emerald-400">₹{grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-300 pt-1 text-[11px]">
                <span>Paid Now:</span>
                <span className="text-indigo-400">₹{Number(paidAmount).toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-amber-400 font-bold pt-1 text-[11px] border-t border-slate-800/80">
                <span>Balance Payable to Supplier:</span>
                <span>₹{Math.max(0, grandTotal - Number(paidAmount)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 text-xs"
            >
              {submitting ? 'Recording Bill & Updating Stock...' : 'Save Purchase Bill'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
