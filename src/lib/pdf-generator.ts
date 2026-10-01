import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoicePDFData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  invoice_type?: string;
  place_of_supply?: string;
  po_number?: string;
  vehicle_number?: string;
  e_way_bill_no?: string;
  terms_conditions?: string;
  notes?: string;
  subtotal: number;
  tax_total: number;
  cgst_total?: number;
  sgst_total?: number;
  igst_total?: number;
  discount_total?: number;
  round_off?: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  customer_state?: string;
  billing_address?: string;
  business: {
    business_name: string;
    legal_name?: string;
    gstin?: string;
    pan?: string;
    phone: string;
    email?: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    state_code?: string;
    pincode: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
    bank_branch?: string;
    upi_id?: string;
    terms_and_conditions?: string;
  };
  items: Array<{
    item_name: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount_percent?: number;
    tax_rate: number;
    taxable_amount: number;
    cgst_amount?: number;
    sgst_amount?: number;
    igst_amount?: number;
    total_amount: number;
  }>;
}

/**
 * Generate and download professional A4 GST Tax Invoice PDF
 */
export function generateA4InvoicePDF(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header Box (Business Brand)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, 12, pageWidth - margin * 2, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.business.business_name.toUpperCase(), margin + 6, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const addressLine = `${data.business.address_line1}, ${data.business.city}, ${data.business.state} - ${data.business.pincode}`;
  doc.text(addressLine, margin + 6, 28);
  doc.text(`GSTIN: ${data.business.gstin || 'UNREGISTERED'} | Phone: ${data.business.phone}`, margin + 6, 34);

  // Invoice Title badge
  const docTitle = data.invoice_type === 'QUOTATION' ? 'QUOTATION / ESTIMATE' : 'TAX INVOICE';
  doc.setFillColor(239, 68, 68); // Brand Red/Blue accent
  doc.roundedRect(pageWidth - margin - 50, 16, 44, 8, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(docTitle, pageWidth - margin - 28, 21.5, { align: 'center' });

  // Invoice Meta & Customer Details section
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO:', margin, 48);
  doc.text('INVOICE DETAILS:', pageWidth / 2 + 10, 48);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.customer_name, margin, 54);
  if (data.billing_address) doc.text(data.billing_address.slice(0, 40), margin, 59);
  doc.text(`Phone: ${data.customer_phone || 'N/A'}`, margin, 64);
  doc.text(`GSTIN: ${data.customer_gstin || 'Unregistered Consumer'}`, margin, 69);
  if (data.customer_state) doc.text(`State: ${data.customer_state}`, margin, 74);

  // Meta info on right
  const rightX = pageWidth / 2 + 10;
  doc.text(`Invoice No: ${data.invoice_number}`, rightX, 54);
  doc.text(`Invoice Date: ${data.invoice_date}`, rightX, 59);
  if (data.due_date) doc.text(`Due Date: ${data.due_date}`, rightX, 64);
  if (data.place_of_supply) doc.text(`Place of Supply: ${data.place_of_supply}`, rightX, 69);
  if (data.e_way_bill_no) doc.text(`E-Way Bill: ${data.e_way_bill_no}`, rightX, 74);

  // Line Items Table
  const tableRows = data.items.map((item, index) => [
    index + 1,
    item.item_name,
    item.hsn_code || '-',
    `${item.quantity} ${item.unit || 'PCS'}`,
    `₹${item.unit_price.toFixed(2)}`,
    `₹${item.taxable_amount.toFixed(2)}`,
    `${item.tax_rate}%`,
    `₹${item.total_amount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['#', 'Item Description', 'HSN/SAC', 'Qty', 'Rate', 'Taxable', 'GST %', 'Total (₹)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Summary Totals Box
  const summaryX = pageWidth - margin - 75;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryX, finalY, 75, 52, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, finalY, 75, 52, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Taxable Subtotal:', summaryX + 4, finalY + 7);
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - margin - 4, finalY + 7, { align: 'right' });

  doc.text('Total GST Tax:', summaryX + 4, finalY + 14);
  doc.text(`₹${data.tax_total.toFixed(2)}`, pageWidth - margin - 4, finalY + 14, { align: 'right' });

  if (data.discount_total && data.discount_total > 0) {
    doc.text('Discount:', summaryX + 4, finalY + 21);
    doc.text(`- ₹${data.discount_total.toFixed(2)}`, pageWidth - margin - 4, finalY + 21, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Grand Total:', summaryX + 4, finalY + 28);
  doc.text(`₹${data.grand_total.toFixed(2)}`, pageWidth - margin - 4, finalY + 28, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Paid Amount:', summaryX + 4, finalY + 36);
  doc.text(`₹${data.paid_amount.toFixed(2)}`, pageWidth - margin - 4, finalY + 36, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(data.balance_due > 0 ? 220 : 22, data.balance_due > 0 ? 38 : 163, data.balance_due > 0 ? 38 : 74);
  doc.text('Balance Due:', summaryX + 4, finalY + 44);
  doc.text(`₹${data.balance_due.toFixed(2)}`, pageWidth - margin - 4, finalY + 44, { align: 'right' });

  // Bank & Payment Instructions Box on Left
  doc.setTextColor(15, 23, 42);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, finalY, summaryX - margin - 6, 52, 2, 2, 'F');
  doc.roundedRect(margin, finalY, summaryX - margin - 6, 52, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BANK & PAYMENT DETAILS:', margin + 4, finalY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Bank Name: ${data.business.bank_name || 'HDFC Bank Ltd.'}`, margin + 4, finalY + 14);
  doc.text(`A/C No: ${data.business.bank_account_no || '50200084930219'}`, margin + 4, finalY + 20);
  doc.text(`IFSC Code: ${data.business.bank_ifsc || 'HDFC0000240'}`, margin + 4, finalY + 26);
  if (data.business.upi_id) doc.text(`UPI VPA: ${data.business.upi_id}`, margin + 4, finalY + 32);

  // Terms & Authorized Signatory
  const footerY = Math.min(270, finalY + 58);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Terms & Conditions:', margin, footerY);
  doc.text(
    data.terms_conditions || data.business.terms_and_conditions || '1. Goods once sold will not be taken back without receipt. 2. Subject to local jurisdiction.',
    margin,
    footerY + 4,
    { maxWidth: 110 }
  );

  doc.setFont('helvetica', 'bold');
  doc.text(`For ${data.business.business_name}`, pageWidth - margin - 5, footerY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory', pageWidth - margin - 5, footerY + 16, { align: 'right' });

  return doc;
}

/**
 * Generate 80mm POS Thermal Receipt
 */
export function generateThermalReceipt(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200],
  });

  const margin = 4;
  const pageWidth = 80;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.business.business_name, pageWidth / 2, 8, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(data.business.address_line1, pageWidth / 2, 12, { align: 'center' });
  doc.text(`GST: ${data.business.gstin || 'N/A'} | Ph: ${data.business.phone}`, pageWidth / 2, 16, { align: 'center' });

  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, 19, pageWidth - margin, 19);

  doc.text(`Bill: ${data.invoice_number}`, margin, 23);
  doc.text(`Date: ${data.invoice_date}`, pageWidth - margin, 23, { align: 'right' });
  doc.text(`Cust: ${data.customer_name}`, margin, 27);

  doc.line(margin, 29, pageWidth - margin, 29);

  let y = 33;
  data.items.forEach((item) => {
    doc.text(item.item_name.slice(0, 20), margin, y);
    doc.text(`${item.quantity} x ₹${item.unit_price}`, margin + 35, y);
    doc.text(`₹${item.total_amount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4.5;
  });

  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', margin, y);
  doc.text(`₹${data.grand_total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.text('Paid Amount:', margin, y);
  doc.text(`₹${data.paid_amount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 4.5;

  doc.text('Balance Due:', margin, y);
  doc.text(`₹${data.balance_due.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  doc.setFontSize(6.5);
  doc.text('Thank you! Visit Again.', pageWidth / 2, y, { align: 'center' });

  return doc;
}
