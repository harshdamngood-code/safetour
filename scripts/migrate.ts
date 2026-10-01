import dotenv from 'dotenv';
dotenv.config();

import { migrateSqliteToPostgres } from '../server/db/migrate-to-postgres.js';
import { initDatabase, getPostgresPool, checkDatabaseHealth } from '../server/db/db-adapter.js';

async function main() {
  console.log('====================================================');
  console.log('BillFlow Commercial SaaS - Database Migration CLI');
  console.log('====================================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? '[CONFIGURED]' : '[NOT CONFIGURED]'}`);

  try {
    console.log('[1/3] Initializing and verifying database schema...');
    await initDatabase();

    console.log('[2/3] Checking database health...');
    const health = await checkDatabaseHealth();
    console.log(`Status: ${health.status}, Engine: ${health.engine}, Latency: ${health.latencyMs}ms`);

    if (process.env.DATABASE_URL) {
      console.log('[3/3] Running data migration from SQLite to PostgreSQL if needed...');
      const result = await migrateSqliteToPostgres();
      console.log('Migration Result:', JSON.stringify(result, null, 2));
    }

    console.log('====================================================');
    console.log('✅ Migration process completed successfully!');
    console.log('====================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('====================================================');
    console.error('❌ Migration failed with fatal error:', err);
    console.error('====================================================');
    process.exit(1);
  }
}

main();
