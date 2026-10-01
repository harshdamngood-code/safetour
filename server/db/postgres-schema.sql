-- ============================================================
-- BillFlow Commercial SaaS - PostgreSQL Production Schema
-- Compatible with PostgreSQL 14+, Neon, Supabase, Cloud SQL
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (Global platform accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active SMALLINT DEFAULT 1,
  is_super_admin SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Businesses Table (Tenant Isolation entity)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  business_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  business_type VARCHAR(100) NOT NULL, -- Retail, Wholesale, Services, Distributor, Manufacturing
  business_category VARCHAR(100),
  gstin VARCHAR(15),                  -- 15-character Indian GSTIN
  pan VARCHAR(10),                    -- 10-character PAN
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,     -- 2-digit GST state code (e.g. 27 for Maharashtra)
  pincode VARCHAR(10) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  invoice_next_number INTEGER DEFAULT 1001,
  quotation_prefix VARCHAR(20) DEFAULT 'EST',
  quotation_next_number INTEGER DEFAULT 1001,
  return_next_number INTEGER DEFAULT 1001,
  financial_year_start VARCHAR(20) DEFAULT '2026-04-01',
  terms_and_conditions TEXT,
  logo_url TEXT,
  bank_name VARCHAR(255),
  bank_account_no VARCHAR(100),
  bank_ifsc VARCHAR(20),
  bank_branch VARCHAR(255),
  upi_id VARCHAR(255),
  signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);

-- 3. Business Users (Multi-tenancy RBAC linkage)
CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'SALESPERSON', -- OWNER, ADMIN, MANAGER, SALESPERSON, ACCOUNTANT, INVENTORY_STAFF
  custom_permissions JSONB DEFAULT '{}',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_users_lookup ON business_users(business_id, user_id);

-- 4. Branches Table
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_name VARCHAR(255) NOT NULL,
  branch_code VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  phone VARCHAR(50),
  is_main SMALLINT DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_branches_business ON branches(business_id);

-- 5. Subscriptions Table (SaaS Monetization)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL DEFAULT 'FREE', -- FREE, BASIC, PRO, BUSINESS
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- TRIAL, ACTIVE, EXPIRED, CANCELLED
  billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',
  max_invoices_per_month INTEGER DEFAULT 100,
  max_products INTEGER DEFAULT 250,
  max_users INTEGER DEFAULT 2,
  current_period_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  razorpay_sub_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Refresh Tokens Table (Secure Multi-Device Session Management & Rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  device_info VARCHAR(255),
  ip_address VARCHAR(100),
  is_revoked SMALLINT DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  replaced_by_token_hash VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup ON refresh_tokens(token_hash);

-- 7. Audit Logs Table (Full Business & Platform Activity Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT 'SYSTEM',
  entity_name VARCHAR(50) DEFAULT 'SYSTEM',
  entity_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(business_id, action);

-- 8. Products / Inventory Catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  hsn_code VARCHAR(50),
  category VARCHAR(100),
  brand VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'PCS',
  purchase_price NUMERIC(18, 2) DEFAULT 0.00,
  selling_price NUMERIC(18, 2) DEFAULT 0.00,
  mrp NUMERIC(18, 2) DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) DEFAULT 18.00,
  is_tax_inclusive SMALLINT DEFAULT 0,
  current_stock NUMERIC(18, 3) DEFAULT 0.000,
  min_stock_alert NUMERIC(18, 3) DEFAULT 10.000,
  image_url TEXT,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku);

-- 9. Stock Adjustments Ledger
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL, -- 'ADD', 'REDUCE', 'SET'
  quantity NUMERIC(18, 3) NOT NULL,
  previous_stock NUMERIC(18, 3) NOT NULL,
  new_stock NUMERIC(18, 3) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  reference_no VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_business ON stock_adjustments(business_id, created_at DESC);

-- 10. Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  gstin VARCHAR(15),
  pan VARCHAR(10),
  billing_address TEXT,
  shipping_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(2),
  pincode VARCHAR(20),
  opening_balance NUMERIC(18, 2) DEFAULT 0.00,
  current_balance NUMERIC(18, 2) DEFAULT 0.00,
  credit_limit NUMERIC(18, 2) DEFAULT 0.00,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

-- 11. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  gstin VARCHAR(15),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(2),
  pincode VARCHAR(20),
  opening_balance NUMERIC(18, 2) DEFAULT 0.00,
  current_balance NUMERIC(18, 2) DEFAULT 0.00,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);

-- 12. Invoices (Sales & Quotations)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  customer_gstin VARCHAR(15),
  customer_state VARCHAR(100),
  invoice_type VARCHAR(50) NOT NULL DEFAULT 'TAX_INVOICE',
  place_of_supply VARCHAR(100),
  billing_address TEXT,
  shipping_address TEXT,
  po_number VARCHAR(100),
  vehicle_number VARCHAR(100),
  e_way_bill_no VARCHAR(100),
  terms_conditions TEXT,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  tax_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  cgst_total NUMERIC(18, 2) DEFAULT 0.00,
  sgst_total NUMERIC(18, 2) DEFAULT 0.00,
  igst_total NUMERIC(18, 2) DEFAULT 0.00,
  discount_total NUMERIC(18, 2) DEFAULT 0.00,
  round_off NUMERIC(18, 2) DEFAULT 0.00,
  grand_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
  payment_method VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_business_invoice_number UNIQUE(business_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_business_date ON invoices(business_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(business_id, customer_id);

-- 13. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(50),
  quantity NUMERIC(18, 3) NOT NULL,
  unit VARCHAR(50) DEFAULT 'PCS',
  unit_price NUMERIC(18, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) DEFAULT 0.00,
  discount_amount NUMERIC(18, 2) DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) DEFAULT 18.00,
  taxable_amount NUMERIC(18, 2) NOT NULL,
  cgst_amount NUMERIC(18, 2) DEFAULT 0.00,
  sgst_amount NUMERIC(18, 2) DEFAULT 0.00,
  igst_amount NUMERIC(18, 2) DEFAULT 0.00,
  total_amount NUMERIC(18, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 14. Sales Returns (Credit Notes)
CREATE TABLE IF NOT EXISTS sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  return_number VARCHAR(100) NOT NULL,
  return_date DATE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  tax_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  refund_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  refund_status VARCHAR(50) DEFAULT 'COMPLETED',
  reason VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_business_return_number UNIQUE(business_id, return_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_business ON sales_returns(business_id, return_date DESC);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(18, 3) NOT NULL,
  unit_price NUMERIC(18, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) DEFAULT 18.00,
  taxable_amount NUMERIC(18, 2) NOT NULL,
  total_amount NUMERIC(18, 2) NOT NULL
);

-- 15. Purchases (Inward Supplier Bills)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_gstin VARCHAR(15),
  supplier_state VARCHAR(100),
  bill_number VARCHAR(100) NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  tax_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  cgst_total NUMERIC(18, 2) DEFAULT 0.00,
  sgst_total NUMERIC(18, 2) DEFAULT 0.00,
  igst_total NUMERIC(18, 2) DEFAULT 0.00,
  discount_total NUMERIC(18, 2) DEFAULT 0.00,
  round_off NUMERIC(18, 2) DEFAULT 0.00,
  grand_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_business ON purchases(business_id, bill_date DESC);

-- 16. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(50),
  quantity NUMERIC(18, 3) NOT NULL,
  unit VARCHAR(50) DEFAULT 'PCS',
  unit_cost NUMERIC(18, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) DEFAULT 18.00,
  taxable_amount NUMERIC(18, 2) NOT NULL,
  cgst_amount NUMERIC(18, 2) DEFAULT 0.00,
  sgst_amount NUMERIC(18, 2) DEFAULT 0.00,
  igst_amount NUMERIC(18, 2) DEFAULT 0.00,
  total_amount NUMERIC(18, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

-- 17. Purchase Returns (Debit Notes)
CREATE TABLE IF NOT EXISTS purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  return_number VARCHAR(100) NOT NULL,
  return_date DATE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  tax_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  refund_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  reason VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_business_pur_return_number UNIQUE(business_id, return_number)
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(18, 3) NOT NULL,
  unit_cost NUMERIC(18, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) DEFAULT 18.00,
  taxable_amount NUMERIC(18, 2) NOT NULL,
  total_amount NUMERIC(18, 2) NOT NULL
);

-- 18. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
  vendor_name VARCHAR(255),
  gstin VARCHAR(15),
  tax_rate NUMERIC(5, 2) DEFAULT 0.00,
  taxable_amount NUMERIC(18, 2) DEFAULT 0.00,
  gst_amount NUMERIC(18, 2) DEFAULT 0.00,
  is_itc_eligible SMALLINT DEFAULT 1,
  reference_no VARCHAR(100),
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id, expense_date DESC);

-- 19. Payments Ledger (Cash & Bank Book)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL, -- 'IN' (Received) or 'OUT' (Paid)
  entity_type VARCHAR(50) NOT NULL, -- 'CUSTOMER', 'SUPPLIER', 'OTHER'
  entity_id UUID,
  entity_name VARCHAR(255) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  amount NUMERIC(18, 2) NOT NULL,
  payment_mode VARCHAR(50) NOT NULL, -- 'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'
  reference_number VARCHAR(100),
  account_type VARCHAR(50) NOT NULL DEFAULT 'BANK', -- 'CASH' or 'BANK'
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id, payment_date DESC);

-- 20. Public Shared Invoice Tokens
CREATE TABLE IF NOT EXISTS public_invoice_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_public_tokens_lookup ON public_invoice_tokens(share_token);

-- 21. Device & Offline Sync Audit
CREATE TABLE IF NOT EXISTS sync_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id VARCHAR(100) NOT NULL,
  operation_id VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'SYNCED',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_biz_operation_id UNIQUE(business_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_op ON sync_audit(business_id, operation_id);
