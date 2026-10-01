import React, { useState, useRef } from 'react';
import { InvoiceRecord, InvoiceItem } from '../../types/invoices.types';
import { numberToIndianWords, formatIndianCurrency } from '../../lib/numberToWords';
import {
  X,
  Printer,
  Share2,
  Download,
  CreditCard,
  Building2,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  FileCheck,
  QrCode,
  Smartphone,
} from 'lucide-react';

interface InvoiceDetailModalProps {
  invoice: InvoiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRecordPayment?: (invoice: InvoiceRecord) => void;
  onConvertQuotation?: (invoiceId: string) => void;
  onInvoiceUpdated?: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onOpenRecordPayment,
  onConvertQuotation,
  onInvoiceUpdated,
}) => {
  const [printLayout, setPrintLayout] = useState<'A4' | 'THERMAL'>('A4');
  const [activeTab, setActiveTab] = useState<'INVOICE' | 'PAYMENTS'>('INVOICE');
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const business = invoice.business || {};
  const items: InvoiceItem[] = invoice.items || [];
  const payments = invoice.payments || [];

  const isQuotation = invoice.invoice_type === 'QUOTATION';
  const isPaid = invoice.payment_status === 'PAID';
  const isPartial = invoice.payment_status === 'PARTIAL';
  const isUnpaid = invoice.payment_status === 'UNPAID';

  // Generate UPI QR Code URL
  // Format: upi://pay?pa=merchant@upi&pn=BusinessName&am=Amount&cu=INR&tn=InvoiceNo
  const upiId = (business.phone || '').replace(/\D/g, '') + '@upi';
  const upiPayLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(business.business_name || 'Business')}&am=${invoice.balance_due || invoice.grand_total}&cu=INR&tn=${encodeURIComponent(invoice.invoice_number)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiPayLink)}`;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp Share Handler
  const handleWhatsAppShare = () => {
    const text = `*Tax Invoice: ${invoice.invoice_number}*\n` +
      `From: *${business.business_name || 'BillFlow Merchant'}*\n` +
      `Date: ${invoice.invoice_date}\n` +
      `Customer: ${invoice.customer_name}\n` +
      `Total Amount: ₹${invoice.grand_total.toLocaleString('en-IN')}\n` +
      `Paid: ₹${invoice.paid_amount.toLocaleString('en-IN')}\n` +
      `*Balance Due: ₹${invoice.balance_due.toLocaleString('en-IN')}*\n\n` +
      `Pay via UPI: ${upiId}\n` +
      `Thank you for your business!`;

    const cleanPhone = (invoice.customer_phone || '').replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10 ? cleanPhone : '';
    window.open(`https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Group items by HSN for GST Tax summary table
  const hsnSummaryMap = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number; rate: number }>();
  items.forEach((item) => {
    const hsn = item.hsn_code || 'N/A';
    const existing = hsnSummaryMap.get(hsn) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: item.tax_rate };
    existing.taxable += item.taxable_amount || 0;
    existing.cgst += item.cgst_amount || 0;
    existing.sgst += item.sgst_amount || 0;
    existing.igst += item.igst_amount || 0;
    hsnSummaryMap.set(hsn, existing);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:fixed-none animate-page-enter">
      <div className="glass-panel border border-indigo-500/25 rounded-3xl w-full max-w-4xl my-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:w-full print:border-none print:shadow-none print:m-0">
        
        {/* Top Header & Quick Action Toolbar (Hidden during browser printing) */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <span>{invoice.invoice_number}</span>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                isPaid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                isPartial ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                isQuotation ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {invoice.payment_status}
              </span>
            </span>

            {/* Layout switch */}
            <div className="hidden sm:flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setPrintLayout('A4')}
                className={`px-2.5 py-1 rounded font-medium ${printLayout === 'A4' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Standard A4
              </button>
              <button
                onClick={() => setPrintLayout('THERMAL')}
                className={`px-2.5 py-1 rounded font-medium ${printLayout === 'THERMAL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Thermal POS
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Record Payment Button */}
            {!isQuotation && invoice.balance_due > 0 && onOpenRecordPayment && (
              <button
                onClick={() => onOpenRecordPayment(invoice)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Collect ₹{invoice.balance_due.toLocaleString('en-IN')}
              </button>
            )}

            {/* Convert Quote Button */}
            {isQuotation && onConvertQuotation && (
              <button
                onClick={() => onConvertQuotation(invoice.id)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Convert to Tax Invoice
              </button>
            )}

            {/* WhatsApp Share */}
            <button
              onClick={handleWhatsAppShare}
              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Smartphone className="w-3.5 h-3.5" />
              WhatsApp
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Invoice Content */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-slate-950/50 print:p-0 print:bg-white print:overflow-visible">
          
          {printLayout === 'A4' ? (
            /* ============================================================ */
            /* STANDARD A4 INDIAN GST TAX INVOICE FORMAT                    */
            /* ============================================================ */
            <div
              ref={printRef}
              className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 max-w-3xl mx-auto shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 font-sans text-xs leading-relaxed"
            >
              {/* Header Title Badge */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  {isQuotation ? 'ESTIMATE / PROFORMA' : 'GST Compliant Invoice'}
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {isQuotation
                    ? 'QUOTATION / ESTIMATE'
                    : invoice.invoice_type === 'BILL_OF_SUPPLY'
                    ? 'BILL OF SUPPLY'
                    : 'TAX INVOICE'}
                </h1>
                <div className="text-[10px] font-semibold text-slate-600 mt-0.5">
                  (Original for Recipient • Duplicate for Transporter)
                </div>
              </div>

              {/* Business Details & Invoice Metadata Top Grid */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                
                {/* Left: Supplier / Issuer Profile */}
                <div>
                  <div className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                    {business.legal_name || business.business_name || 'Om Sai Traders'}
                  </div>
                  {business.legal_name && business.business_name !== business.legal_name && (
                    <div className="text-[11px] font-medium text-slate-600">
                      Trade Name: {business.business_name}
                    </div>
                  )}
                  <div className="text-slate-600 mt-1">
                    {business.address_line1}, {business.city}, {business.state} - {business.pincode}
                  </div>
                  <div className="text-slate-600">
                    Phone: <span className="font-semibold text-slate-900">{business.phone}</span> • Email: {business.email}
                  </div>
                  <div className="mt-2 text-[11px] font-mono font-bold text-slate-900 bg-slate-100 p-1.5 rounded inline-block">
                    GSTIN: <span className="text-indigo-700">{business.gstin || '27AABCU9603R1ZM'}</span> • PAN: {business.pan || 'AABCU9603R'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    State: {business.state} (State Code: {business.state_code || '27'})
                  </div>
                </div>

                {/* Right: Invoice # & Dates */}
                <div className="text-right space-y-1">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 inline-block text-left min-w-[200px]">
                    <div className="flex justify-between gap-4 py-0.5">
                      <span className="text-slate-500 font-medium">Invoice No:</span>
                      <span className="font-mono font-extrabold text-slate-900">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-0.5">
                      <span className="text-slate-500 font-medium">Invoice Date:</span>
                      <span className="font-semibold text-slate-900">{invoice.invoice_date}</span>
                    </div>
                    {invoice.due_date && (
                      <div className="flex justify-between gap-4 py-0.5">
                        <span className="text-slate-500 font-medium">Due Date:</span>
                        <span className="font-semibold text-slate-900">{invoice.due_date}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 py-0.5 border-t border-slate-200 mt-1 pt-1">
                      <span className="text-slate-500 font-medium">Place of Supply:</span>
                      <span className="font-semibold text-slate-900">{invoice.place_of_supply || business.state || 'Maharashtra'}</span>
                    </div>
                    {invoice.po_number && (
                      <div className="flex justify-between gap-4 py-0.5">
                        <span className="text-slate-500 font-medium">PO Ref:</span>
                        <span className="font-semibold text-slate-900">{invoice.po_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billed To / Shipped To Details */}
              <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-200 bg-slate-50/50 px-2 rounded-lg my-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Billed To (Customer):</div>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{invoice.customer_name}</div>
                  {invoice.customer_phone && <div className="text-slate-600">Phone: {invoice.customer_phone}</div>}
                  {invoice.billing_address && <div className="text-slate-600">{invoice.billing_address}</div>}
                  {invoice.customer_gstin ? (
                    <div className="text-slate-900 font-mono font-semibold text-[11px] mt-0.5">
                      GSTIN: <span className="text-indigo-700">{invoice.customer_gstin}</span>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic text-[10px]">Unregistered / Retail Consumer</div>
                  )}
                  {invoice.customer_state && (
                    <div className="text-[10px] text-slate-500">State: {invoice.customer_state}</div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Status:</div>
                  <div className="font-bold text-xs mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isPaid ? 'bg-emerald-100 text-emerald-800' :
                      isPartial ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {invoice.payment_status}
                    </span>
                  </div>
                  {invoice.payment_method && (
                    <div className="text-slate-600 mt-1">Payment Mode: <span className="font-semibold text-slate-900">{invoice.payment_method}</span></div>
                  )}
                  {invoice.vehicle_number && (
                    <div className="text-slate-600">Vehicle No: <span className="font-mono font-semibold text-slate-900">{invoice.vehicle_number}</span></div>
                  )}
                </div>
              </div>

              {/* Itemized Table */}
              <div className="my-4 overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                      <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                      <th className="p-2 border-r border-slate-300">Description of Goods / Services</th>
                      <th className="p-2 border-r border-slate-300 w-16 text-center">HSN/SAC</th>
                      <th className="p-2 border-r border-slate-300 w-14 text-right">Qty</th>
                      <th className="p-2 border-r border-slate-300 w-12 text-center">Unit</th>
                      <th className="p-2 border-r border-slate-300 w-20 text-right">Rate (₹)</th>
                      <th className="p-2 border-r border-slate-300 w-14 text-right">Disc %</th>
                      <th className="p-2 border-r border-slate-300 w-20 text-right">Taxable (₹)</th>
                      <th className="p-2 border-r border-slate-300 w-14 text-center">GST %</th>
                      <th className="p-2 text-right w-24">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border-r border-slate-300 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-medium text-slate-900">{item.item_name}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono text-slate-600">{item.hsn_code || '-'}</td>
                        <td className="p-2 border-r border-slate-300 text-right font-bold font-mono">{item.quantity}</td>
                        <td className="p-2 border-r border-slate-300 text-center text-slate-600">{item.unit}</td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono">{item.unit_price.toFixed(2)}</td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono text-slate-600">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono font-semibold">{item.taxable_amount.toFixed(2)}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono">{item.tax_rate}%</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{item.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* HSN Tax Summary Table & Calculation Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                
                {/* HSN Summary */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    GST Tax Breakdown (by HSN/SAC)
                  </div>
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-600 font-semibold">
                        <th className="py-1">HSN</th>
                        <th className="py-1 text-right">Taxable</th>
                        {invoice.igst_total > 0 ? (
                          <th className="py-1 text-right">IGST</th>
                        ) : (
                          <>
                            <th className="py-1 text-right">CGST</th>
                            <th className="py-1 text-right">SGST</th>
                          </>
                        )}
                        <th className="py-1 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.from(hsnSummaryMap.entries()).map(([hsn, val], i) => (
                        <tr key={i} className="font-mono">
                          <td className="py-1 font-semibold">{hsn}</td>
                          <td className="py-1 text-right">₹{val.taxable.toFixed(2)}</td>
                          {invoice.igst_total > 0 ? (
                            <td className="py-1 text-right">₹{val.igst.toFixed(2)}</td>
                          ) : (
                            <>
                              <td className="py-1 text-right">₹{val.cgst.toFixed(2)}</td>
                              <td className="py-1 text-right">₹{val.sgst.toFixed(2)}</td>
                            </>
                          )}
                          <td className="py-1 text-right font-bold">₹{(val.cgst + val.sgst + val.igst).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Overall Calculation Summary */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-semibold text-slate-900">₹{invoice.subtotal.toFixed(2)}</span>
                  </div>

                  {invoice.igst_total > 0 ? (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST:</span>
                      <span className="font-mono font-semibold text-slate-900">₹{invoice.igst_total.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST:</span>
                        <span className="font-mono font-semibold text-slate-900">₹{invoice.cgst_total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST:</span>
                        <span className="font-mono font-semibold text-slate-900">₹{invoice.sgst_total.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {invoice.discount_total > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Invoice Discount:</span>
                      <span className="font-mono">-₹{invoice.discount_total.toFixed(2)}</span>
                    </div>
                  )}

                  {invoice.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{invoice.round_off > 0 ? `+₹${invoice.round_off.toFixed(2)}` : `-₹${Math.abs(invoice.round_off).toFixed(2)}`}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t-2 border-slate-900 pt-1.5">
                    <span>Grand Total:</span>
                    <span className="font-mono">₹{invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between text-emerald-700 text-xs font-semibold pt-1 border-t border-slate-200">
                    <span>Amount Received:</span>
                    <span className="font-mono">₹{invoice.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {invoice.balance_due > 0 && (
                    <div className="flex justify-between text-rose-700 text-xs font-bold bg-rose-50 p-1.5 rounded">
                      <span>Balance Due:</span>
                      <span className="font-mono">₹{invoice.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount in Words */}
              <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-xs my-3">
                <span className="font-bold text-slate-700">Amount in Words: </span>
                <span className="font-serif italic text-slate-900 font-semibold">
                  {numberToIndianWords(invoice.grand_total)}
                </span>
              </div>

              {/* Bank Details & UPI QR Code & Authorized Signature Grid */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 mt-4 items-center">
                
                {/* Bank Details */}
                <div className="space-y-1 text-[10px]">
                  <div className="font-bold text-slate-700 uppercase tracking-wider">Bank Details for NEFT/RTGS:</div>
                  <div className="text-slate-600">Bank: <span className="font-semibold text-slate-900">HDFC Bank</span></div>
                  <div className="text-slate-600">A/c No: <span className="font-mono font-semibold text-slate-900">50200084920194</span></div>
                  <div className="text-slate-600">IFSC Code: <span className="font-mono font-semibold text-slate-900">HDFC0001234</span></div>
                  <div className="text-slate-600">Branch: <span className="text-slate-900">Lamington Road, Mumbai</span></div>
                </div>

                {/* UPI QR Code */}
                <div className="text-center flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-slate-700 uppercase mb-1">Scan &amp; Pay with UPI</div>
                  <img
                    src={qrCodeUrl}
                    alt="UPI QR Code"
                    className="w-20 h-20 border border-slate-300 p-1 rounded bg-white"
                  />
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">{upiId}</div>
                </div>

                {/* Signature Box */}
                <div className="text-right flex flex-col justify-between h-full pt-4">
                  <div className="text-[10px] text-slate-600">For <span className="font-bold text-slate-900">{business.business_name || 'BillFlow'}</span></div>
                  <div className="mt-8 border-t border-slate-400 pt-1 text-[10px] font-semibold text-slate-700">
                    Authorized Signatory
                  </div>
                </div>
              </div>

              {/* Terms & Footer Note */}
              <div className="mt-4 pt-2 border-t border-slate-200 text-[9px] text-slate-500 flex justify-between">
                <div>
                  <span className="font-bold">Terms: </span>
                  {invoice.terms_conditions || business.terms_and_conditions || 'Goods once sold will not be taken back.'}
                </div>
                <div className="font-mono">
                  Generated via BillFlow SaaS
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* THERMAL POS 80MM RECEIPT FORMAT                              */
            /* ============================================================ */
            <div className="bg-white text-slate-900 p-4 max-w-[340px] mx-auto font-mono text-[11px] shadow-lg rounded-xl border border-slate-300 print:shadow-none print:border-none print:p-0">
              <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="font-extrabold text-sm uppercase">{business.business_name || 'BillFlow Store'}</div>
                <div className="text-[10px]">{business.address_line1}, {business.city}</div>
                <div className="text-[10px]">Ph: {business.phone}</div>
                <div className="text-[10px] font-bold mt-1">GSTIN: {business.gstin || '27AABCU9603R1ZM'}</div>
                <div className="text-[10px] font-bold uppercase mt-1">*** {invoice.invoice_type} ***</div>
              </div>

              <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[10px] space-y-0.5">
                <div className="flex justify-between"><span>Inv No:</span><span className="font-bold">{invoice.invoice_number}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{invoice.invoice_date}</span></div>
                <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{invoice.customer_name}</span></div>
                {invoice.customer_phone && <div className="flex justify-between"><span>Phone:</span><span>{invoice.customer_phone}</span></div>}
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="flex justify-between font-bold text-[10px] border-b border-slate-300 pb-1 mb-1">
                  <span>Item</span>
                  <span>Qty x Rate</span>
                  <span>Total</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5 py-0.5">
                    <div className="font-semibold">{item.item_name}</div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>{item.quantity} {item.unit} @ ₹{item.unit_price}</span>
                      <span className="font-bold text-slate-900">₹{item.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calculation */}
              <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[10px] space-y-1">
                <div className="flex justify-between"><span>Subtotal:</span><span>₹{invoice.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>GST Total:</span><span>₹{invoice.tax_total.toFixed(2)}</span></div>
                {invoice.discount_total > 0 && <div className="flex justify-between text-rose-600"><span>Discount:</span><span>-₹{invoice.discount_total.toFixed(2)}</span></div>}
                <div className="flex justify-between text-xs font-extrabold border-t border-slate-300 pt-1">
                  <span>NET PAYABLE:</span>
                  <span>₹{invoice.grand_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700"><span>Paid:</span><span>₹{invoice.paid_amount.toFixed(2)}</span></div>
                {invoice.balance_due > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold"><span>Balance Due:</span><span>₹{invoice.balance_due.toFixed(2)}</span></div>
                )}
              </div>

              <div className="text-center pt-2">
                <img src={qrCodeUrl} alt="QR" className="w-16 h-16 mx-auto mb-1 border p-0.5 rounded" />
                <div className="text-[9px]">Scan to pay with UPI</div>
                <div className="text-[9px] text-slate-500 mt-2">Thank you! Visit again.</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
