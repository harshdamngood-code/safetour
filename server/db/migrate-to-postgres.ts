import { getDatabase, queryAll } from './database.js';
import { getPostgresPool, initPostgresSchema } from './db-adapter.js';

/**
 * Migration tool to copy all existing business, customer, invoice, and inventory data
 * from SQLite (development/embedded) into PostgreSQL (production).
 */
export async function migrateSqliteToPostgres(): Promise<{
  success: boolean;
  migratedTables: Record<string, number>;
  error?: string;
}> {
  const pool = getPostgresPool();
  if (!pool) {
    return { success: false, migratedTables: {}, error: 'DATABASE_URL not configured for PostgreSQL' };
  }

  await initPostgresSchema();
  await getDatabase();

  const tables = [
    'users',
    'businesses',
    'business_users',
    'branches',
    'subscriptions',
    'product_categories',
    'units',
    'products',
    'stock_adjustments',
    'customers',
    'suppliers',
    'invoices',
    'invoice_items',
    'sales_returns',
    'sales_return_items',
    'purchases',
    'purchase_items',
    'purchase_returns',
    'purchase_return_items',
    'expenses',
    'payments',
    'public_invoice_tokens',
    'sync_audit',
  ];

  const results: Record<string, number> = {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const table of tables) {
      try {
        const rows = queryAll(`SELECT * FROM ${table}`);
        if (!rows || rows.length === 0) {
          results[table] = 0;
          continue;
        }

        let insertedCount = 0;
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row).map((val) => {
            if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
              return JSON.stringify(val);
            }
            return val;
          });

          const cols = keys.map((k) => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

          const query = `
            INSERT INTO "${table}" (${cols})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING;
          `;

          await client.query(query, values);
          insertedCount++;
        }
        results[table] = insertedCount;
      } catch (err: any) {
        console.warn(`[Migration Warning] Could not migrate table ${table}:`, err.message);
        results[table] = -1;
      }
    }

    await client.query('COMMIT');
    console.log('[Migration] Successfully synced SQLite records to PostgreSQL:', results);
    return { success: true, migratedTables: results };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Migration Error] PostgreSQL migration failed:', err);
    return { success: false, migratedTables: results, error: err.message };
  } finally {
    client.release();
  }
}
