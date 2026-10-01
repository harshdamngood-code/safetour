import { roundPaise, calculateInvoiceTotals, isInterStateSupply } from '../server/utils/finance.js';
import { initDatabase, dbQueryAll, dbQueryOne, dbRun, withTransaction, checkDatabaseHealth } from '../server/db/db-adapter.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from '../server/config/env.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAILED] ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`✅ [PASSED] ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('BillFlow Commercial SaaS - Automated Production Tests');
  console.log('====================================================');

  // Test Suite 1: Financial Precision Engine
  console.log('\n--- Test Suite 1: Financial & GST Precision Engine ---');
  {
    assert(roundPaise(0.004) === 0, 'roundPaise(0.004) should round to 0.00');
    assert(roundPaise(0.005) === 0.01, 'roundPaise(0.005) should round up to 0.01');
    assert(roundPaise(100.555) === 100.56, 'roundPaise(100.555) should round to 100.56');

    // Intra-state (CGST 9% + SGST 9%) calculation test
    const intraRes = calculateInvoiceTotals({
      items: [
        { item_name: 'Product A', quantity: 2, unit_price: 500, tax_rate: 18, is_tax_inclusive: false },
        { item_name: 'Product B', quantity: 1, unit_price: 250.55, tax_rate: 18, is_tax_inclusive: false },
      ],
      businessStateCode: '27',
      customerStateCode: '27',
      paidAmount: 500,
    });

    assert(intraRes.subtotal === 1250.55, `Subtotal matches: expected 1250.55, got ${intraRes.subtotal}`);
    assert(intraRes.cgst_total === 112.55, `CGST total matches: expected 112.55, got ${intraRes.cgst_total}`);
    assert(intraRes.sgst_total === 112.55, `SGST total matches: expected 112.55, got ${intraRes.sgst_total}`);
    assert(intraRes.igst_total === 0, `IGST total is 0 for intra-state supply`);
    assert(intraRes.grand_total === 1476, `Grand total with round-off matches 1476, got ${intraRes.grand_total}`);
    assert(intraRes.balance_due === 976, `Balance due matches 976, got ${intraRes.balance_due}`);
    assert(intraRes.payment_status === 'PARTIAL', `Payment status is PARTIAL`);

    // Inter-state (IGST 18%) calculation test
    const interRes = calculateInvoiceTotals({
      items: [{ item_name: 'Product Inter', quantity: 1, unit_price: 1000, tax_rate: 18, is_tax_inclusive: false }],
      businessStateCode: '27',
      customerStateCode: '29',
    });
    assert(interRes.igst_total === 180, `IGST total is 180 for inter-state supply`);
    assert(interRes.cgst_total === 0 && interRes.sgst_total === 0, `CGST and SGST are 0 for inter-state supply`);
  }

  // Test Suite 2: Database Layer & Health Check
  console.log('\n--- Test Suite 2: Database Initialization & Health ---');
  {
    await initDatabase();
    const health = await checkDatabaseHealth();
    assert(health.status === 'healthy', `Database health check reports status: ${health.status}`);
    assert(health.database === 'connected', `Database health check reports connected: ${health.database}`);
  }

  // Test Suite 3: Multi-tenant Transaction Atomicity
  console.log('\n--- Test Suite 3: Multi-tenant & Transaction Safety ---');
  {
    const testUserId = uuidv4();
    const testBizId = uuidv4();
    const now = new Date().toISOString();

    await withTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO users (id, full_name, email, password_hash, is_active, created_at)
         VALUES (?, 'Test User', ?, 'dummy_hash', 1, ?)`,
        [testUserId, `test_${Date.now()}@billflow.app`, now]
      );

      await tx.run(
        `INSERT INTO businesses (id, owner_id, business_name, business_type, phone, address_line1, city, state, state_code, pincode, created_at)
         VALUES (?, ?, 'Test Business', 'Retail', '9999999999', '123 Test St', 'Mumbai', 'Maharashtra', '27', '400001', ?)`,
        [testBizId, testUserId, now]
      );

      await tx.run(
        `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
         VALUES (?, ?, ?, 'OWNER', 1, ?)`,
        [uuidv4(), testBizId, testUserId, now]
      );
    });

    const user = await dbQueryOne<any>(`SELECT * FROM users WHERE id = ?`, [testUserId]);
    assert(user !== null, 'User created in atomic transaction was committed');

    const biz = await dbQueryOne<any>(`SELECT * FROM businesses WHERE id = ?`, [testBizId]);
    assert(biz !== null, 'Business created in atomic transaction was committed');

    // Test rollback behavior
    let rollbackSuccess = false;
    try {
      await withTransaction(async (tx) => {
        await tx.run(`INSERT INTO products (id, business_id, name, created_at) VALUES (?, ?, 'Ghost Prod', ?)`, [
          uuidv4(),
          testBizId,
          now,
        ]);
        throw new Error('Forced Rollback Test');
      });
    } catch {
      rollbackSuccess = true;
    }
    assert(rollbackSuccess, 'Transaction exception triggered rollback');

    const ghostProd = await dbQueryOne<any>(`SELECT * FROM products WHERE business_id = ? AND name = 'Ghost Prod'`, [testBizId]);
    assert(ghostProd === null, 'Rolled-back product does not exist in database');
  }

  // Test Suite 4: Security & JWT Verification
  console.log('\n--- Test Suite 4: Security & JWT Authentication ---');
  {
    const payload = { userId: uuidv4(), email: 'superadmin@billflow.app', fullName: 'Super Admin', isSuperAdmin: true };
    const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    assert(decoded.userId === payload.userId, 'JWT token successfully encodes and verifies claims');
  }

  console.log('\n====================================================');
  console.log(`Test Execution Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
