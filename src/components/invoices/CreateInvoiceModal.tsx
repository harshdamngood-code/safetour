import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { InvoiceRecord, InvoiceType, PaymentMethod } from '../../types/invoices.types';
import { numberToIndianWords, formatIndianCurrency } from '../../lib/numberToWords';
import {
  InvoiceProgressOverlay,
  AnimatedButton,
  TiltCard,
  useToast,
} from '../ui/3d-system';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Calculator,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Building2,
  Percent,
  Search,
  Sparkles,
} from 'lucide-react';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated: (invoice: InvoiceRecord) => void;
  initialType?: InvoiceType;
}

interface LineItemState {
  id: string;
  product_id?: string;
  item_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  available_stock?: number;
}

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = ['PCS', 'BOX', 'BAG', 'CAN', 'KG', 'MTR', 'PKT', 'LTR', 'NOS', 'SET'];

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onInvoiceCreated,
  initialType = 'TAX_INVOICE',
}) => {
  const { activeBusiness } = useAuth();
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initialType);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  
  // Customer
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [isInterState, setIsInterState] = useState(false);

  // Products catalog for fast selection
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  
  // Line Items
  const [items, setItems] = useState<LineItemState[]>([
    {
      id: '1',
      item_name: '',
      hsn_code: '',
      quantity: 1,
      unit: 'PCS',
      unit_price: 0,
      discount_percent: 0,
      discount_amount: 0,
      tax_rate: 18,
      taxable_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
    },
  ]);

  // Overall calculations
  const [discountTotal, setDiscountTotal] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [termsConditions, setTermsConditions] = useState(
    (activeBusiness as any)?.terms_and_conditions || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.'
  );
  const [notes, setNotes] = useState('');

  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load next invoice number, customers & products
  useEffect(() => {
    if (!isOpen || !activeBusiness) return;

    // Reset fields
    setInvoiceType(initialType);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setTermsConditions((activeBusiness as any)?.terms_and_conditions || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.');
    setPlaceOfSupply(activeBusiness.state || 'Maharashtra');

    const fetchInitialData = async () => {
      try {
        // 1. Next Invoice Number
        const numData = await api.get(`/invoices/next-number?type=${initialType}`);
        if (numData.success && numData.data?.suggested_invoice_number) {
          setInvoiceNumber(numData.data.suggested_invoice_number);
        }

        // 2. Customers
        const custData = (await api.get('/parties/customers')) as any;
        if (custData.success) {
          setCustomers(custData.data?.customers || custData.customers || custData.data || []);
        }

        // 3. Products
        const prodData = (await api.get('/inventory/products')) as any;
        if (prodData.success) {
          setCatalogProducts(prodData.data?.products || prodData.products || []);
        }
      } catch (err) {
        console.error('Failed to load invoice form metadata', err);
      }
    };

    fetchInitialData();
  }, [isOpen, activeBusiness, initialType]);

  // Determine Inter-state vs Intra-state tax split
  useEffect(() => {
    if (!activeBusiness) return;
    const bizState = (activeBusiness.state || '').trim().toLowerCase();
    const posState = (placeOfSupply || customerState || activeBusiness.state || '').trim().toLowerCase();
    const interState = bizState !== '' && posState !== '' && bizState !== posState;
    setIsInterState(interState);
  }, [activeBusiness, placeOfSupply, customerState]);

  // Handle Customer Selection
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerState(activeBusiness?.state || '');
      setPlaceOfSupply(activeBusiness?.state || '');
      setCustomerAddress('');
      return;
    }

    const found = customers.find((c) => c.id === customerId);
    if (found) {
      setCustomerName(found.name || '');
      setCustomerPhone(found.phone || '');
      setCustomerGstin(found.gstin || '');
      const cState = found.state || activeBusiness?.state || '';
      setCustomerState(cState);
      setPlaceOfSupply(cState);
      setCustomerAddress(found.billing_address || found.city || '');
    }
  };

  // Recalculate a single line item
  const calculateLineItem = (
    item: Partial<LineItemState>,
    interStateFlag: boolean
  ): LineItemState => {
    const qty = Math.max(0, Number(item.quantity ?? 1));
    const price = Math.max(0, Number(item.unit_price ?? 0));
    const discPct = Math.max(0, Number(item.discount_percent ?? 0));
    const taxPct = Number(item.tax_rate ?? 0);

    const grossAmount = qty * price;
    const discAmount = (grossAmount * discPct) / 100;
    const taxableAmount = Math.max(0, grossAmount - discAmount);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (interStateFlag) {
      igst = (taxableAmount * taxPct) / 100;
    } else {
      cgst = (taxableAmount * (taxPct / 2)) / 100;
      sgst = (taxableAmount * (taxPct / 2)) / 100;
    }

    const totalAmount = taxableAmount + cgst + sgst + igst;

    return {
      id: item.id || String(Date.now()),
      product_id: item.product_id,
      item_name: item.item_name || '',
      hsn_code: item.hsn_code || '',
      quantity: qty,
      unit: item.unit || 'PCS',
      unit_price: price,
      discount_percent: discPct,
      discount_amount: discAmount,
      tax_rate: taxPct,
      taxable_amount: Math.round(taxableAmount * 100) / 100,
      cgst_amount: Math.round(cgst * 100) / 100,
      sgst_amount: Math.round(sgst * 100) / 100,
      igst_amount: Math.round(igst * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100,
      available_stock: item.available_stock,
    };
  };

  // Update line item in list
  const updateItem = (index: number, patch: Partial<LineItemState>) => {
    setItems((prev) => {
      const updated = [...prev];
      const merged = { ...updated[index], ...patch };
      updated[index] = calculateLineItem(merged, isInterState);
      return updated;
    });
  };

  // When place of supply changes, recalculate all line items
  useEffect(() => {
    setItems((prev) => prev.map((it) => calculateLineItem(it, isInterState)));
  }, [isInterState]);

  // Handle picking a product from catalog
  const handleSelectProduct = (index: number, productId: string) => {
    if (!productId) {
      updateItem(index, { product_id: undefined });
      return;
    }

    const prod = catalogProducts.find((p) => p.id === productId);
    if (prod) {
      updateItem(index, {
        product_id: prod.id,
        item_name: prod.name,
        hsn_code: prod.hsn_code || '',
        unit: prod.unit || 'PCS',
        unit_price: Number(prod.selling_price || 0),
        tax_rate: Number(prod.tax_rate ?? 18),
        available_stock: Number(prod.current_stock ?? 0),
      });
    }
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      calculateLineItem(
        {
          id: String(Date.now()),
          item_name: '',
          hsn_code: '',
          quantity: 1,
          unit: 'PCS',
          unit_price: 0,
          discount_percent: 0,
          tax_rate: 18,
        },
        isInterState
      ),
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Compute Grand Totals
  const subtotal = items.reduce((acc, it) => acc + (it.taxable_amount || 0), 0);
  const cgstTotal = items.reduce((acc, it) => acc + (it.cgst_amount || 0), 0);
  const sgstTotal = items.reduce((acc, it) => acc + (it.sgst_amount || 0), 0);
  const igstTotal = items.reduce((acc, it) => acc + (it.igst_amount || 0), 0);
  const taxTotal = cgstTotal + sgstTotal + igstTotal;

  const rawGrandTotal = subtotal + taxTotal - (discountTotal || 0);
  const grandTotal = Math.max(0, Math.round((rawGrandTotal + Number(roundOff || 0)) * 100) / 100);
  const balanceDue = invoiceType === 'QUOTATION' ? 0 : Math.max(0, grandTotal - paidAmount);

  // Auto-fill paid in full
  const handlePayInFull = () => {
    setPaidAmount(grandTotal);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Please provide a customer name or select a customer.');
      return;
    }

    const invalidItems = items.filter((it) => !it.item_name.trim() || it.quantity <= 0);
    if (invalidItems.length > 0) {
      setError('Please enter valid product names and positive quantities for all line items.');
      return;
    }

    setLoading(true);
    setStageIndex(0);

    const stageTimer1 = setTimeout(() => setStageIndex(1), 160);
    const stageTimer2 = setTimeout(() => setStageIndex(2), 340);
    const stageTimer3 = setTimeout(() => setStageIndex(3), 520);

    try {
      const payload = {
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        customer_gstin: customerGstin.trim() || undefined,
        customer_state: customerState.trim() || undefined,
        invoice_type: invoiceType,
        invoice_number: invoiceNumber.trim() || undefined,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        place_of_supply: placeOfSupply || undefined,
        billing_address: customerAddress || undefined,
        shipping_address: customerAddress || undefined,
        po_number: poNumber || undefined,
        vehicle_number: vehicleNumber || undefined,
        terms_conditions: termsConditions || undefined,
        items: items.map((it) => ({
          product_id: it.product_id,
          item_name: it.item_name,
          hsn_code: it.hsn_code,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          discount_percent: it.discount_percent,
          discount_amount: it.discount_amount,
          tax_rate: it.tax_rate,
          taxable_amount: it.taxable_amount,
          cgst_amount: it.cgst_amount,
          sgst_amount: it.sgst_amount,
          igst_amount: it.igst_amount,
          total_amount: it.total_amount,
        })),
        subtotal,
        tax_total: taxTotal,
        cgst_total: cgstTotal,
        sgst_total: sgstTotal,
        igst_total: igstTotal,
        discount_total: discountTotal,
        round_off: roundOff,
        grand_total: grandTotal,
        paid_amount: invoiceType === 'QUOTATION' ? 0 : paidAmount,
        payment_method: paidAmount > 0 ? paymentMethod : undefined,
        payment_reference: paymentReference || undefined,
        notes: notes || undefined,
      };

      const data = await api.post('/invoices', payload);
      if (!data.success) {
        throw new Error(data.message || 'Failed to create invoice');
      }

      setStageIndex(4);
      await new Promise((r) => setTimeout(r, 220));
      setStageIndex(5);
      showToast(
        'success',
        `${data.data.invoice_number} Generated`,
        `Grand Total ₹${grandTotal.toLocaleString('en-IN')} synced with ledger.`
      );
      onInvoiceCreated(data.data);
      onClose();
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      setError(err.message || 'Error occurred while saving invoice');
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-page-enter">
      <InvoiceProgressOverlay active={loading} currentStageIndex={stageIndex} />
      <div className="glass-panel border border-indigo-500/25 rounded-3xl w-full max-w-5xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Create New Bill / Invoice</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  {activeBusiness?.business_name}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                GST Compliant Tax Invoicing • Auto Stock Ledger &amp; Khata Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Invoice Type Switcher */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInvoiceType('TAX_INVOICE')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  invoiceType === 'TAX_INVOICE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                GST Tax Invoice
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('BILL_OF_SUPPLY')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  invoiceType === 'BILL_OF_SUPPLY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bill of Supply
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('QUOTATION')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  invoiceType === 'QUOTATION'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quotation / Estimate
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer & Invoice Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            {/* Customer Picker */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Select Customer (or Walk-In)
                </label>
                <span className="text-[11px] text-slate-500">Auto-populates GSTIN &amp; State</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Cash / Walk-in Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.current_balance > 0 ? `• Due: ₹${c.current_balance}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    required
                    placeholder="Customer / Company Name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Mobile Number (e.g. +91 9876543210)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Customer GSTIN (15 Digits)"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Place of Supply / State"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="space-y-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Invoice Number</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Tax Type Badge */}
              <div className="text-[11px] p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">GST Tax Regime:</span>
                <span className={`font-bold font-mono ${isInterState ? 'text-purple-400' : 'text-emerald-400'}`}>
                  {isInterState ? 'Inter-State (IGST 100%)' : 'Intra-State (CGST + SGST 50/50)'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>Items &amp; Services</span>
                <span className="text-indigo-400 font-mono">({items.length} items)</span>
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Line
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold">
                    <th className="p-2.5 w-8 text-center">#</th>
                    <th className="p-2.5 min-w-[220px]">Item Description / Catalog</th>
                    <th className="p-2.5 w-24">HSN/SAC</th>
                    <th className="p-2.5 w-20">Qty</th>
                    <th className="p-2.5 w-20">Unit</th>
                    <th className="p-2.5 w-28">Rate (₹)</th>
                    <th className="p-2.5 w-20">Disc %</th>
                    <th className="p-2.5 w-24">GST Rate</th>
                    <th className="p-2.5 w-28 text-right">Taxable (₹)</th>
                    <th className="p-2.5 w-28 text-right">Total (₹)</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition">
                      <td className="p-2 text-center text-slate-500 font-mono">{index + 1}</td>
                      
                      {/* Item description + Catalog picker */}
                      <td className="p-2">
                        <div className="space-y-1">
                          <input
                            type="text"
                            required
                            placeholder="Type product name or select..."
                            value={item.item_name}
                            onChange={(e) => updateItem(index, { item_name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          {catalogProducts.length > 0 && (
                            <select
                              value={item.product_id || ''}
                              onChange={(e) => handleSelectProduct(index, e.target.value)}
                              className="w-full bg-slate-950 text-[11px] text-slate-400 border border-slate-800 rounded px-1.5 py-0.5"
                            >
                              <option value="">⚡ Pick from Inventory Catalog</option>
                              {catalogProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (₹{p.selling_price}) • Stock: {p.current_stock}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* HSN Code */}
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="HSN"
                          value={item.hsn_code}
                          onChange={(e) => updateItem(index, { hsn_code: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Unit */}
                      <td className="p-2">
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(index, { unit: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-white"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>

                      {/* Unit Price */}
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={item.unit_price || ''}
                          onChange={(e) => updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Discount % */}
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={item.discount_percent || ''}
                          onChange={(e) => updateItem(index, { discount_percent: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Tax Rate */}
                      <td className="p-2">
                        <select
                          value={item.tax_rate}
                          onChange={(e) => updateItem(index, { tax_rate: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-white font-mono"
                        >
                          {GST_RATES.map((r) => (
                            <option key={r} value={r}>{r}% GST</option>
                          ))}
                        </select>
                      </td>

                      {/* Taxable Amount */}
                      <td className="p-2 text-right font-mono text-slate-300">
                        ₹{item.taxable_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Total Amount */}
                      <td className="p-2 text-right font-mono font-bold text-emerald-400">
                        ₹{item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Delete */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length <= 1}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Summary Breakdown & Payment Settlement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Left: Notes, Transport & Terms */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">PO / Ref Number</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-9874"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vehicle / Transport No.</label>
                  <input
                    type="text"
                    placeholder="e.g. MH-01-AB-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Thank you for your business! Delivered via Express cargo."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Terms &amp; Conditions</label>
                <textarea
                  rows={2}
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Right: Bill Calculation & Settlement Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Taxable Amount (Subtotal)</span>
                <span className="font-mono text-white">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {isInterState ? (
                <div className="flex justify-between text-xs text-purple-300">
                  <span>Integrated GST (IGST)</span>
                  <span className="font-mono font-semibold">₹{igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Central GST (CGST)</span>
                    <span className="font-mono text-emerald-400">₹{cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>State GST (SGST)</span>
                    <span className="font-mono text-emerald-400">₹{sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                <div>
                  <label className="block text-[10px] text-slate-400">Extra Bill Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountTotal || ''}
                    onChange={(e) => setDiscountTotal(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Round-off Adjustment (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={roundOff || ''}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Grand Total Bar */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-indigo-300">Grand Total</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 italic max-w-xs">
                    {numberToIndianWords(grandTotal)}
                  </div>
                </div>
                <div className="text-xl font-extrabold text-white font-mono">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Payment Collection if not quotation */}
              {invoiceType !== 'QUOTATION' && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Payment Received Upfront</label>
                    <button
                      type="button"
                      onClick={handlePayInFull}
                      className="text-[11px] font-bold text-emerald-400 hover:underline"
                    >
                      ⚡ Paid in Full
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      step="any"
                      placeholder="Amount Paid (₹)"
                      value={paidAmount || ''}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                    />

                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="CASH">Cash in Hand</option>
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CARD">Debit / Credit Card</option>
                    </select>
                  </div>

                  {balanceDue > 0 && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex justify-between">
                      <span>Remaining Balance Due (Udhar):</span>
                      <span className="font-bold font-mono">₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Live 3D Floating Document Preview */}
          <TiltCard glowColor="indigo" maxTilt={4} className="p-4 border border-indigo-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>3D Live Document Preview</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-indigo-300">{invoiceNumber || 'DRAFT'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Buyer: <strong className="text-slate-200">{customerName || 'Walk-in Customer'}</strong> ·{' '}
                    {items.filter((i) => i.item_name.trim()).length || items.length} line item(s) ·{' '}
                    {isInterState ? 'IGST Regime' : 'CGST + SGST Regime'}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] text-slate-400">Payable Document Total</div>
                <div className="text-base font-extrabold text-emerald-400">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </TiltCard>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>

            <AnimatedButton
              type="submit"
              loading={loading}
              loadingText="Issuing GST Document..."
              variant="primary"
              size="lg"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {invoiceType === 'QUOTATION'
                ? 'Generate Quotation / Estimate'
                : `Save & Issue ${
                    invoiceType === 'BILL_OF_SUPPLY' ? 'Bill of Supply' : 'GST Tax Invoice'
                  }`}
            </AnimatedButton>
          </div>
        </form>
      </div>
    </div>
  );
};
