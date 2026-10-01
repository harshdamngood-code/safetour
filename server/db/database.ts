import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'billflow.sqlite');

/**
 * Initializes SQLite database via sql.js with filesystem persistence and auto-migration.
 */
export async function getDatabase(): Promise<Database> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  // Run migrations
  runMigrations(db);

  // Seed sample data if empty
  await seedInitialData(db);
  await seedCommerceData(db);

  // Persist to disk
  persistDatabase();

  return db;
}

/**
 * Persists current in-memory database state to the SQLite file.
 */
export function persistDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('[Database] Failed to persist database to disk:', err);
  }
}

/**
 * Restores in-memory database state from a snapshot buffer (used for development transaction rollbacks)
 */
export function restoreDatabaseFromBuffer(buffer: Uint8Array): void {
  if (!SQL) return;
  try {
    if (db) {
      db.close();
    }
    db = new SQL.Database(buffer);
  } catch (err) {
    console.error('[Database] Failed to restore database snapshot:', err);
  }
}

/**
 * Helper to execute a query returning multiple rows as an array of objects.
 */
export function queryAll<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/**
 * Helper to execute a query returning a single row or null.
 */
export function queryOne<T = Record<string, any>>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper to execute an INSERT/UPDATE/DELETE statement and persist changes.
 */
export function run(sql: string, params: any[] = []): { changes: number } {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  persistDatabase();
  return { changes: db.getRowsModified() };
}

/**
 * DDL Schema creation & migrations.
 */
function runMigrations(database: Database): void {
  database.run(`
    -- Users Table (Global platform accounts)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_super_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Businesses Table (Tenant Isolation entity)
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      business_name TEXT NOT NULL,
      legal_name TEXT,
      business_type TEXT NOT NULL, -- Retail, Wholesale, Services, Distributor, Manufacturing
      business_category TEXT,
      gstin TEXT,                  -- 15-character Indian GSTIN
      pan TEXT,                    -- 10-character PAN
      phone TEXT NOT NULL,
      email TEXT,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      state_code TEXT NOT NULL,     -- 2-digit GST state code (e.g. 27 for Maharashtra)
      pincode TEXT NOT NULL,
      currency TEXT DEFAULT 'INR',
      invoice_prefix TEXT DEFAULT 'INV',
      invoice_next_number INTEGER DEFAULT 1001,
      quotation_prefix TEXT DEFAULT 'EST',
      quotation_next_number INTEGER DEFAULT 1001,
      return_next_number INTEGER DEFAULT 1001,
      financial_year_start TEXT DEFAULT '2026-04-01',
      terms_and_conditions TEXT,
      logo_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Business Users (Multi-tenancy RBAC linkage)
    CREATE TABLE IF NOT EXISTS business_users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'SALESPERSON', -- OWNER, ADMIN, MANAGER, SALESPERSON, ACCOUNTANT, INVENTORY_STAFF
      custom_permissions TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, user_id)
    );

    -- Refresh Tokens & Sessions
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      device_info TEXT,
      ip_address TEXT,
      is_revoked INTEGER DEFAULT 0,
      revoked_at TEXT,
      replaced_by_token_hash TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Audit Logs (Compliance, Security, and Fraud Prevention)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      user_email TEXT,
      action TEXT NOT NULL,
      entity_type TEXT DEFAULT 'SYSTEM',
      entity_name TEXT DEFAULT 'SYSTEM',
      entity_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Index for multi-tenant isolation and fast lookup
    CREATE INDEX IF NOT EXISTS idx_business_users_tenant ON business_users(business_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at);

    -- Products / Inventory Table
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      hsn_code TEXT,
      category TEXT,
      unit TEXT DEFAULT 'PCS',
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      mrp REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      is_tax_inclusive INTEGER DEFAULT 0,
      current_stock REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);

    -- Stock Adjustments / Inventory Movements Table
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      adjustment_type TEXT NOT NULL, -- 'ADD', 'REDUCE', 'SET'
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT NOT NULL, -- 'PHYSICAL_COUNT_CORRECTION', 'DAMAGE_EXPIRED', 'RETURN_FROM_CUSTOMER', 'THEFT_OR_LOSS', 'PURCHASE_RECEIPT', 'SALE_DISPATCH', 'OPENING_STOCK', 'OTHER'
      reference_no TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_adj_business_product ON stock_adjustments(business_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_adj_created_at ON stock_adjustments(business_id, created_at);

    -- Customers Table
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      company_name TEXT,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      pan TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      pincode TEXT,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

    -- Suppliers Table
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      company_name TEXT,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      pincode TEXT,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);

    -- Invoices Table (Sales / Billing)
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_gstin TEXT,
      customer_state TEXT,
      invoice_type TEXT NOT NULL DEFAULT 'TAX_INVOICE', -- 'TAX_INVOICE', 'BILL_OF_SUPPLY', 'QUOTATION', 'PROFORMA'
      place_of_supply TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      po_number TEXT,
      vehicle_number TEXT,
      e_way_bill_no TEXT,
      terms_conditions TEXT,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_total REAL NOT NULL DEFAULT 0,
      cgst_total REAL DEFAULT 0,
      sgst_total REAL DEFAULT 0,
      igst_total REAL DEFAULT 0,
      discount_total REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID', -- PAID, PARTIAL, UNPAID, OVERDUE
      payment_method TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_business_date ON invoices(business_id, invoice_date);

    -- Invoice Items Table
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id),
      item_name TEXT NOT NULL,
      hsn_code TEXT,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'PCS',
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      taxable_amount REAL NOT NULL,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

    -- Purchases Table (Purchases / Bills from Suppliers)
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      supplier_id TEXT REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      bill_number TEXT NOT NULL,
      bill_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      payment_method TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_business_date ON purchases(business_id, bill_date);

    -- Purchase Items Table
    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      tax_rate REAL DEFAULT 18,
      taxable_amount REAL NOT NULL,
      total_amount REAL NOT NULL
    );

    -- Expenses Table
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      description TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, expense_date);

    -- Payments Ledger (Cash & Bank Book)
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      direction TEXT NOT NULL, -- 'IN' (Received) or 'OUT' (Paid)
      entity_type TEXT NOT NULL, -- 'CUSTOMER', 'SUPPLIER', 'OTHER'
      entity_id TEXT,
      entity_name TEXT NOT NULL,
      invoice_id TEXT REFERENCES invoices(id),
      purchase_id TEXT REFERENCES purchases(id),
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL, -- 'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'
      reference_number TEXT,
      account_type TEXT NOT NULL DEFAULT 'BANK', -- 'CASH' or 'BANK'
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_business_date ON payments(business_id, payment_date);

    -- 5. Subscriptions Table (SaaS Monetization)
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL DEFAULT 'PRO',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      billing_cycle TEXT DEFAULT 'MONTHLY',
      max_invoices_per_month INTEGER DEFAULT 500,
      max_products INTEGER DEFAULT 1000,
      max_users INTEGER DEFAULT 5,
      current_period_start TEXT DEFAULT (datetime('now')),
      current_period_end TEXT DEFAULT (datetime('now', '+30 days')),
      razorpay_sub_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 6. Branches Table
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      branch_name TEXT NOT NULL,
      branch_code TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      phone TEXT,
      is_main INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 7. Sales Returns Table (Credit Notes)
    CREATE TABLE IF NOT EXISTS sales_returns (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      return_number TEXT NOT NULL,
      return_date TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_status TEXT DEFAULT 'COMPLETED',
      reason TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, return_number)
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      tax_rate REAL DEFAULT 18,
      taxable_amount REAL NOT NULL,
      total_amount REAL NOT NULL
    );

    -- 8. Purchase Returns Table (Debit Notes)
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      purchase_id TEXT REFERENCES purchases(id) ON DELETE SET NULL,
      return_number TEXT NOT NULL,
      return_date TEXT NOT NULL,
      supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
      supplier_name TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      refund_amount REAL NOT NULL DEFAULT 0,
      reason TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, return_number)
    );

    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      tax_rate REAL DEFAULT 18,
      taxable_amount REAL NOT NULL,
      total_amount REAL NOT NULL
    );

    -- 9. Public Shared Invoice Tokens
    CREATE TABLE IF NOT EXISTS public_invoice_tokens (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      share_token TEXT UNIQUE NOT NULL,
      expires_at TEXT,
      views_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_public_tokens_lookup ON public_invoice_tokens(share_token);

    -- 10. Device & Offline Sync Audit
    CREATE TABLE IF NOT EXISTS sync_audit (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      device_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      action TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      status TEXT DEFAULT 'SYNCED',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, operation_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sync_audit_op ON sync_audit(business_id, operation_id);
  `);

  // Safe runtime column migrations
  const safeAddColumn = (table: string, column: string, typeDef: string) => {
    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
    } catch {
      // Column likely already exists, ignore
    }
  };

  // Migrate existing refresh_tokens table if it uses legacy 'token' column instead of 'token_hash'
  try {
    const rtInfo = database.exec('PRAGMA table_info(refresh_tokens)');
    const rtCols = rtInfo[0]?.values || [];
    const hasTokenHash = rtCols.some((c) => c[1] === 'token_hash');
    const hasLegacyToken = rtCols.some((c) => c[1] === 'token');
    if (!hasTokenHash || hasLegacyToken) {
      database.run('DROP TABLE IF EXISTS refresh_tokens;');
      database.run(`
        CREATE TABLE refresh_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          device_info TEXT,
          ip_address TEXT,
          is_revoked INTEGER DEFAULT 0,
          revoked_at TEXT,
          replaced_by_token_hash TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup ON refresh_tokens(token_hash);
      `);
    }
  } catch (err) {
    console.warn('[Database] refresh_tokens migration warning:', err);
  }

  safeAddColumn('users', 'is_super_admin', 'INTEGER DEFAULT 0');
  safeAddColumn('businesses', 'quotation_prefix', "TEXT DEFAULT 'EST'");
  safeAddColumn('businesses', 'quotation_next_number', 'INTEGER DEFAULT 1001');
  safeAddColumn('businesses', 'return_next_number', 'INTEGER DEFAULT 1001');
  safeAddColumn('products', 'brand', 'TEXT');
  safeAddColumn('products', 'image_url', 'TEXT');

  // Migrate existing audit_logs table if entity_type is missing or entity_name is strict NOT NULL without default
  try {
    const infoRes = database.exec('PRAGMA table_info(audit_logs)');
    const cols = infoRes[0]?.values || [];
    const hasEntityType = cols.some((c) => c[1] === 'entity_type');
    const entityNameCol = cols.find((c) => c[1] === 'entity_name');
    const entityNameStrictNotNull = Boolean(entityNameCol && entityNameCol[3] === 1 && entityNameCol[4] === null);

    if (!hasEntityType || entityNameStrictNotNull) {
      database.run(`
        CREATE TABLE IF NOT EXISTS audit_logs_new (
          id TEXT PRIMARY KEY,
          business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          user_email TEXT,
          action TEXT NOT NULL,
          entity_type TEXT DEFAULT 'SYSTEM',
          entity_name TEXT DEFAULT 'SYSTEM',
          entity_id TEXT,
          details TEXT DEFAULT '{}',
          ip_address TEXT,
          user_agent TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      if (hasEntityType) {
        database.run(`
          INSERT INTO audit_logs_new (id, business_id, user_id, user_email, action, entity_type, entity_name, entity_id, details, ip_address, user_agent, created_at)
          SELECT id, business_id, user_id, user_email, action, COALESCE(entity_type, entity_name, 'SYSTEM'), COALESCE(entity_name, entity_type, 'SYSTEM'), entity_id, details, ip_address, user_agent, created_at
          FROM audit_logs;
        `);
      } else {
        database.run(`
          INSERT INTO audit_logs_new (id, business_id, user_id, user_email, action, entity_type, entity_name, entity_id, details, ip_address, user_agent, created_at)
          SELECT id, business_id, user_id, user_email, action, COALESCE(entity_name, 'SYSTEM'), COALESCE(entity_name, 'SYSTEM'), entity_id, details, ip_address, user_agent, created_at
          FROM audit_logs;
        `);
      }
      database.run('DROP TABLE audit_logs;');
      database.run('ALTER TABLE audit_logs_new RENAME TO audit_logs;');
      database.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at);');
    }
  } catch (err) {
    console.warn('[Database] Audit logs migration fallback:', err);
    safeAddColumn('audit_logs', 'entity_type', "TEXT DEFAULT 'SYSTEM'");
    safeAddColumn('audit_logs', 'entity_name', "TEXT DEFAULT 'SYSTEM'");
  }

  safeAddColumn('sync_audit', 'error_message', 'TEXT');

  safeAddColumn('invoices', 'invoice_type', "TEXT NOT NULL DEFAULT 'TAX_INVOICE'");
  safeAddColumn('invoices', 'place_of_supply', 'TEXT');
  safeAddColumn('invoices', 'billing_address', 'TEXT');
  safeAddColumn('invoices', 'shipping_address', 'TEXT');
  safeAddColumn('invoices', 'po_number', 'TEXT');
  safeAddColumn('invoices', 'vehicle_number', 'TEXT');
  safeAddColumn('invoices', 'e_way_bill_no', 'TEXT');
  safeAddColumn('invoices', 'terms_conditions', 'TEXT');

  // Purchase migrations
  safeAddColumn('purchases', 'supplier_gstin', 'TEXT');
  safeAddColumn('purchases', 'supplier_state', 'TEXT');
  safeAddColumn('purchases', 'cgst_total', 'REAL DEFAULT 0');
  safeAddColumn('purchases', 'sgst_total', 'REAL DEFAULT 0');
  safeAddColumn('purchases', 'igst_total', 'REAL DEFAULT 0');
  safeAddColumn('purchases', 'discount_total', 'REAL DEFAULT 0');
  safeAddColumn('purchases', 'round_off', 'REAL DEFAULT 0');
  safeAddColumn('purchases', 'notes', 'TEXT');
  safeAddColumn('purchases', 'due_date', 'TEXT');

  // Purchase items migrations
  safeAddColumn('purchase_items', 'hsn_code', 'TEXT');
  safeAddColumn('purchase_items', 'unit', "TEXT DEFAULT 'PCS'");
  safeAddColumn('purchase_items', 'discount_percent', 'REAL DEFAULT 0');
  safeAddColumn('purchase_items', 'cgst_amount', 'REAL DEFAULT 0');
  safeAddColumn('purchase_items', 'sgst_amount', 'REAL DEFAULT 0');
  safeAddColumn('purchase_items', 'igst_amount', 'REAL DEFAULT 0');

  // Expenses migrations
  safeAddColumn('expenses', 'vendor_name', 'TEXT');
  safeAddColumn('expenses', 'gstin', 'TEXT');
  safeAddColumn('expenses', 'tax_rate', 'REAL DEFAULT 0');
  safeAddColumn('expenses', 'taxable_amount', 'REAL DEFAULT 0');
  safeAddColumn('expenses', 'gst_amount', 'REAL DEFAULT 0');
  safeAddColumn('expenses', 'is_itc_eligible', 'INTEGER DEFAULT 1');
  safeAddColumn('expenses', 'reference_no', 'TEXT');

  // Business banking, UPI, and branding migrations
  safeAddColumn('businesses', 'bank_name', 'TEXT');
  safeAddColumn('businesses', 'bank_account_no', 'TEXT');
  safeAddColumn('businesses', 'bank_ifsc', 'TEXT');
  safeAddColumn('businesses', 'bank_branch', 'TEXT');
  safeAddColumn('businesses', 'upi_id', 'TEXT');
  safeAddColumn('businesses', 'signature_url', 'TEXT');
}

/**
 * Seed initial development data if no users exist.
 */
async function seedInitialData(database: Database): Promise<void> {
  const userCount = database.exec('SELECT COUNT(*) as count FROM users');
  const count = userCount[0]?.values[0]?.[0] as number;

  if (count > 0) return;

  console.log('[Database] Seeding initial development tenant data...');

  const passwordHash = await bcrypt.hash('Demo@12345', 10);
  const now = new Date().toISOString();

  // 1. Primary Demo User (Business Owner)
  const ownerId = uuidv4();
  database.run(
    `INSERT INTO users (id, full_name, email, phone, password_hash, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [ownerId, 'Harsh Patel', 'demo@billflow.in', '+91 9876543210', passwordHash, now, now]
  );

  // 2. Secondary Staff User (Salesperson)
  const staffId = uuidv4();
  database.run(
    `INSERT INTO users (id, full_name, email, phone, password_hash, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [staffId, 'Rahul Verma', 'staff@billflow.in', '+91 9876543211', passwordHash, now, now]
  );

  // 3. Primary Business Tenant: "Om Sai Traders" (Retail & Wholesale)
  const business1Id = uuidv4();
  database.run(
    `INSERT INTO businesses (
      id, owner_id, business_name, legal_name, business_type, business_category,
      gstin, pan, phone, email, address_line1, city, state, state_code, pincode,
      currency, invoice_prefix, invoice_next_number, terms_and_conditions, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      business1Id,
      ownerId,
      'Om Sai Traders',
      'Om Sai Traders Private Limited',
      'Retail & Wholesale',
      'General Store / FMCG',
      '27AABCU9603R1ZM',
      'AABCU9603R',
      '+91 9876543210',
      'contact@om-saitraders.in',
      'Shop No. 12, Commercial Market, Lamington Road',
      'Mumbai',
      'Maharashtra',
      '27',
      '400001',
      'INR',
      'OST-26',
      1001,
      '1. Goods once sold will not be taken back.\n2. Subject to Mumbai jurisdiction only.\n3. Interest @18% p.a. will be charged after due date.',
      now,
      now,
    ]
  );

  // 4. Secondary Business Tenant: "Apex Tech Supplies" (Electronics / IT)
  const business2Id = uuidv4();
  database.run(
    `INSERT INTO businesses (
      id, owner_id, business_name, legal_name, business_type, business_category,
      gstin, pan, phone, email, address_line1, city, state, state_code, pincode,
      currency, invoice_prefix, invoice_next_number, terms_and_conditions, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      business2Id,
      ownerId,
      'Apex Tech Supplies',
      'Apex Tech Solutions LLP',
      'Distributor',
      'Electronics & Hardware',
      '29ABCDE1234F1Z5',
      'ABCDE1234F',
      '+91 8012345678',
      'accounts@apextech.in',
      'Block 4, Industrial IT Corridor, Electronic City',
      'Bengaluru',
      'Karnataka',
      '29',
      '560100',
      'INR',
      'ATS-26',
      501,
      '1. Manufacturer warranty applies to all electronic goods.\n2. E-way bill required for consignments exceeding 50,000 INR.\n3. Bengaluru jurisdiction.',
      now,
      now,
    ]
  );

  // 5. Link Owner to Both Businesses
  database.run(
    `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
     VALUES (?, ?, ?, 'OWNER', 1, ?)`,
    [uuidv4(), business1Id, ownerId, now]
  );

  database.run(
    `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
     VALUES (?, ?, ?, 'OWNER', 1, ?)`,
    [uuidv4(), business2Id, ownerId, now]
  );

  // 6. Link Staff to Only Business 1 as SALESPERSON (to demonstrate RBAC & tenant isolation)
  database.run(
    `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
     VALUES (?, ?, ?, 'SALESPERSON', 1, ?)`,
    [uuidv4(), business1Id, staffId, now]
  );

  // 7. SaaS Subscriptions
  database.run(
    `INSERT INTO subscriptions (id, business_id, plan_id, status, billing_cycle, max_invoices_per_month, max_products, max_users, current_period_start, current_period_end)
     VALUES (?, ?, 'BUSINESS', 'ACTIVE', 'ANNUAL', 5000, 10000, 20, ?, ?)`,
    [uuidv4(), business1Id, now, new Date(Date.now() + 365 * 86400000).toISOString()]
  );
  database.run(
    `INSERT INTO subscriptions (id, business_id, plan_id, status, billing_cycle, max_invoices_per_month, max_products, max_users, current_period_start, current_period_end)
     VALUES (?, ?, 'PRO', 'ACTIVE', 'MONTHLY', 1000, 2500, 5, ?, ?)`,
    [uuidv4(), business2Id, now, new Date(Date.now() + 30 * 86400000).toISOString()]
  );

  // 8. Branches
  database.run(
    `INSERT INTO branches (id, business_id, branch_name, branch_code, address, city, state, pincode, phone, is_main, is_active, created_at)
     VALUES (?, ?, 'Main Head Office & Retail Outlet', 'HQ-01', 'Shop No. 12, Commercial Market, Lamington Road', 'Mumbai', 'Maharashtra', '400001', '+91 9876543210', 1, 1, ?)`,
    [uuidv4(), business1Id, now]
  );
  database.run(
    `INSERT INTO branches (id, business_id, branch_name, branch_code, address, city, state, pincode, phone, is_main, is_active, created_at)
     VALUES (?, ?, 'Electronic City Distribution Hub', 'EC-01', 'Block 4, Industrial IT Corridor, Electronic City', 'Bengaluru', 'Karnataka', '560100', '+91 8012345678', 1, 1, ?)`,
    [uuidv4(), business2Id, now]
  );

  // 9. Initial Audit Log
  database.run(
    `INSERT INTO audit_logs (id, business_id, user_id, user_email, action, entity_name, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, 'SYSTEM_SEED', 'business', ?, ?, '127.0.0.1', ?)`,
    [
      uuidv4(),
      business1Id,
      ownerId,
      'demo@billflow.in',
      business1Id,
      JSON.stringify({ message: 'Seed business and demo owner provisioned' }),
      now,
    ]
  );

  console.log('[Database] Seed completed successfully with 2 businesses and 2 users.');
}

/**
 * Seeds rich commerce records (products, customers, suppliers, invoices, purchases, expenses, payments)
 * so that Dashboard metrics, graphs, and low-stock alerts immediately have real, live relational data.
 */
async function seedCommerceData(database: Database): Promise<void> {
  const productCountRes = database.exec('SELECT COUNT(*) as count FROM products');
  const prodCount = productCountRes[0]?.values[0]?.[0] as number;
  if (prodCount > 0) return;

  const businesses = database.exec('SELECT id, business_name, owner_id FROM businesses');
  if (!businesses[0] || businesses[0].values.length === 0) return;

  console.log('[Database] Seeding commerce transactions and inventory data...');

  const bizRows = businesses[0].values;
  const b1 = bizRows[0]; // Om Sai Traders
  const b1Id = b1[0] as string;
  const b1Owner = b1[2] as string;

  // Helper date generators relative to today
  const getRelativeDate = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 86400000);
    return d.toISOString().split('T')[0];
  };

  const todayStr = getRelativeDate(0);
  const yesterdayStr = getRelativeDate(1);
  const threeDaysAgoStr = getRelativeDate(3);
  const fiveDaysAgoStr = getRelativeDate(5);
  const tenDaysAgoStr = getRelativeDate(10);
  const twentyDaysAgoStr = getRelativeDate(20);
  const thirtyFiveDaysAgoStr = getRelativeDate(35);

  // 1. PRODUCTS FOR OM SAI TRADERS
  const p1 = { id: uuidv4(), name: 'Basmati Rice Classic 25kg', sku: 'RICE-BAS-25', hsn: '1006', cat: 'Grains & Pulses', unit: 'BAG', buy: 1800, sell: 2250, mrp: 2400, tax: 5, stock: 42, min: 15 };
  const p2 = { id: uuidv4(), name: 'Fortune Refined Sunflower Oil 5L', sku: 'OIL-SUN-5L', hsn: '1512', cat: 'Edible Oils', unit: 'CAN', buy: 520, sell: 640, mrp: 680, tax: 5, stock: 12, min: 25 }; // LOW STOCK!
  const p3 = { id: uuidv4(), name: 'Tata Tea Gold 1kg', sku: 'TEA-TAT-1KG', hsn: '0902', cat: 'Beverages', unit: 'PKT', buy: 410, sell: 490, mrp: 520, tax: 5, stock: 8, min: 20 }; // LOW STOCK!
  const p4 = { id: uuidv4(), name: 'Toor Dal Premium Unpolished 10kg', sku: 'DAL-TUR-10', hsn: '0713', cat: 'Grains & Pulses', unit: 'BAG', buy: 1100, sell: 1350, mrp: 1450, tax: 5, stock: 35, min: 10 };
  const p5 = { id: uuidv4(), name: 'Aashirvaad Shudh Chakki Atta 10kg', sku: 'ATT-ASH-10', hsn: '1101', cat: 'Flour & Atta', unit: 'BAG', buy: 360, sell: 430, mrp: 460, tax: 5, stock: 5, min: 15 }; // LOW STOCK!
  const p6 = { id: uuidv4(), name: 'Surf Excel Matic Detergent 4kg', sku: 'DET-SUR-4KG', hsn: '3402', cat: 'Household Care', unit: 'BOX', buy: 720, sell: 890, mrp: 950, tax: 18, stock: 28, min: 10 };
  const p7 = { id: uuidv4(), name: 'Cadbury Dairy Milk Silk 150g', sku: 'CHO-CAD-SLK', hsn: '1806', cat: 'Confectionery', unit: 'PCS', buy: 125, sell: 165, mrp: 175, tax: 18, stock: 65, min: 20 };
  const p8 = { id: uuidv4(), name: 'Parle-G Gold Biscuits Carton', sku: 'BIS-PAR-BOX', hsn: '1905', cat: 'Biscuits & Snacks', unit: 'BOX', buy: 110, sell: 140, mrp: 150, tax: 12, stock: 52, min: 20 };

  const allProducts = [p1, p2, p3, p4, p5, p6, p7, p8];
  for (const prod of allProducts) {
    database.run(
      `INSERT INTO products (id, business_id, name, sku, hsn_code, category, unit, purchase_price, selling_price, mrp, tax_rate, current_stock, min_stock_alert, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [prod.id, b1Id, prod.name, prod.sku, prod.hsn, prod.cat, prod.unit, prod.buy, prod.sell, prod.mrp, prod.tax, prod.stock, prod.min]
    );
  }

  // 2. CUSTOMERS FOR OM SAI TRADERS
  const c1 = { id: uuidv4(), name: 'Sharma Supermarket', phone: '+91 9820112233', gstin: '27AABCS1234F1Z8', city: 'Mumbai', state: 'Maharashtra', code: '27', due: 18450 };
  const c2 = { id: uuidv4(), name: 'Priya Kirana Stores', phone: '+91 9820223344', gstin: '27BCDPS5678E1Z4', city: 'Thane', state: 'Maharashtra', code: '27', due: 6200 };
  const c3 = { id: uuidv4(), name: 'Mehta General Traders', phone: '+91 9820334455', gstin: '27CDEPM9012D1Z2', city: 'Mumbai', state: 'Maharashtra', code: '27', due: 0 };
  const c4 = { id: uuidv4(), name: 'Gupta Daily Mart', phone: '+91 9820445566', gstin: '27DEFG0123C1Z0', city: 'Navi Mumbai', state: 'Maharashtra', code: '27', due: 12800 };

  for (const c of [c1, c2, c3, c4]) {
    database.run(
      `INSERT INTO customers (id, business_id, name, phone, gstin, city, state, state_code, current_balance, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [c.id, b1Id, c.name, c.phone, c.gstin, c.city, c.state, c.code, c.due]
    );
  }

  // 3. SUPPLIERS FOR OM SAI TRADERS
  const s1 = { id: uuidv4(), name: 'Adani Wilmar Ltd - Depot', phone: '+91 2266778899', gstin: '27AABCA5555M1Z1', city: 'Mumbai', state: 'Maharashtra', code: '27', due: 45000 };
  const s2 = { id: uuidv4(), name: 'India Gate Rice Exporters', phone: '+91 2244556677', gstin: '27BCDEI9999K1Z3', city: 'Mumbai', state: 'Maharashtra', code: '27', due: 28500 };
  const s3 = { id: uuidv4(), name: 'Tata Consumer Products Ltd', phone: '+91 2233445566', gstin: '27CDEFT1111P1Z9', city: 'Mumbai', state: 'Maharashtra', code: '27', due: 15200 };

  for (const s of [s1, s2, s3]) {
    database.run(
      `INSERT INTO suppliers (id, business_id, name, phone, gstin, city, state, state_code, current_balance, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [s.id, b1Id, s.name, s.phone, s.gstin, s.city, s.state, s.code, s.due]
    );
  }

  // 4. INVOICES (Sales across today, yesterday, this week, this month, last month)
  const invoicesData = [
    // Today
    { id: uuidv4(), num: 'OST-26-1011', date: todayStr, cust: c1, total: 14250, paid: 10000, due: 4250, status: 'PARTIAL', mode: 'UPI', items: [{ p: p1, q: 4, rate: 2250 }, { p: p2, q: 5, rate: 640 }, { p: p3, q: 4, rate: 490 }] },
    { id: uuidv4(), num: 'OST-26-1012', date: todayStr, cust: c3, total: 6850, paid: 6850, due: 0, status: 'PAID', mode: 'CASH', items: [{ p: p4, q: 3, rate: 1350 }, { p: p5, q: 4, rate: 430 }, { p: p7, q: 6, rate: 165 }] },
    // Yesterday
    { id: uuidv4(), num: 'OST-26-1009', date: yesterdayStr, cust: c2, total: 9600, paid: 9600, due: 0, status: 'PAID', mode: 'UPI', items: [{ p: p1, q: 3, rate: 2250 }, { p: p2, q: 4, rate: 640 }] },
    { id: uuidv4(), num: 'OST-26-1010', date: yesterdayStr, cust: c4, total: 18400, paid: 10000, due: 8400, status: 'PARTIAL', mode: 'BANK_TRANSFER', items: [{ p: p4, q: 8, rate: 1350 }, { p: p6, q: 6, rate: 890 }] },
    // 3 Days Ago (This Week)
    { id: uuidv4(), num: 'OST-26-1007', date: threeDaysAgoStr, cust: c3, total: 24800, paid: 24800, due: 0, status: 'PAID', mode: 'CHEQUE', items: [{ p: p1, q: 8, rate: 2250 }, { p: p4, q: 5, rate: 1350 }] },
    { id: uuidv4(), num: 'OST-26-1008', date: threeDaysAgoStr, cust: c1, total: 8400, paid: 4200, due: 4200, status: 'PARTIAL', mode: 'UPI', items: [{ p: p2, q: 10, rate: 640 }, { p: p3, q: 4, rate: 490 }] },
    // 5 Days Ago
    { id: uuidv4(), num: 'OST-26-1005', date: fiveDaysAgoStr, cust: c2, total: 12500, paid: 12500, due: 0, status: 'PAID', mode: 'UPI', items: [{ p: p6, q: 10, rate: 890 }, { p: p7, q: 15, rate: 165 }] },
    { id: uuidv4(), num: 'OST-26-1006', date: fiveDaysAgoStr, cust: c4, total: 16800, paid: 12400, due: 4400, status: 'PARTIAL', mode: 'BANK_TRANSFER', items: [{ p: p1, q: 6, rate: 2250 }, { p: p5, q: 6, rate: 430 }] },
    // 10 Days Ago
    { id: uuidv4(), num: 'OST-26-1003', date: tenDaysAgoStr, cust: c1, total: 32600, paid: 22600, due: 10000, status: 'PARTIAL', mode: 'UPI', items: [{ p: p1, q: 10, rate: 2250 }, { p: p4, q: 6, rate: 1350 }] },
    { id: uuidv4(), num: 'OST-26-1004', date: tenDaysAgoStr, cust: c2, total: 14200, paid: 14200, due: 0, status: 'PAID', mode: 'CASH', items: [{ p: p2, q: 12, rate: 640 }, { p: p3, q: 10, rate: 490 }] },
    // 20 Days Ago
    { id: uuidv4(), num: 'OST-26-1001', date: twentyDaysAgoStr, cust: c4, total: 29500, paid: 29500, due: 0, status: 'PAID', mode: 'BANK_TRANSFER', items: [{ p: p1, q: 10, rate: 2250 }, { p: p6, q: 7, rate: 890 }] },
    { id: uuidv4(), num: 'OST-26-1002', date: twentyDaysAgoStr, cust: c3, total: 11200, paid: 11200, due: 0, status: 'PAID', mode: 'CHEQUE', items: [{ p: p4, q: 6, rate: 1350 }, { p: p8, q: 20, rate: 140 }] },
    // 35 Days Ago (Last Month)
    { id: uuidv4(), num: 'OST-26-0980', date: thirtyFiveDaysAgoStr, cust: c4, total: 42000, paid: 42000, due: 0, status: 'PAID', mode: 'BANK_TRANSFER', items: [{ p: p1, q: 14, rate: 2250 }, { p: p4, q: 6, rate: 1350 }] },
    { id: uuidv4(), num: 'OST-26-0981', date: thirtyFiveDaysAgoStr, cust: c1, total: 28500, paid: 28500, due: 0, status: 'PAID', mode: 'UPI', items: [{ p: p2, q: 25, rate: 640 }, { p: p3, q: 20, rate: 490 }] },
    { id: uuidv4(), num: 'OST-26-0982', date: thirtyFiveDaysAgoStr, cust: c2, total: 19800, paid: 19800, due: 0, status: 'PAID', mode: 'CASH', items: [{ p: p6, q: 15, rate: 890 }, { p: p7, q: 30, rate: 165 }] },
  ];

  for (const inv of invoicesData) {
    database.run(
      `INSERT INTO invoices (
        id, business_id, customer_id, customer_name, customer_phone, customer_gstin,
        customer_state, invoice_number, invoice_date, subtotal, tax_total, cgst_total,
        sgst_total, grand_total, paid_amount, balance_due, payment_status, payment_method, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id, b1Id, inv.cust.id, inv.cust.name, inv.cust.phone, inv.cust.gstin,
        inv.cust.state, inv.num, inv.date, inv.total * 0.95, inv.total * 0.05,
        inv.total * 0.025, inv.total * 0.025, inv.total, inv.paid, inv.due,
        inv.status, inv.mode, b1Owner,
      ]
    );

    for (const it of inv.items) {
      const lineTotal = it.q * it.rate;
      database.run(
        `INSERT INTO invoice_items (
          id, invoice_id, product_id, item_name, hsn_code, quantity, unit,
          unit_price, tax_rate, taxable_amount, cgst_amount, sgst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), inv.id, it.p.id, it.p.name, it.p.hsn, it.q, it.p.unit,
          it.rate, it.p.tax, lineTotal * 0.95, lineTotal * 0.025, lineTotal * 0.025, lineTotal,
        ]
      );
    }
  }

  // 5. PURCHASES (Procurement across dates)
  const purchasesData = [
    { id: uuidv4(), supp: s1, num: 'AW-2026-889', date: todayStr, total: 18500, paid: 18500, due: 0, status: 'PAID', mode: 'BANK_TRANSFER' },
    { id: uuidv4(), supp: s2, num: 'IGR-26-401', date: threeDaysAgoStr, total: 35000, paid: 20000, due: 15000, status: 'PARTIAL', mode: 'BANK_TRANSFER' },
    { id: uuidv4(), supp: s3, num: 'TCP-6721', date: fiveDaysAgoStr, total: 14200, paid: 14200, due: 0, status: 'PAID', mode: 'UPI' },
    { id: uuidv4(), supp: s1, num: 'AW-2026-612', date: twentyDaysAgoStr, total: 42000, paid: 25000, due: 17000, status: 'PARTIAL', mode: 'BANK_TRANSFER' },
    { id: uuidv4(), supp: s2, num: 'IGR-26-198', date: thirtyFiveDaysAgoStr, total: 58000, paid: 58000, due: 0, status: 'PAID', mode: 'BANK_TRANSFER' },
  ];

  for (const pur of purchasesData) {
    database.run(
      `INSERT INTO purchases (
        id, business_id, supplier_id, supplier_name, bill_number, bill_date,
        subtotal, tax_total, grand_total, paid_amount, balance_due, payment_status, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pur.id, b1Id, pur.supp.id, pur.supp.name, pur.num, pur.date,
        pur.total * 0.95, pur.total * 0.05, pur.total, pur.paid, pur.due,
        pur.status, pur.mode,
      ]
    );
  }

  // 6. EXPENSES (Operational overheads)
  const expensesData = [
    { cat: 'Electricity', amount: 1850, date: todayStr, method: 'UPI', desc: 'Shop monthly electricity bill' },
    { cat: 'Tea & Refreshments', amount: 320, date: todayStr, method: 'CASH', desc: 'Daily chai & biscuits for staff and customers' },
    { cat: 'Staff Salary', amount: 900, date: yesterdayStr, method: 'CASH', desc: 'Daily helper overtime payment' },
    { cat: 'Logistics', amount: 2400, date: threeDaysAgoStr, method: 'UPI', desc: 'Tempo freight delivery charges' },
    { cat: 'Rent', amount: 25000, date: tenDaysAgoStr, method: 'BANK_TRANSFER', desc: 'Shop commercial rent' },
    { cat: 'Packaging', amount: 3600, date: twentyDaysAgoStr, method: 'CASH', desc: 'Cartons, tapes & plastic bags' },
    { cat: 'Rent', amount: 25000, date: thirtyFiveDaysAgoStr, method: 'BANK_TRANSFER', desc: 'Previous month shop rent' },
    { cat: 'Staff Salary', amount: 32000, date: thirtyFiveDaysAgoStr, method: 'BANK_TRANSFER', desc: 'Monthly store manager & accountant wages' },
    { cat: 'Electricity', amount: 4850, date: thirtyFiveDaysAgoStr, method: 'UPI', desc: 'Previous month power consumption' },
  ];

  for (const exp of expensesData) {
    database.run(
      `INSERT INTO expenses (id, business_id, category, amount, expense_date, payment_method, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), b1Id, exp.cat, exp.amount, exp.date, exp.method, exp.desc, b1Owner]
    );
  }

  // 7. PAYMENTS LEDGER (Cash and Bank inflows/outflows for authentic balance calculation)
  // Cash Book
  database.run(
    `INSERT INTO payments (id, business_id, direction, entity_type, entity_name, amount, payment_mode, account_type, payment_date, notes)
     VALUES (?, ?, 'IN', 'OTHER', 'Opening Cash Float', 45000, 'CASH', 'CASH', ?, 'Initial store cash drawer float')`,
    [uuidv4(), b1Id, thirtyFiveDaysAgoStr]
  );
  database.run(
    `INSERT INTO payments (id, business_id, direction, entity_type, entity_name, amount, payment_mode, account_type, payment_date, notes)
     VALUES (?, ?, 'IN', 'OTHER', 'Opening Bank Balance', 285000, 'BANK_TRANSFER', 'BANK', ?, 'HDFC Current A/c opening balance')`,
    [uuidv4(), b1Id, thirtyFiveDaysAgoStr]
  );

  // Inward customer receipts
  for (const inv of invoicesData) {
    if (inv.paid > 0) {
      database.run(
        `INSERT INTO payments (id, business_id, direction, entity_type, entity_id, entity_name, invoice_id, amount, payment_mode, account_type, payment_date, notes)
         VALUES (?, ?, 'IN', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), b1Id, inv.cust.id, inv.cust.name, inv.id, inv.paid, inv.mode,
          inv.mode === 'CASH' ? 'CASH' : 'BANK', inv.date, `Payment received for ${inv.num}`
        ]
      );
    }
  }

  // Outward supplier disbursements
  for (const pur of purchasesData) {
    if (pur.paid > 0) {
      database.run(
        `INSERT INTO payments (id, business_id, direction, entity_type, entity_id, entity_name, purchase_id, amount, payment_mode, account_type, payment_date, notes)
         VALUES (?, ?, 'OUT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), b1Id, pur.supp.id, pur.supp.name, pur.id, pur.paid, pur.mode,
          pur.mode === 'CASH' ? 'CASH' : 'BANK', pur.date, `Disbursement for bill ${pur.num}`
        ]
      );
    }
  }

  // Outward expense entries
  for (const exp of expensesData) {
    database.run(
      `INSERT INTO payments (id, business_id, direction, entity_type, entity_name, amount, payment_mode, account_type, payment_date, notes)
       VALUES (?, ?, 'OUT', 'OTHER', ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), b1Id, `Expense: ${exp.cat}`, exp.amount, exp.method,
        exp.method === 'CASH' ? 'CASH' : 'BANK', exp.date, exp.desc
      ]
    );
  }

  // 8. If second business (Apex Tech Supplies) exists, seed a few records for it as well
  if (bizRows.length > 1) {
    const b2 = bizRows[1];
    const b2Id = b2[0] as string;
    const b2Owner = b2[2] as string;

    const ap1 = { id: uuidv4(), name: 'ThinkPad T14 Gen 4 Core i7 16GB', sku: 'LAP-TP-T14', hsn: '8471', cat: 'Laptops', unit: 'PCS', buy: 72000, sell: 88500, mrp: 95000, tax: 18, stock: 14, min: 5 };
    const ap2 = { id: uuidv4(), name: 'Samsung 980 Pro 1TB NVMe PCIe 4.0 SSD', sku: 'SSD-SAM-1TB', hsn: '8471', cat: 'Storage', unit: 'PCS', buy: 6800, sell: 8900, mrp: 9500, tax: 18, stock: 3, min: 10 }; // LOW STOCK!
    const ap3 = { id: uuidv4(), name: 'Dell UltraSharp 27" 4K USB-C Monitor', sku: 'MON-DEL-27U', hsn: '8528', cat: 'Displays', unit: 'PCS', buy: 34000, sell: 42000, mrp: 46000, tax: 18, stock: 8, min: 4 };

    for (const prod of [ap1, ap2, ap3]) {
      database.run(
        `INSERT INTO products (id, business_id, name, sku, hsn_code, category, unit, purchase_price, selling_price, mrp, tax_rate, current_stock, min_stock_alert, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [prod.id, b2Id, prod.name, prod.sku, prod.hsn, prod.cat, prod.unit, prod.buy, prod.sell, prod.mrp, prod.tax, prod.stock, prod.min]
      );
    }

    const ac1 = { id: uuidv4(), name: 'Infosys Cloud Labs', phone: '+91 8028520261', gstin: '29AAACI1234F1Z9', city: 'Bengaluru', state: 'Karnataka', code: '29', due: 88500 };
    database.run(
      `INSERT INTO customers (id, business_id, name, phone, gstin, city, state, state_code, current_balance, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [ac1.id, b2Id, ac1.name, ac1.phone, ac1.gstin, ac1.city, ac1.state, ac1.code, ac1.due]
    );

    database.run(
      `INSERT INTO invoices (
        id, business_id, customer_id, customer_name, customer_phone, customer_gstin,
        customer_state, invoice_number, invoice_date, subtotal, tax_total, cgst_total,
        sgst_total, grand_total, paid_amount, balance_due, payment_status, payment_method, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), b2Id, ac1.id, ac1.name, ac1.phone, ac1.gstin, ac1.state,
        'ATS-26-0501', todayStr, 75000, 13500, 6750, 6750, 88500, 0, 88500,
        'UNPAID', 'CREDIT', b2Owner,
      ]
    );
  }

  console.log('[Database] Commerce seeding completed with products, invoices, purchases & ledger.');
}
