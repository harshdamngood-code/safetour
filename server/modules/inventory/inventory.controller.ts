import { Request, Response } from 'express';
import { InventoryService } from './inventory.service.js';

export class InventoryController {
  /**
   * GET /api/inventory/products
   * List all products with filtering, search, sorting & summary valuation
   */
  static async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Active business context required' });
        return;
      }

      const { search, category, stockStatus, sortBy, sortOrder } = req.query;

      const result = await InventoryService.getProducts(businessId, {
        search: search as string,
        category: category as string,
        stockStatus: stockStatus as any,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[InventoryController] getProducts error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch inventory catalog',
      });
    }
  }

  /**
   * GET /api/inventory/products/:id
   * Get product details with stock movement history ledger
   */
  static async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const { id } = req.params;

      if (!businessId) {
        res.status(400).json({ success: false, message: 'Active business context required' });
        return;
      }

      const result = await InventoryService.getProductById(businessId, id);
      if (!result) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
      }

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[InventoryController] getProductById error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch product ledger',
      });
    }
  }

  /**
   * POST /api/inventory/products
   * Create new product or service
   */
  static async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId;

      if (!businessId || !userId) {
        res.status(400).json({ success: false, message: 'Authentication & business context required' });
        return;
      }

      const {
        name,
        sku,
        barcode,
        hsn_code,
        category,
        unit,
        purchase_price,
        selling_price,
        mrp,
        tax_rate,
        is_tax_inclusive,
        opening_stock,
        min_stock_alert,
      } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'Item name is required' });
        return;
      }

      const product = await InventoryService.createProduct(businessId, userId, {
        name,
        sku,
        barcode,
        hsn_code,
        category,
        unit,
        purchase_price: Number(purchase_price) || 0,
        selling_price: Number(selling_price) || 0,
        mrp: Number(mrp) || Number(selling_price) || 0,
        tax_rate: Number(tax_rate) !== undefined ? Number(tax_rate) : 18,
        is_tax_inclusive: Boolean(is_tax_inclusive),
        opening_stock: Number(opening_stock) || 0,
        min_stock_alert: Number(min_stock_alert) !== undefined ? Number(min_stock_alert) : 10,
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product,
      });
    } catch (error: any) {
      console.error('[InventoryController] createProduct error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create product',
      });
    }
  }

  /**
   * PUT /api/inventory/products/:id
   * Update product metadata and pricing
   */
  static async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!businessId || !userId) {
        res.status(400).json({ success: false, message: 'Authentication & business context required' });
        return;
      }

      const result = await InventoryService.updateProduct(businessId, userId, id, req.body);

      res.json({
        success: true,
        message: 'Product updated successfully',
        productId: result.productId,
      });
    } catch (error: any) {
      console.error('[InventoryController] updateProduct error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update product',
      });
    }
  }

  /**
   * POST /api/inventory/products/:id/adjust-stock
   * Record Stock In / Stock Out / Count Adjustment
   */
  static async adjustStock(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!businessId || !userId) {
        res.status(400).json({ success: false, message: 'Authentication & business context required' });
        return;
      }

      const { adjustmentType, quantity, reason, notes, referenceNo } = req.body;

      if (!adjustmentType || !['ADD', 'REDUCE', 'SET'].includes(adjustmentType)) {
        res.status(400).json({
          success: false,
          message: "Valid adjustmentType ('ADD', 'REDUCE', 'SET') is required",
        });
        return;
      }

      if (quantity === undefined || Number(quantity) < 0) {
        res.status(400).json({ success: false, message: 'A valid non-negative quantity is required' });
        return;
      }

      const result = await InventoryService.adjustStock(businessId, userId, id, {
        adjustmentType,
        quantity: Number(quantity),
        reason: reason || 'PHYSICAL_COUNT_CORRECTION',
        notes,
        referenceNo,
      });

      res.json({
        success: true,
        message: `Stock updated successfully (${result.previousStock} → ${result.newStock})`,
        adjustmentId: result.adjustmentId,
        productId: result.productId,
        productName: result.productName,
        previousStock: result.previousStock,
        newStock: result.newStock,
        currentStock: result.currentStock,
        delta: result.delta,
      });
    } catch (error: any) {
      console.error('[InventoryController] adjustStock error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to adjust stock',
      });
    }
  }

  /**
   * DELETE /api/inventory/products/:id
   * Soft delete / deactivate product
   */
  static async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!businessId || !userId) {
        res.status(400).json({ success: false, message: 'Authentication & business context required' });
        return;
      }

      await InventoryService.deleteProduct(businessId, userId, id);

      res.json({
        success: true,
        message: 'Product deactivated successfully',
      });
    } catch (error: any) {
      console.error('[InventoryController] deleteProduct error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete product',
      });
    }
  }

  /**
   * GET /api/inventory/low-stock
   * List low stock critical items with reorder recommendations
   */
  static async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, message: 'Active business context required' });
        return;
      }

      const result = await InventoryService.getLowStockAlerts(businessId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[InventoryController] getLowStockAlerts error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch low stock alerts',
      });
    }
  }
}
