export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  barcode?: string;
  hsn_code?: string;
  category: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  tax_rate: number;
  is_tax_inclusive: number | boolean;
  current_stock: number;
  min_stock_alert: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface InventorySummary {
  totalProducts: number;
  totalStockValue: number;
  totalSalesValue: number;
  potentialProfit: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
}

export interface InventoryResponse {
  success: boolean;
  products: Product[];
  totalCount: number;
  filteredCount: number;
  summary: InventorySummary;
  categories: string[];
}

export interface StockAdjustment {
  id: string;
  date: string;
  type: 'ADD' | 'REDUCE' | 'SET';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceNo?: string;
  notes?: string;
  adjustedBy: string;
}

export interface SalesMovement {
  date: string;
  type: string;
  voucherNo: string;
  partyName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface PurchaseMovement {
  date: string;
  type: string;
  voucherNo: string;
  partyName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface ProductDetailResponse {
  success: boolean;
  product: Product;
  adjustments: StockAdjustment[];
  salesMovements: SalesMovement[];
  purchaseMovements: PurchaseMovement[];
}

export interface LowStockItem extends Product {
  deficit: number;
  suggestedReorderQty: number;
  estimatedReorderCost: number;
  isCritical: boolean;
}

export interface LowStockAlertResponse {
  success: boolean;
  items: LowStockItem[];
  count: number;
  criticalCount: number;
  totalRestockCost: number;
}
