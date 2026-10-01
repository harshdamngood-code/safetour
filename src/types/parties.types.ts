export type PartyType = 'CUSTOMER' | 'SUPPLIER';

export interface PartySummary {
  totalReceivable: number;
  totalPayable: number;
  netKhata: number;
  customerCount: number;
  supplierCount: number;
  totalParties: number;
}

export interface PartyListItem {
  id: string;
  party_type: PartyType;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billing_address?: string;
  shipping_address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  opening_balance: number;
  current_balance: number;
  credit_limit: number;
  is_active: number;
  created_at: string;
}

export interface PartyLedgerEntry {
  id: string;
  voucher_no: string;
  date: string;
  type: 'INVOICE' | 'PURCHASE' | 'PAYMENT_IN' | 'PAYMENT_OUT';
  debit: number;
  credit: number;
  payment_status: string;
  description: string;
  runningBalance: number;
}

export interface PartyDetailResponse {
  success: boolean;
  party: PartyListItem;
  ledgerEntries: PartyLedgerEntry[];
}

export interface PartiesListResponse {
  success: boolean;
  summary: PartySummary;
  parties: PartyListItem[];
}
