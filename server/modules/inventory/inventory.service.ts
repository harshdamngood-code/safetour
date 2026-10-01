import { v4 as uuidv4 } from 'uuid';
import { dbQueryAll, dbQueryOne, dbRun, withTransaction } from '../../db/db-adapter.js';

export interface ProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  hsn_code?: string;
  category?: string;
  unit?: string;
  purchase_price?: number;
  selling_price?: number;
  mrp?: number;
  tax_rate?: number;
  is_tax_inclusive?: boolean;
  opening_stock?: number;
  current_stock?: number;
  min_stock_alert?: number;
}

export interface StockAdjustmentInput {
  adjustmentType: 'ADD' | 'REDUCE' | 'SET';
  quantity: number;
  reason: string;
  notes?: string;
  referenceNo?: string;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  stockStatus?: 'all' | 'low_stock' | 'out_of_stock' | 'in_stock';
  sortBy?: 'name' | 'stock' | 'selling_price' | 'purchase_price' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

const DEFAULT_CATEGORIES = [
  'Grains & Pulses',
  'Edible Oils',
  'Beverages',
  'Flour & Atta',
  'Household Care',
  'Confectionery',
  'Biscuits & Snacks',
  'Spices & Masala',
  'Dairy & Fresh',
  'Personal Care',
  'Electronics & Electrical',
  'Hardware & Tools',
  'Stationery & Packaging',
  'Apparel & Textiles',
  'Services & Labour',
];

export class InventoryService {
  /**
   * List all products for a business with filtering, sorting, and aggregate valuation metrics.
   */
  static async getProducts(businessId: string, filters: ProductFilters = {}) {
    // 1. Fetch all active products for the tenant using parameterized query
    const allProducts = await dbQueryAll<any>(
      `SELECT 
        id, business_id, name, sku, barcode, hsn_code, category, unit,
        purchase_price, selling_price, mrp, tax_rate, is_tax_inclusive,
        current_stock, min_stock_alert, is_active, created_at, updated_at
      FROM products
      WHERE business_id = ? AND is_active = 1
      ORDER BY created_at DESC`,
      [businessId]
    );

    // 2. Compute aggregate inventory summary metrics
    let totalStockValue = 0;
    let totalSalesValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const categoriesSet = new Set<string>();

    for (const p of allProducts) {
      const stock = Number(p.current_stock) || 0;
      const buyPrice = Number(p.purchase_price) || 0;
      const sellPrice = Number(p.selling_price) || 0;
      const minAlert = Number(p.min_stock_alert) || 0;

      if (stock > 0) {
        totalStockValue += stock * buyPrice;
        totalSalesValue += stock * sellPrice;
      }

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minAlert) {
        lowStockCount++;
      }

      if (p.category && p.category.trim()) {
        categoriesSet.add(p.category.trim());
      }
    }

    // 3. Filter products based on user criteria
    let filtered = [...allProducts];

    // Text search (name, sku, barcode, hsn_code, category)
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter((p) => {
        return (
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.hsn_code && p.hsn_code.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      });
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter((p) => p.category === filters.category);
    }

    // Stock status filter
    if (filters.stockStatus && filters.stockStatus !== 'all') {
      if (filters.stockStatus === 'low_stock') {
        filtered = filtered.filter((p) => p.current_stock <= p.min_stock_alert && p.current_stock > 0);
      } else if (filters.stockStatus === 'out_of_stock') {
        filtered = filtered.filter((p) => p.current_stock <= 0);
      } else if (filters.stockStatus === 'in_stock') {
        filtered = filtered.filter((p) => p.current_stock > p.min_stock_alert);
      }
    }

    // Sorting
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'asc';
    filtered.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    const allCategories = Array.from(new Set([...Array.from(categoriesSet), ...DEFAULT_CATEGORIES]));

    return {
      products: filtered,
      totalCount: allProducts.length,
      filteredCount: filtered.length,
      summary: {
        totalProducts: allProducts.length,
        totalStockValue: Math.round(totalStockValue),
        totalSalesValue: Math.round(totalSalesValue),
        potentialProfit: Math.round(totalSalesValue - totalStockValue),
        lowStockCount,
        outOfStockCount,
        inStockCount: allProducts.length - lowStockCount - outOfStockCount,
      },
      categories: allCategories,
    };
  }

  /**
   * Get single product details with full stock movement history (ledger).
   */
  static async getProductById(businessId: string, productId: string) {
    const product = await dbQueryOne<any>(
      `SELECT * FROM products WHERE id = ? AND business_id = ? AND is_active = 1`,
      [productId, businessId]
    );

    if (!product) {
      return null;
    }

    // Fetch Stock Adjustments
    const adjustmentsRaw = await dbQueryAll<any>(
      `SELECT 
        sa.id, sa.adjustment_type, sa.quantity, sa.previous_stock, sa.new_stock,
        sa.reason, sa.reference_no, sa.notes, sa.created_at, u.full_name as created_by_name
      FROM stock_adjustments sa
      LEFT JOIN users u ON sa.created_by = u.id
      WHERE sa.business_id = ? AND sa.product_id = ?
      ORDER BY sa.created_at DESC
      LIMIT 50`,
      [businessId, productId]
    );

    const adjustments = adjustmentsRaw.map((item) => ({
      id: item.id,
      date: (item.created_at || '').slice(0, 10),
      type: item.adjustment_type,
      quantity: item.quantity,
      previousStock: item.previous_stock,
      newStock: item.new_stock,
      reason: item.reason,
      referenceNo: item.reference_no,
      notes: item.notes,
      adjustedBy: item.created_by_name || 'System / Admin',
    }));

    // Fetch Sales Outflow from Invoices
    const salesRaw = await dbQueryAll<any>(
      `SELECT 
        ii.quantity, ii.unit_price, ii.total_amount,
        i.invoice_number, i.invoice_date, i.customer_name
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.business_id = ? AND ii.product_id = ?
      ORDER BY i.invoice_date DESC
      LIMIT 30`,
      [businessId, productId]
    );

    const salesMovements = salesRaw.map((row) => ({
      date: row.invoice_date,
      type: 'SALE_DISPATCH',
      voucherNo: row.invoice_number,
      partyName: row.customer_name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      totalAmount: row.total_amount,
    }));

    // Fetch Purchases Inflow
    const purchaseRaw = await dbQueryAll<any>(
      `SELECT 
        pi.quantity, pi.unit_cost, pi.total_amount,
        p.bill_number, p.bill_date, p.supplier_name
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.business_id = ? AND pi.product_id = ?
      ORDER BY p.bill_date DESC
      LIMIT 30`,
      [businessId, productId]
    );

    const purchaseMovements = purchaseRaw.map((row) => ({
      date: row.bill_date,
      type: 'PURCHASE_RECEIPT',
      voucherNo: row.bill_number,
      partyName: row.supplier_name,
      quantity: row.quantity,
      unitPrice: row.unit_cost,
      totalAmount: row.total_amount,
    }));

    return {
      product,
      adjustments,
      salesMovements,
      purchaseMovements,
    };
  }

  /**
   * Create a new product or service.
   */
  static async createProduct(businessId: string, userId: string, data: ProductInput) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const name = data.name.trim();
    if (!name) {
      throw new Error('Product name is required');
    }

    // Auto-generate SKU if not provided
    let sku = (data.sku || '').trim();
    if (!sku) {
      const prefix = name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'ITEM';
      const rand = Math.floor(1000 + Math.random() * 9000);
      sku = `${prefix}-${rand}`;
    }

    const barcode = (data.barcode || '').trim();
    const hsnCode = (data.hsn_code || '').trim();
    const category = (data.category || 'General').trim();
    const unit = (data.unit || 'PCS').toUpperCase().trim();
    const purchasePrice = Number(data.purchase_price) || 0;
    const sellingPrice = Number(data.selling_price) || 0;
    const mrp = Number(data.mrp) || sellingPrice || 0;
    const taxRate = Number(data.tax_rate) !== undefined ? Number(data.tax_rate) : 18;
    const isTaxInclusive = data.is_tax_inclusive ? 1 : 0;
    const openingStock = Number(data.opening_stock) || 0;
    const currentStock = openingStock;
    const minStockAlert = Number(data.min_stock_alert) !== undefined ? Number(data.min_stock_alert) : 10;

    return withTransaction(async (tx) => {
      // Check SKU duplicate in this business
      const existingSku = await tx.queryOne<any>(
        `SELECT id FROM products WHERE business_id = ? AND sku = ? AND is_active = 1`,
        [businessId, sku]
      );
      if (existingSku) {
        sku = `${sku}-${Math.floor(100 + Math.random() * 900)}`;
      }

      await tx.run(
        `INSERT INTO products (
          id, business_id, name, sku, barcode, hsn_code, category, unit,
          purchase_price, selling_price, mrp, tax_rate, is_tax_inclusive,
          current_stock, min_stock_alert, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          id,
          businessId,
          name,
          sku,
          barcode,
          hsnCode,
          category,
          unit,
          purchasePrice,
          sellingPrice,
          mrp,
          taxRate,
          isTaxInclusive,
          currentStock,
          minStockAlert,
          now,
          now,
        ]
      );

      // If opening stock > 0, register initial stock adjustment
      if (openingStock > 0) {
        await tx.run(
          `INSERT INTO stock_adjustments (
            id, business_id, product_id, adjustment_type, quantity,
            previous_stock, new_stock, reason, reference_no, notes, created_by, created_at
          ) VALUES (?, ?, ?, 'ADD', ?, 0, ?, 'OPENING_STOCK', 'INIT-STOCK', 'Initial opening stock entry upon product creation', ?, ?)`,
          [uuidv4(), businessId, id, openingStock, openingStock, userId, now]
        );
      }

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'CREATE_PRODUCT', 'PRODUCT', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          id,
          JSON.stringify({ name, sku, category, currentStock, purchasePrice, sellingPrice }),
          now,
        ]
      );

      return { id, name, sku, currentStock };
    });
  }

  /**
   * Update an existing product.
   */
  static async updateProduct(businessId: string, userId: string, productId: string, data: Partial<ProductInput>) {
    const now = new Date().toISOString();

    return withTransaction(async (tx) => {
      const existing = await tx.queryOne<any>(
        `SELECT * FROM products WHERE id = ? AND business_id = ? AND is_active = 1`,
        [productId, businessId]
      );
      if (!existing) {
        throw new Error('Product not found or access denied');
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name.trim());
      }
      if (data.sku !== undefined) {
        updates.push('sku = ?');
        params.push(data.sku.trim());
      }
      if (data.barcode !== undefined) {
        updates.push('barcode = ?');
        params.push(data.barcode.trim());
      }
      if (data.hsn_code !== undefined) {
        updates.push('hsn_code = ?');
        params.push(data.hsn_code.trim());
      }
      if (data.category !== undefined) {
        updates.push('category = ?');
        params.push(data.category.trim());
      }
      if (data.unit !== undefined) {
        updates.push('unit = ?');
        params.push(data.unit.toUpperCase().trim());
      }
      if (data.purchase_price !== undefined) {
        updates.push('purchase_price = ?');
        params.push(Number(data.purchase_price) || 0);
      }
      if (data.selling_price !== undefined) {
        updates.push('selling_price = ?');
        params.push(Number(data.selling_price) || 0);
      }
      if (data.mrp !== undefined) {
        updates.push('mrp = ?');
        params.push(Number(data.mrp) || 0);
      }
      if (data.tax_rate !== undefined) {
        updates.push('tax_rate = ?');
        params.push(Number(data.tax_rate) || 0);
      }
      if (data.is_tax_inclusive !== undefined) {
        updates.push('is_tax_inclusive = ?');
        params.push(data.is_tax_inclusive ? 1 : 0);
      }
      if (data.min_stock_alert !== undefined) {
        updates.push('min_stock_alert = ?');
        params.push(Number(data.min_stock_alert) || 0);
      }

      updates.push('updated_at = ?');
      params.push(now);

      params.push(productId);
      params.push(businessId);

      await tx.run(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
        params
      );

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'UPDATE_PRODUCT', 'PRODUCT', ?, ?, ?)`,
        [uuidv4(), businessId, userId, productId, JSON.stringify(data), now]
      );

      return { success: true, productId };
    });
  }

  /**
   * Adjust stock (Stock In, Stock Out, or Physical Count Correction).
   */
  static async adjustStock(businessId: string, userId: string, productId: string, input: StockAdjustmentInput) {
    const now = new Date().toISOString();

    return withTransaction(async (tx) => {
      const prod = await tx.queryOne<any>(
        `SELECT id, name, current_stock, unit, purchase_price, selling_price 
         FROM products 
         WHERE id = ? AND business_id = ? AND is_active = 1`,
        [productId, businessId]
      );

      if (!prod) {
        throw new Error('Product not found in this business');
      }

      const productName = prod.name as string;
      const previousStock = Number(prod.current_stock) || 0;
      const qty = Math.abs(Number(input.quantity) || 0);

      let newStock = previousStock;
      let actualDelta = 0;

      if (input.adjustmentType === 'ADD') {
        newStock = previousStock + qty;
        actualDelta = qty;
      } else if (input.adjustmentType === 'REDUCE') {
        newStock = Math.max(0, previousStock - qty);
        actualDelta = -Math.min(qty, previousStock);
      } else if (input.adjustmentType === 'SET') {
        newStock = Math.max(0, qty);
        actualDelta = newStock - previousStock;
      }

      // Update product stock
      await tx.run(
        `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ? AND business_id = ?`,
        [newStock, now, productId, businessId]
      );

      // Insert into stock_adjustments ledger
      const adjId = uuidv4();
      await tx.run(
        `INSERT INTO stock_adjustments (
          id, business_id, product_id, adjustment_type, quantity,
          previous_stock, new_stock, reason, reference_no, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adjId,
          businessId,
          productId,
          input.adjustmentType,
          qty,
          previousStock,
          newStock,
          input.reason || 'MANUAL_ADJUSTMENT',
          input.referenceNo || `ADJ-${Date.now().toString().slice(-6)}`,
          input.notes || '',
          userId,
          now,
        ]
      );

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'ADJUST_STOCK', 'STOCK_ADJUSTMENT', ?, ?, ?)`,
        [
          uuidv4(),
          businessId,
          userId,
          adjId,
          JSON.stringify({
            productId,
            productName,
            type: input.adjustmentType,
            quantity: qty,
            previousStock,
            newStock,
            reason: input.reason,
          }),
          now,
        ]
      );

      return {
        success: true,
        adjustmentId: adjId,
        productId,
        productName,
        previousStock,
        newStock,
        currentStock: newStock,
        delta: actualDelta,
      };
    });
  }

  /**
   * Delete / Deactivate a product.
   */
  static async deleteProduct(businessId: string, userId: string, productId: string) {
    const now = new Date().toISOString();

    return withTransaction(async (tx) => {
      await tx.run(
        `UPDATE products SET is_active = 0, updated_at = ? WHERE id = ? AND business_id = ?`,
        [now, productId, businessId]
      );

      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, 'DELETE_PRODUCT', 'PRODUCT', ?, '{}', ?)`,
        [uuidv4(), businessId, userId, productId, now]
      );

      return { success: true };
    });
  }

  /**
   * Get Low Stock items requiring restock.
   */
  static async getLowStockAlerts(businessId: string) {
    const allLow = await dbQueryAll<any>(
      `SELECT 
        id, name, sku, category, unit, purchase_price, selling_price,
        current_stock, min_stock_alert
      FROM products
      WHERE business_id = ? AND is_active = 1 AND current_stock <= min_stock_alert
      ORDER BY (current_stock - min_stock_alert) ASC`,
      [businessId]
    );

    let totalRestockCost = 0;
    const items = allLow.map((item) => {
      const current = Number(item.current_stock) || 0;
      const minAlert = Number(item.min_stock_alert) || 0;
      const buyPrice = Number(item.purchase_price) || 0;
      const deficit = Math.max(0, minAlert - current);
      const reorderQty = deficit > 0 ? deficit : Math.max(1, Math.round(minAlert * 1.5));
      const estimatedCost = Math.round(reorderQty * buyPrice);

      totalRestockCost += estimatedCost;

      return {
        ...item,
        deficit,
        suggestedReorderQty: reorderQty,
        estimatedReorderCost: estimatedCost,
        isCritical: current <= 0,
      };
    });

    return {
      items,
      count: items.length,
      criticalCount: items.filter((i) => i.isCritical).length,
      totalRestockCost,
    };
  }
}
