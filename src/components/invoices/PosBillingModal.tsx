import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { InvoiceRecord } from '../../types/invoices.types';
import {
  X,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Zap,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface PosBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated: (invoice: InvoiceRecord) => void;
}

interface CartItem {
  product_id: string;
  item_name: string;
  sku: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  current_stock: number;
}

export const PosBillingModal: React.FC<PosBillingModalProps> = ({
  isOpen,
  onClose,
  onInvoiceCreated,
}) => {
  const { activeBusiness } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !activeBusiness) return;
    setCart([]);
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCashTendered(0);
    setError(null);

    const loadCatalog = async () => {
      try {
        const data = (await api.get('/inventory/products')) as any;
        if (data.success) {
          setProducts(data.data?.products || data.products || []);
        }
      } catch (err) {
        console.error('Failed to load POS catalog', err);
      }
    };

    loadCatalog();
  }, [isOpen, activeBusiness]);

  if (!isOpen) return null;

  // Categories
  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category || 'General')))];

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'ALL' || (p.category || 'General') === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Add product to cart
  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      const price = Number(product.selling_price || 0);
      const taxRate = Number(product.tax_rate ?? 18);

      if (existing) {
        const newQty = existing.quantity + 1;
        const gross = newQty * price;
        const taxable = gross;
        const cgst = (taxable * (taxRate / 2)) / 100;
        const sgst = (taxable * (taxRate / 2)) / 100;
        const total = taxable + cgst + sgst;

        return prev.map((it) =>
          it.product_id === product.id
            ? {
                ...it,
                quantity: newQty,
                taxable_amount: Math.round(taxable * 100) / 100,
                cgst_amount: Math.round(cgst * 100) / 100,
                sgst_amount: Math.round(sgst * 100) / 100,
                total_amount: Math.round(total * 100) / 100,
              }
            : it
        );
      } else {
        const qty = 1;
        const gross = qty * price;
        const taxable = gross;
        const cgst = (taxable * (taxRate / 2)) / 100;
        const sgst = (taxable * (taxRate / 2)) / 100;
        const total = taxable + cgst + sgst;

        return [
          ...prev,
          {
            product_id: product.id,
            item_name: product.name,
            sku: product.sku || '',
            hsn_code: product.hsn_code || '',
            quantity: qty,
            unit: product.unit || 'PCS',
            unit_price: price,
            tax_rate: taxRate,
            taxable_amount: Math.round(taxable * 100) / 100,
            cgst_amount: Math.round(cgst * 100) / 100,
            sgst_amount: Math.round(sgst * 100) / 100,
            igst_amount: 0,
            total_amount: Math.round(total * 100) / 100,
            current_stock: Number(product.current_stock || 0),
          },
        ];
      }
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product_id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;

          const gross = newQty * item.unit_price;
          const taxable = gross;
          const cgst = (taxable * (item.tax_rate / 2)) / 100;
          const sgst = (taxable * (item.tax_rate / 2)) / 100;
          const total = taxable + cgst + sgst;

          return {
            ...item,
            quantity: newQty,
            taxable_amount: Math.round(taxable * 100) / 100,
            cgst_amount: Math.round(cgst * 100) / 100,
            sgst_amount: Math.round(sgst * 100) / 100,
            total_amount: Math.round(total * 100) / 100,
          };
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.product_id !== productId));
  };

  // Computations
  const subtotal = cart.reduce((acc, it) => acc + it.taxable_amount, 0);
  const cgstTotal = cart.reduce((acc, it) => acc + it.cgst_amount, 0);
  const sgstTotal = cart.reduce((acc, it) => acc + it.sgst_amount, 0);
  const grandTotal = Math.round((subtotal + cgstTotal + sgstTotal) * 100) / 100;
  const changeDue = Math.max(0, cashTendered - grandTotal);

  // Quick Checkout
  const handleQuickCheckout = async () => {
    if (cart.length === 0) {
      setError('Your billing cart is empty. Click items on the left to add.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim() || undefined,
        customer_state: activeBusiness?.state,
        invoice_type: 'TAX_INVOICE',
        invoice_date: new Date().toISOString().split('T')[0],
        place_of_supply: activeBusiness?.state,
        items: cart.map((it) => ({
          product_id: it.product_id,
          item_name: it.item_name,
          hsn_code: it.hsn_code,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          tax_rate: it.tax_rate,
          taxable_amount: it.taxable_amount,
          cgst_amount: it.cgst_amount,
          sgst_amount: it.sgst_amount,
          igst_amount: 0,
          total_amount: it.total_amount,
        })),
        subtotal,
        tax_total: cgstTotal + sgstTotal,
        cgst_total: cgstTotal,
        sgst_total: sgstTotal,
        igst_total: 0,
        discount_total: 0,
        round_off: 0,
        grand_total: grandTotal,
        paid_amount: grandTotal, // POS is fully paid at counter
        payment_method: paymentMode,
        notes: 'Quick POS Counter Sale',
      };

      const data = await api.post('/invoices', payload);
      if (!data.success) {
        throw new Error(data.message || 'Failed to complete POS sale');
      }

      onInvoiceCreated(data.data);
      onClose();
    } catch (err: any) {
      console.error('POS Checkout error:', err);
      setError(err.message || 'Failed to complete checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">POS Quick Billing Counter</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                  Instant Stock Deduction
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Rapid retail barcode &amp; product checkout</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* POS Grid: Left Items Picker, Right Cart Summary */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          
          {/* Left: Product Catalog (7 Cols) */}
          <div className="md:col-span-7 flex flex-col border-r border-slate-800 bg-slate-950/40 overflow-hidden">
            {/* Search & Category Filter */}
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search item name, SKU, or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 p-3 rounded-xl text-left transition flex flex-col justify-between group active:scale-95"
                >
                  <div>
                    <div className="text-xs font-bold text-white line-clamp-2 group-hover:text-indigo-300">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.sku || p.hsn_code}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-400 font-mono">
                      ₹{p.selling_price}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      p.current_stock <= (p.min_stock_alert || 5)
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {p.current_stock} {p.unit || 'PCS'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Cart & Quick Settlement (5 Cols) */}
          <div className="md:col-span-5 flex flex-col bg-slate-900 overflow-hidden">
            {/* Customer Quick Header */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/60 grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Mobile (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6">
                  <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-slate-600" />
                  <p>Cart is empty</p>
                  <p className="text-[11px] text-slate-600 mt-1">Tap items on the left to add to bill</p>
                </div>
              ) : (
                cart.map((it) => (
                  <div key={it.product_id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{it.item_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ₹{it.unit_price} x {it.quantity} = <span className="text-emerald-400 font-bold">₹{it.total_amount}</span>
                      </div>
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                      <button
                        onClick={() => updateCartQty(it.product_id, -1)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-mono font-bold text-white">{it.quantity}</span>
                      <button
                        onClick={() => updateCartQty(it.product_id, 1)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeCartItem(it.product_id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Checkout Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
              {error && (
                <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Total Summary */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Subtotal: ₹{subtotal.toFixed(2)}</span>
                <span>GST: ₹{(cgstTotal + sgstTotal).toFixed(2)}</span>
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Total Bill</span>
                <span className="text-xl font-extrabold text-white font-mono">₹{grandTotal.toFixed(2)}</span>
              </div>

              {/* Payment Mode */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 ${
                    paymentMode === 'CASH'
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 ${
                    paymentMode === 'UPI'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('CARD')}
                  className={`py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 ${
                    paymentMode === 'CARD'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Card
                </button>
              </div>

              {/* Cash Tendered & Change Calculation */}
              {paymentMode === 'CASH' && (
                <div className="grid grid-cols-2 gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Cash Tendered (₹)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`e.g. ₹${grandTotal}`}
                      value={cashTendered || ''}
                      onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Change to Return</span>
                    <span className="font-mono font-bold text-amber-400 block py-1">
                      ₹{changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Fast Checkout Button */}
              <button
                onClick={handleQuickCheckout}
                disabled={loading || cart.length === 0}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-40"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>1-Click Finalize &amp; Print Bill (₹{grandTotal.toFixed(2)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
