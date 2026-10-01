export interface CreatePurchaseItemPayload {
  product_id?: string | null;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  unit_cost: number;
  discount_percent?: number;
  tax_rate: number;
}

export interface CreatePurchasePayload {
  supplier_id?: string | null;
  supplier_name: string;
  supplier_phone?: string;
  supplier_email?: string;
  supplier_address?: string;
  supplier_company?: string;
  supplier_gstin?: string;
  supplier_state?: string;
  bill_number: string;
  bill_date: string;
  due_date?: string;
  items: CreatePurchaseItemPayload[];
  paid_amount?: number;
  payment_method?: string;
  round_off?: number;
  notes?: string;
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  product_id?: string | null;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  unit_cost: number;
  discount_percent?: number;
  tax_rate: number;
  taxable_amount: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount: number;
  catalog_product_name?: string;
  product_sku?: string;
  product_barcode?: string;
}

export interface PurchaseBill {
  id: string;
  business_id: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_phone?: string;
  supplier_email?: string;
  supplier_address?: string;
  supplier_company?: string;
  supplier_gstin?: string;
  supplier_state?: string;
  bill_number: string;
  bill_date: string;
  due_date?: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  round_off: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  payment_method?: string;
  notes?: string;
  created_at: string;
  items?: PurchaseItem[];
  payments?: any[];
}

export interface PurchaseKPIs {
  total_bills: number;
  total_purchases_amount: number;
  total_paid: number;
  total_payables_due: number;
  total_itc_available: number;
}

export interface ExpenseRecord {
  id: string;
  business_id: string;
  category: string;
  vendor_name?: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  description?: string;
  gstin?: string;
  tax_rate?: number;
  taxable_amount?: number;
  gst_amount?: number;
  is_itc_eligible: number;
  reference_no?: string;
  created_at: string;
}

export interface ExpenseSummary {
  total_expenses: number;
  total_expense_gst_itc: number;
  total_entries: number;
}
