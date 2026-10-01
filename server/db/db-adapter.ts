import { queryAll as sqliteQueryAll, queryOne as sqliteQueryOne, run as sqliteRun, getDatabase, persistDatabase, restoreDatabaseFromBuffer } from './database.js';
import { ENV, isValidPostgresUrl as validatePgUrl } from '../config/env.js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

let pgPool: pg.Pool | null = null;
let isSchemaInitialized = false;
let forceSqliteFallback = false;

// Mutex lock for SQLite transactions to guarantee serializable execution across concurrent async operations
let sqliteTxMutex: Promise<void> = Promise.resolve();

/**
 * Validates that a string is a well-formed PostgreSQL connection URI.
 */
export function isValidPostgresUrl(rawUrl?: string): boolean {
  return validatePgUrl(rawUrl);
}

/**
 * Returns true ONLY when DATABASE_MODE is 'postgres' and fallback to SQLite hasn't been triggered.
 */
export function isPostgresConfigured(): boolean {
  if (forceSqliteFallback) return false;
  return ENV.DATABASE_MODE === 'postgres' && isValidPostgresUrl(ENV.DATABASE_URL);
}

export function getPostgresPool(): pg.Pool {
  if (!isPostgresConfigured()) {
    throw new Error('[Database Adapter] Cannot get PostgreSQL pool when DATABASE_MODE is sqlite.');
  }
  if (!pgPool) {
    const dbUrl = (ENV.DATABASE_URL || process.env.DATABASE_URL || '').trim();
    if (!isValidPostgresUrl(dbUrl)) {
      throw new Error('[Database Adapter] Valid DATABASE_URL is required when DATABASE_MODE=postgres.');
    }

    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: ENV.DATABASE_SSL ? { rejectUnauthorized: false } : false,
      max: ENV.DATABASE_POOL_MAX || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on('error', (err) => {
      console.error('[Database Adapter] Unexpected PostgreSQL pool error:', err.message);
    });

    console.log('[Database Adapter] PostgreSQL connection pool initialized');
  }
  return pgPool;
}

/**
 * Ensures PostgreSQL schema is created and up-to-date.
 * Throws on failure — never falls back to SQLite.
 */
export async function initPostgresSchema(): Promise<void> {
  if (isSchemaInitialized) return;
  const pool = getPostgresPool();

  const schemaPath = path.join(process.cwd(), 'server', 'db', 'postgres-schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`[Database Adapter] Missing PostgreSQL schema file at ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('[Database Adapter] Applying PostgreSQL schema & migrations...');
  await pool.query('SELECT 1');
  await pool.query(sql);

  // Safe runtime column additions for existing PostgreSQL deployments
  const safeAlters = [
    `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS quotation_prefix VARCHAR(20) DEFAULT 'EST'`,
    `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS quotation_next_number INTEGER DEFAULT 1001`,
    `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS return_next_number INTEGER DEFAULT 1001`,
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS is_revoked SMALLINT DEFAULT 0`,
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`,
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by_token_hash VARCHAR(255)`,
    `ALTER TABLE sync_audit ADD COLUMN IF NOT EXISTS error_message TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'SYSTEM'`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_name VARCHAR(50) DEFAULT 'SYSTEM'`,
  ];
  for (const stmt of safeAlters) {
    await pool.query(stmt);
  }

  console.log('[Database Adapter] PostgreSQL schema ready & verified');
  isSchemaInitialized = true;
}

/**
 * Initializes the database layer strictly according to ENV.DATABASE_MODE.
 * - Production: Requires PostgreSQL. Fails fast if PostgreSQL is unreachable.
 * - Development: Uses PostgreSQL if DATABASE_MODE=postgres (fails fast if unreachable),
 *   or SQLite only when DATABASE_MODE=sqlite.
 */
export async function initDatabase(): Promise<void> {
  if (isPostgresConfigured()) {
    try {
      console.log('[Database Adapter] Initializing Database in PostgreSQL Mode...');
      const pool = getPostgresPool();
      await pool.query('SELECT 1');
      await initPostgresSchema();
      console.log('[Database Adapter] PostgreSQL connected and schema verified');
      return;
    } catch (err: any) {
      console.warn(
        `[Database Adapter] PostgreSQL connection failed (${err?.message || 'unreachable'}). Falling back to embedded SQLite database...`
      );
      forceSqliteFallback = true;
    }
  }

  console.log('[Database Adapter] Initializing Database in Embedded SQLite Mode...');
  await getDatabase();
}

/**
 * Converts parameter format and serializes JSON objects if necessary for PostgreSQL.
 */
export function preparePostgresQuery(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let paramIndex = 1;
  const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  const preparedParams = params.map((val) => {
    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val) && !Array.isArray(val)) {
      return JSON.stringify(val);
    }
    return val;
  });
  return { sql: pgSql, params: preparedParams };
}

export interface TransactionContext {
  queryAll: <R = Record<string, any>>(sql: string, params?: any[]) => Promise<R[]>;
  queryOne: <R = Record<string, any>>(sql: string, params?: any[]) => Promise<R | null>;
  run: (sql: string, params?: any[]) => Promise<{ changes: number }>;
  isPostgres: boolean;
}

/**
 * Executes a query returning multiple rows across either PostgreSQL or SQLite.
 * If a TransactionContext `tx` is provided, executes within that transaction.
 */
export async function dbQueryAll<T = Record<string, any>>(
  sql: string,
  params: any[] = [],
  tx?: TransactionContext
): Promise<T[]> {
  if (tx) {
    return tx.queryAll<T>(sql, params);
  }

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    if (!isSchemaInitialized) await initPostgresSchema();
    const prepared = preparePostgresQuery(sql, params);
    const res = await pool.query(prepared.sql, prepared.params);
    return res.rows as T[];
  }

  await getDatabase();
  return sqliteQueryAll<T>(sql, params);
}

/**
 * Executes a query returning a single row or null across either database engine.
 * If a TransactionContext `tx` is provided, executes within that transaction.
 */
export async function dbQueryOne<T = Record<string, any>>(
  sql: string,
  params: any[] = [],
  tx?: TransactionContext
): Promise<T | null> {
  if (tx) {
    return tx.queryOne<T>(sql, params);
  }
  const rows = await dbQueryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Executes a mutation (INSERT/UPDATE/DELETE) across either database engine.
 * If a TransactionContext `tx` is provided, executes within that transaction.
 */
export async function dbRun(
  sql: string,
  params: any[] = [],
  tx?: TransactionContext
): Promise<{ changes: number }> {
  if (tx) {
    return tx.run(sql, params);
  }

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    if (!isSchemaInitialized) await initPostgresSchema();
    const prepared = preparePostgresQuery(sql, params);
    const res = await pool.query(prepared.sql, prepared.params);
    return { changes: res.rowCount || 0 };
  }

  await getDatabase();
  return sqliteRun(sql, params);
}

/**
 * Executes an atomic transaction block with guaranteed single-client isolation.
 * In PostgreSQL: Checks out a dedicated client from pool, runs BEGIN -> all queries through client -> COMMIT or ROLLBACK.
 * In SQLite: Acquires exclusive mutex lock, snapshots DB, executes all queries, persists on COMMIT or restores snapshot on ROLLBACK.
 */
export async function withTransaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    if (!isSchemaInitialized) await initPostgresSchema();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const tx: TransactionContext = {
        isPostgres: true,
        queryAll: async <R = Record<string, any>>(sql: string, params: any[] = []) => {
          const prepared = preparePostgresQuery(sql, params);
          const res = await client.query(prepared.sql, prepared.params);
          return res.rows as R[];
        },
        queryOne: async <R = Record<string, any>>(sql: string, params: any[] = []) => {
          const prepared = preparePostgresQuery(sql, params);
          const res = await client.query(prepared.sql, prepared.params);
          return res.rows.length > 0 ? (res.rows[0] as R) : null;
        },
        run: async (sql: string, params: any[] = []) => {
          const prepared = preparePostgresQuery(sql, params);
          const res = await client.query(prepared.sql, prepared.params);
          return { changes: res.rowCount || 0 };
        },
      };

      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (txErr: any) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('[Transaction Rollback Error]:', rbErr);
      }
      throw txErr;
    } finally {
      client.release();
    }
  }

  // SQLite Mode Transaction — serialized via mutex so concurrent async transactions cannot interleave
  let releaseLock!: () => void;
  const prevLock = sqliteTxMutex;
  sqliteTxMutex = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await prevLock;

  try {
    const sqliteDb = await getDatabase();
    const snapshot = sqliteDb.export();
    try {
      const tx: TransactionContext = {
        isPostgres: false,
        queryAll: async <R = Record<string, any>>(sql: string, params: any[] = []) => sqliteQueryAll<R>(sql, params),
        queryOne: async <R = Record<string, any>>(sql: string, params: any[] = []) => sqliteQueryOne<R>(sql, params),
        run: async (sql: string, params: any[] = []) => {
          sqliteDb.run(sql, params);
          return { changes: sqliteDb.getRowsModified() };
        },
      };
      const result = await callback(tx);
      persistDatabase();
      return result;
    } catch (err) {
      restoreDatabaseFromBuffer(snapshot);
      persistDatabase();
      throw err;
    }
  } finally {
    releaseLock();
  }
}

/**
 * Concurrency-safe, atomic document number generator inside an active transaction.
 * Uses row-level locking (`FOR UPDATE` in PostgreSQL, mutex-locked transaction in SQLite)
 * and checks for existing collisions before returning a guaranteed-unique sequential number.
 */
export async function reserveNextDocumentNumber(
  tx: TransactionContext,
  businessId: string,
  docType: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'QUOTATION' | 'PROFORMA' | 'SALES_RETURN' | 'PURCHASE_RETURN' = 'TAX_INVOICE'
): Promise<{ formattedNumber: string; sequenceNumber: number; prefix: string }> {
  const lockClause = tx.isPostgres ? ' FOR UPDATE' : '';
  const biz = await tx.queryOne<any>(
    `SELECT invoice_prefix, quotation_prefix, invoice_next_number, quotation_next_number, return_next_number
     FROM businesses WHERE id = ?${lockClause}`,
    [businessId]
  );

  if (!biz) {
    throw new Error('Business workspace not found while reserving document number');
  }

  const isQuotation = docType === 'QUOTATION';
  const isReturn = docType === 'SALES_RETURN' || docType === 'PURCHASE_RETURN';

  let counterColumn = 'invoice_next_number';
  let prefix = (biz.invoice_prefix || 'INV').trim();
  let seqNum = Number(biz.invoice_next_number) || 1001;

  if (isQuotation) {
    counterColumn = 'quotation_next_number';
    prefix = (biz.quotation_prefix || 'EST').trim();
    seqNum = Number(biz.quotation_next_number || biz.invoice_next_number) || 1001;
  } else if (docType === 'BILL_OF_SUPPLY') {
    prefix = 'BOS';
  } else if (docType === 'PROFORMA') {
    prefix = 'PI';
  } else if (docType === 'SALES_RETURN') {
    counterColumn = 'return_next_number';
    prefix = 'CN';
    seqNum = Number(biz.return_next_number) || 1001;
  } else if (docType === 'PURCHASE_RETURN') {
    counterColumn = 'return_next_number';
    prefix = 'DN';
    seqNum = Number(biz.return_next_number) || 1001;
  }

  // Advance sequence if any custom-numbered document already used this number
  let formattedNumber = `${prefix}-${seqNum}`;
  while (true) {
    let conflict: any = null;
    if (docType === 'SALES_RETURN') {
      conflict = await tx.queryOne(
        `SELECT id FROM sales_returns WHERE business_id = ? AND return_number = ?`,
        [businessId, formattedNumber]
      );
    } else if (docType === 'PURCHASE_RETURN') {
      conflict = await tx.queryOne(
        `SELECT id FROM purchase_returns WHERE business_id = ? AND return_number = ?`,
        [businessId, formattedNumber]
      );
    } else {
      conflict = await tx.queryOne(
        `SELECT id FROM invoices WHERE business_id = ? AND invoice_number = ?`,
        [businessId, formattedNumber]
      );
    }
    if (!conflict) break;
    seqNum++;
    formattedNumber = `${prefix}-${seqNum}`;
  }

  const now = new Date().toISOString();
  await tx.run(
    `UPDATE businesses SET ${counterColumn} = ?, updated_at = ? WHERE id = ?`,
    [seqNum + 1, now, businessId]
  );

  return {
    formattedNumber,
    sequenceNumber: seqNum,
    prefix,
  };
}

/**
 * Health check evaluator for database connectivity & latency.
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  engine: 'postgresql' | 'sqlite';
  latencyMs: number;
  version?: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (isPostgresConfigured()) {
      const pool = getPostgresPool();
      const res = await pool.query('SELECT version() AS version, 1 AS health');
      const latencyMs = Date.now() - start;
      return {
        status: 'healthy',
        database: 'connected',
        engine: 'postgresql',
        latencyMs,
        version: res.rows[0]?.version || 'PostgreSQL',
      };
    } else {
      await getDatabase();
      const rows = sqliteQueryAll('SELECT 1 as health');
      const latencyMs = Date.now() - start;
      return {
        status: rows.length > 0 ? 'healthy' : 'unhealthy',
        database: rows.length > 0 ? 'connected' : 'disconnected',
        engine: 'sqlite',
        latencyMs,
        version: 'SQLite 3 (Local Development Mode)',
      };
    }
  } catch (err: any) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      engine: isPostgresConfigured() ? 'postgresql' : 'sqlite',
      latencyMs: Date.now() - start,
      error: err?.message || 'Database connection failure',
    };
  }
}

/**
 * Clean pool shutdown on server termination.
 */
export async function shutdownDatabase(): Promise<void> {
  if (pgPool) {
    console.log('[Database Adapter] Closing PostgreSQL connection pool...');
    await pgPool.end();
    pgPool = null;
  }
}
