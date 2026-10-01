export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SALESPERSON' | 'ACCOUNTANT' | 'INVENTORY_STAFF';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  createdAt?: string;
}

export interface BusinessSummary {
  id: string;
  business_name: string;
  legal_name?: string;
  business_type: string;
  business_category?: string;
  gstin?: string;
  city: string;
  state: string;
  state_code: string;
  invoice_prefix: string;
  currency: string;
  role: UserRole;
  custom_permissions?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseData {
  user: User;
  businesses: BusinessSummary[];
  activeBusiness: BusinessSummary | null;
  tokens: AuthTokens;
}

export interface BusinessMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  is_active: number;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  user_email: string;
  action: string;
  entity_name: string;
  entity_id?: string;
  details: string;
  ip_address?: string;
  created_at: string;
}
