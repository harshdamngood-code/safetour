export type InvoiceType = 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'QUOTATION' | 'PROFORMA';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'QUOTATION';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id?: string;
  item_name: string;
  hsn_code?: string;
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
}

export interface InvoiceRecord {
  id: string;
  business_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  customer_state?: string;
  invoice_type: InvoiceType;
  place_of_supply?: string;
  billing_address?: string;
  shipping_address?: string;
  po_number?: string;
  vehicle_number?: string;
  e_way_bill_no?: string;
  terms_conditions?: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  discount_total: number;
  round_off: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: PaymentStatus;
  payment_method?: string;
  notes?: string;
  item_count?: number;
  items?: InvoiceItem[];
  customer?: any;
  business?: any;
  payments?: any[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceKPIs {
  total_invoices_count: number;
  total_sales_volume: number;
  total_collected: number;
  total_receivable_due: number;
  total_gst_billed: number;
  paid_invoices_count: number;
  partial_invoices_count: number;
  unpaid_invoices_count: number;
  quotations_count: number;
}
