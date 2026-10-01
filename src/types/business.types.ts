import { UserRole } from './auth.types';

export interface Business {
  id: string;
  owner_id: string;
  business_name: string;
  legal_name?: string;
  business_type: string;
  business_category?: string;
  gstin?: string;
  pan?: string;
  phone: string;
  email?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  currency: string;
  invoice_prefix: string;
  invoice_next_number: number;
  financial_year_start: string;
  terms_and_conditions?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  currentRole?: UserRole;
  permissions?: Record<string, boolean>;
}

export interface CreateBusinessInput {
  businessName: string;
  legalName?: string;
  businessType: string;
  businessCategory?: string;
  gstin?: string;
  pan?: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  currency?: string;
  invoicePrefix?: string;
  termsAndConditions?: string;
}
