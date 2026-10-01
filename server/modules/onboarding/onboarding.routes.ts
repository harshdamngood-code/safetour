import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { dbQueryOne, withTransaction } from '../../db/db-adapter.js';

export const onboardingRouter = Router();

// Requires authenticated user account
onboardingRouter.use(authenticateToken);

/**
 * Standard Indian State Code mapping for GST compliance
 */
export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

/**
 * GET /api/onboarding/states
 * Returns GST compliant state codes and names
 */
onboardingRouter.get('/states', (_req: Request, res: Response) => {
  const states = Object.entries(INDIAN_STATES).map(([code, name]) => ({
    code,
    name,
  }));
  res.json({ success: true, states });
});

/**
 * POST /api/onboarding/complete
 * Completes the 5-step onboarding workflow and provisions the business tenant
 */
onboardingRouter.post('/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const {
      // Step 1: Business Identity & Contact
      businessName,
      legalName,
      businessType,
      phone,
      email,
      gstin,
      pan,
      addressLine1,
      addressLine2,
      city,
      state,
      stateCode,
      pincode,
      currency,
      financialYearStart,

      // Step 2: Category
      businessCategory,

      // Step 3: Invoice Settings
      invoicePrefix,
      startingInvoiceNumber,
      termsAndConditions,

      // Step 4: First Product & Customer (Optional)
      firstProduct,
      firstCustomer,
    } = req.body;

    // Strict validation
    if (!businessName || !businessName.trim()) {
      res.status(400).json({ success: false, message: 'Business name is required.' });
      return;
    }

    if (!phone || !phone.trim()) {
      res.status(400).json({ success: false, message: 'Business phone number is required.' });
      return;
    }

    if (!city || !state || !stateCode || !pincode) {
      res.status(400).json({ success: false, message: 'City, state, state code, and pincode are required.' });
      return;
    }

    // GSTIN format validation if provided (15 characters)
    if (gstin && gstin.trim()) {
      const gstinClean = gstin.trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstinClean)) {
        res.status(400).json({
          success: false,
          message: 'Invalid GSTIN format. Expected 15-character format like 27AAAAA0000A1Z5',
        });
        return;
      }
    }

    // PAN format validation if provided (10 characters)
    if (pan && pan.trim()) {
      const panClean = pan.trim().toUpperCase();
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panClean)) {
        res.status(400).json({
          success: false,
          message: 'Invalid PAN format. Expected 10-character format like ABCDE1234F',
        });
        return;
      }
    }

    const businessId = uuidv4();
    const now = new Date().toISOString();

    const prefix = invoicePrefix?.trim() || `${businessName.substring(0, 3).toUpperCase()}-26`;
    const nextNumber = Number(startingInvoiceNumber) || 1;

    let createdProduct: { id: string; name: string } | null = null;
    let createdCustomer: { id: string; name: string } | null = null;

    await withTransaction(async (tx) => {
      // 1. Insert Business
      await tx.run(
        `INSERT INTO businesses (
          id, owner_id, business_name, legal_name, business_type, business_category,
          gstin, pan, phone, email, address_line1, address_line2, city, state, state_code, pincode,
          currency, invoice_prefix, invoice_next_number, financial_year_start, terms_and_conditions,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          businessId,
          userId,
          businessName.trim(),
          legalName?.trim() || businessName.trim(),
          businessType || 'Retail & Wholesale',
          businessCategory || 'General Business',
          gstin?.trim()?.toUpperCase() || null,
          pan?.trim()?.toUpperCase() || null,
          phone.trim(),
          email?.trim() || req.user!.email,
          addressLine1.trim(),
          addressLine2?.trim() || null,
          city.trim(),
          state.trim(),
          stateCode.trim(),
          pincode.trim(),
          currency || 'INR',
          prefix,
          nextNumber,
          financialYearStart || '2026-04-01',
          termsAndConditions || '1. Goods once sold will not be returned.\n2. Subject to local jurisdiction only.',
          now,
          now,
        ]
      );

      // 2. Link authenticated user as OWNER
      const membershipId = uuidv4();
      await tx.run(
        `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
         VALUES (?, ?, ?, 'OWNER', 1, ?)`,
        [membershipId, businessId, userId, now]
      );

      // 3. Insert Optional First Product
      if (firstProduct && firstProduct.name && firstProduct.name.trim()) {
        const prodId = uuidv4();
        await tx.run(
          `INSERT INTO products (
            id, business_id, name, sku, category, unit, purchase_price, selling_price,
            tax_rate, current_stock, min_stock_alert, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            prodId,
            businessId,
            firstProduct.name.trim(),
            firstProduct.sku?.trim() || null,
            firstProduct.category || businessCategory || 'General',
            firstProduct.unit || 'PCS',
            Number(firstProduct.purchasePrice) || 0,
            Number(firstProduct.sellingPrice) || 0,
            Number(firstProduct.taxRate) || 18,
            Number(firstProduct.openingStock) || 0,
            Number(firstProduct.minStockAlert) || 10,
            now,
            now,
          ]
        );
        createdProduct = { id: prodId, name: firstProduct.name };
      }

      // 4. Insert Optional First Customer
      if (firstCustomer && firstCustomer.name && firstCustomer.name.trim()) {
        const custId = uuidv4();
        const openBal = Number(firstCustomer.openingBalance) || 0;
        await tx.run(
          `INSERT INTO customers (
            id, business_id, name, phone, city, state, state_code, opening_balance,
            current_balance, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            custId,
            businessId,
            firstCustomer.name.trim(),
            firstCustomer.phone?.trim() || null,
            firstCustomer.city?.trim() || city,
            firstCustomer.state?.trim() || state,
            firstCustomer.stateCode?.trim() || stateCode,
            openBal,
            openBal,
            now,
          ]
        );
        createdCustomer = { id: custId, name: firstCustomer.name };
      }

      // 5. Initial Payment float if starting cash specified
      if (req.body.initialCashFloat && Number(req.body.initialCashFloat) > 0) {
        await tx.run(
          `INSERT INTO payments (id, business_id, direction, entity_type, entity_name, amount, payment_mode, account_type, payment_date, notes, created_at)
           VALUES (?, ?, 'IN', 'OTHER', 'Opening Cash Float', ?, 'CASH', 'CASH', ?, 'Initial store cash drawer balance', ?)`,
          [uuidv4(), businessId, Number(req.body.initialCashFloat), now.split('T')[0], now]
        );
      }

      // 6. Audit Trail entry
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, 'BUSINESS_ONBOARDING_COMPLETED', 'BUSINESS', ?, ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          businessId,
          JSON.stringify({
            businessName: businessName.trim(),
            category: businessCategory,
            hasProduct: !!createdProduct,
            hasCustomer: !!createdCustomer,
          }),
          req.ip || '127.0.0.1',
          now,
        ]
      );
    });

    // Fetch the newly created business
    const newBusiness = await dbQueryOne(
      `SELECT * FROM businesses WHERE id = ?`,
      [businessId]
    );

    res.status(201).json({
      success: true,
      message: 'Business successfully onboarded and configured!',
      business: newBusiness,
      createdProduct,
      createdCustomer,
    });
  } catch (error: any) {
    console.error('[Onboarding API] Failed to complete onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete business onboarding.',
      error: error.message,
    });
  }
});
