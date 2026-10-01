import React, { useEffect, useState } from 'react';
import { Download, Share2, CheckCircle2, AlertCircle, Building2, Phone, Mail, MapPin, Receipt, ArrowLeft } from 'lucide-react';
import { generateA4InvoicePDF, generateThermalReceipt } from '../lib/pdf-generator';
import { api } from '../lib/api';

interface PublicInvoiceViewProps {
  token: string;
}

export const PublicInvoiceView: React.FC<PublicInvoiceViewProps> = ({ token }) => {
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      try {
        setLoading(true);
        const json = await api.get(`/public/invoice/${token}`, { skipAuthRefresh: true });
        if (json.success && json.data) {
          setInvoice(json.data);
        } else {
          setError(json.message || 'Invoice not found or expired.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error while loading invoice.');
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-600">Loading verified invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-lg border border-slate-200">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">Invoice Unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">{error || 'This invoice link may be invalid or has expired.'}</p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Go to BillFlow Home
          </a>
        </div>
      </div>
    );
  }

  const business = invoice.business || {};
  const items = invoice.items || [];
  const isPaid = invoice.payment_status === 'PAID';

  const upiQrUrl = business.upi_id
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        `upi://pay?pa=${business.upi_id}&pn=${encodeURIComponent(business.business_name)}&am=${invoice.balance_due || invoice.grand_total}&cu=INR&tn=Invoice%20${invoice.invoice_number}`
      )}`
    : null;

  const handleDownloadPDF = () => {
    const doc = generateA4InvoicePDF({
      ...invoice,
      business,
      items,
    });
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
  };

  const handleDownloadThermal = () => {
    const doc = generateThermalReceipt({
      ...invoice,
      business,
      items,
    });
    doc.save(`Receipt_${invoice.invoice_number}.pdf`);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hello ${invoice.customer_name},\nHere is your invoice ${invoice.invoice_number} for ₹${invoice.grand_total.toLocaleString('en-IN')}.\nView & Download: ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Top Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">
              BF
            </span>
            <div>
              <p className="text-xs text-slate-500 font-medium">Digital Invoice Document</p>
              <h1 className="text-base font-bold text-slate-900">{invoice.invoice_number}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Share2 className="h-4 w-4" />
              WhatsApp
            </button>
            <button
              onClick={handleDownloadThermal}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Receipt className="h-4 w-4" />
              Thermal POS
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl border border-slate-200">
          {/* Header */}
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <span className="inline-block rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold tracking-wide text-indigo-300 uppercase">
                  {invoice.invoice_type === 'QUOTATION' ? 'Quotation / Estimate' : 'GST Tax Invoice'}
                </span>
                <h2 className="mt-2 text-2xl font-black">{business.business_name}</h2>
                <p className="mt-1 text-xs text-slate-300">
                  {business.address_line1}, {business.city}, {business.state} - {business.pincode}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-300">
                  {business.gstin && <span>GSTIN: <strong className="text-white">{business.gstin}</strong></span>}
                  <span>Phone: <strong className="text-white">{business.phone}</strong></span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 text-right backdrop-blur-xs">
                <p className="text-xs text-slate-300">Invoice Amount</p>
                <p className="text-2xl font-black text-white">₹{Number(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-white/20">
                  {isPaid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
                  {invoice.payment_status}
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Invoice Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 border-b border-slate-100 bg-slate-50/50">
            <div>
              <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Billed To</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">{invoice.customer_name}</h3>
              {invoice.customer_phone && <p className="text-xs text-slate-600 mt-0.5">Phone: {invoice.customer_phone}</p>}
              {invoice.customer_gstin && <p className="text-xs text-slate-600">GSTIN: {invoice.customer_gstin}</p>}
              {invoice.billing_address && <p className="text-xs text-slate-600 mt-0.5">{invoice.billing_address}</p>}
            </div>

            <div className="space-y-1.5 md:text-right">
              <p className="text-xs text-slate-500">Invoice Number: <strong className="text-slate-900">{invoice.invoice_number}</strong></p>
              <p className="text-xs text-slate-500">Invoice Date: <strong className="text-slate-900">{invoice.invoice_date}</strong></p>
              {invoice.due_date && <p className="text-xs text-slate-500">Due Date: <strong className="text-slate-900">{invoice.due_date}</strong></p>}
              {invoice.place_of_supply && <p className="text-xs text-slate-500">Place of Supply: <strong className="text-slate-900">{invoice.place_of_supply}</strong></p>}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto p-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="pb-3">#</th>
                  <th className="pb-3">Item Description</th>
                  <th className="pb-3 text-center">HSN</th>
                  <th className="pb-3 text-right">Qty</th>
                  <th className="pb-3 text-right">Price</th>
                  <th className="pb-3 text-right">Taxable</th>
                  <th className="pb-3 text-right">GST</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="text-slate-700">
                    <td className="py-3 text-xs text-slate-400">{idx + 1}</td>
                    <td className="py-3 font-medium text-slate-900">{item.item_name}</td>
                    <td className="py-3 text-center text-xs text-slate-500">{item.hsn_code || '-'}</td>
                    <td className="py-3 text-right">{item.quantity} {item.unit || 'PCS'}</td>
                    <td className="py-3 text-right">₹{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-3 text-right">₹{Number(item.taxable_amount).toFixed(2)}</td>
                    <td className="py-3 text-right text-xs text-slate-500">{item.tax_rate}%</td>
                    <td className="py-3 text-right font-semibold text-slate-900">₹{Number(item.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & UPI Payment Section */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-200 pt-8">
              {/* Payment Info & UPI QR */}
              <div>
                {business.upi_id && Number(invoice.balance_due) > 0 ? (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
                    <p className="text-xs font-bold text-indigo-950 uppercase tracking-wide">Instant UPI Payment</p>
                    <p className="mt-1 text-xs text-indigo-700">Scan using any UPI App (GPay, PhonePe, Paytm)</p>
                    <div className="mt-4 flex items-center gap-4">
                      {upiQrUrl && (
                        <img src={upiQrUrl} alt="UPI QR Code" className="h-28 w-28 rounded-xl border border-indigo-200 bg-white p-1" />
                      )}
                      <div className="space-y-1 text-xs text-indigo-900">
                        <p>UPI VPA: <strong className="font-mono">{business.upi_id}</strong></p>
                        <p>Amount: <strong>₹{Number(invoice.balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-900">Bank Details</p>
                    <p>Bank: {business.bank_name || 'HDFC Bank Ltd.'}</p>
                    <p>Account: {business.bank_account_no || '50200084930219'}</p>
                    <p>IFSC: {business.bank_ifsc || 'HDFC0000240'}</p>
                  </div>
                )}
              </div>

              {/* Summary Calculation */}
              <div className="space-y-2.5 rounded-2xl bg-slate-50 p-6">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>GST Tax Total</span>
                  <span>₹{Number(invoice.tax_total).toFixed(2)}</span>
                </div>
                {Number(invoice.discount_total) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount</span>
                    <span>- ₹{Number(invoice.discount_total).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>₹{Number(invoice.grand_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Paid Amount</span>
                  <span>₹{Number(invoice.paid_amount).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-rose-600">
                  <span>Balance Due</span>
                  <span>₹{Number(invoice.balance_due).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
