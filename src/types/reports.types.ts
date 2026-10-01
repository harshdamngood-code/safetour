export interface Gstr1B2BRecord {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_gstin: string;
  place_of_supply: string;
  invoice_type: string;
  reverse_charge: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  invoice_value: number;
  items_count: number;
}

export interface Gstr1B2CSmallGroup {
  pos: string;
  tax_rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface Gstr1HsnSummary {
  hsn_code: string;
  description: string;
  unit: string;
  total_quantity: number;
  total_value: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Gstr1Response {
  period: { startDate: string; endDate: string };
  business: {
    legal_name: string;
    gstin: string;
    state: string;
    state_code: string;
  };
  summary: {
    total_invoices: number;
    b2b_count: number;
    b2c_small_count: number;
    b2c_large_count: number;
    total_taxable: number;
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
    total_tax: number;
    total_invoice_value: number;
  };
  tables: {
    b2b: Gstr1B2BRecord[];
    b2c_large: any[];
    b2c_small: Gstr1B2CSmallGroup[];
    hsn: Gstr1HsnSummary[];
    doc_issued: any[];
  };
}

export interface Gstr3bResponse {
  period: { startDate: string; endDate: string };
  business: {
    legal_name: string;
    gstin: string;
    state: string;
  };
  table3_1: {
    nature_of_supplies: string;
    taxable_value: number;
    integrated_tax: number;
    central_tax: number;
    state_tax: number;
    cess: number;
  };
  table4_itc: {
    nature: string;
    taxable_value: number;
    integrated_tax: number;
    central_tax: number;
    state_tax: number;
    total_itc: number;
  };
  table5_1_net_payable: {
    integrated_tax: number;
    central_tax: number;
    state_tax: number;
    total_cash_payable: number;
  };
  itc_carried_forward: {
    integrated_tax: number;
    central_tax: number;
    state_tax: number;
    total_credit: number;
  };
}

export interface ProfitLossResponse {
  period: { startDate: string; endDate: string };
  income: {
    gross_sales: number;
    discounts: number;
    net_sales: number;
  };
  cost_of_goods_sold: {
    purchases: number;
    cogs_total: number;
    closing_inventory_valuation: number;
  };
  gross_profit: number;
  gross_margin_percent: number;
  operating_expenses: {
    categories: Array<{ category: string; amount: number; percent: number }>;
    total_expenses: number;
  };
  net_profit: number;
  net_profit_margin_percent: number;
}

export interface DaybookResponse {
  date: string;
  summary: {
    total_sales: number;
    total_purchases: number;
    total_expenses: number;
    cash_inflow: number;
    cash_outflow: number;
    net_cashflow: number;
  };
  entries: {
    invoices: any[];
    purchases: any[];
    payments: any[];
    expenses: any[];
  };
}
