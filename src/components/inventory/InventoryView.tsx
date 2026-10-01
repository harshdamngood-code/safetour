import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product, InventorySummary, InventoryResponse } from '../../types/inventory.types';
import { ProductFormModal } from './ProductFormModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { ProductLedgerModal } from './ProductLedgerModal';
import { LowStockModal } from './LowStockModal';
import { SubViewHint } from '../layout/Navbar';
import {
  TiltCard,
  GlassCard,
  AnimatedNumber,
  TableSkeleton,
  EmptyState3D,
  useToast,
} from '../ui/3d-system';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  Scale,
  History,
  Edit2,
  Trash2,
  Barcode,
  Hash,
  Sparkles,
  Layers,
  DollarSign,
  Boxes,
  Loader2,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';

interface InventoryViewProps {
  initialHint?: SubViewHint;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ initialHint }) => {
  const { activeBusiness, token } = useAuth();
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(
    initialHint === 'products' ? 'grid' : 'table'
  );

  useEffect(() => {
    if (initialHint === 'products') setViewMode('grid');
    else if (initialHint === 'inventory') setViewMode('table');
  }, [initialHint]);

  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalProducts: 0,
    totalStockValue: 0,
    totalSalesValue: 0,
    potentialProfit: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    inStockCount: 0,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'in_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'selling_price' | 'purchase_price' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerProductId, setLedgerProductId] = useState<string | null>(null);

  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  // Fetch inventory catalog
  const fetchProducts = useCallback(async () => {
    if (!activeBusiness || !token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (stockStatusFilter && stockStatusFilter !== 'all') params.set('stockStatus', stockStatusFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const data = (await api.get<InventoryResponse>(
        `/inventory/products?${params.toString()}`
      )) as unknown as InventoryResponse;
      if (!data.success) {
        throw new Error(data.summary ? 'Failed to fetch' : 'Server error');
      }

      setProducts(data.products || []);
      if (data.summary) {
        setSummary(data.summary);
      }
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading inventory catalog');
    } finally {
      setLoading(false);
    }
  }, [activeBusiness, token, searchTerm, selectedCategory, stockStatusFilter, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  // Handle item deletion
  const handleDeleteProduct = async (prod: Product) => {
    if (!activeBusiness || !token) return;
    if (!window.confirm(`Are you sure you want to deactivate "${prod.name}" from your catalog?`)) {
      return;
    }

    try {
      const data = await api.delete(`/inventory/products/${prod.id}`);
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete product');
      }
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
    }
  };

  const marginPercentage =
    summary.totalStockValue > 0
      ? ((summary.potentialProfit / summary.totalStockValue) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header & Quick Actions */}
      <GlassCard className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 border border-white/15">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Inventory &amp; Products Catalog
              </h1>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs font-mono font-semibold text-indigo-400">
                Real-Time Valuation
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              3D Product catalog, barcode scanner support, stock adjustment ledgers &amp; GST HSN rules
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 3D Grid vs Table Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              3D Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Ledger
            </button>
          </div>

          {summary.lowStockCount + summary.outOfStockCount > 0 && (
            <button
              onClick={() => setIsLowStockModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 hover:bg-amber-500/25 text-xs font-bold transition flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Low Stock ({summary.lowStockCount + summary.outOfStockCount})</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsFormModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <Plus className="w-4 h-4" /> + New Product
          </button>
        </div>
      </GlassCard>

      {/* 2. Executive 3D KPI Valuation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock Cost Value */}
        <TiltCard glowColor="indigo" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Stock Valuation (Cost)</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            <AnimatedNumber value={summary.totalStockValue || 0} isCurrency />
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            Across {summary.totalProducts} active catalog items
          </p>
        </TiltCard>

        {/* Total Retail Sales Realization */}
        <TiltCard glowColor="emerald" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Retail Valuation (MRP)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-2">
            <AnimatedNumber value={summary.totalSalesValue || 0} isCurrency />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Expected revenue upon full liquidation
          </p>
        </TiltCard>

        {/* Projected Profit Margin */}
        <TiltCard glowColor="cyan" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Potential Gross Profit</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-cyan-300 mt-2">
            <AnimatedNumber value={summary.potentialProfit || 0} isCurrency />
          </div>
          <p className="text-[11px] text-cyan-400/90 mt-1 font-mono font-medium">
            +{marginPercentage}% Average Margin
          </p>
        </TiltCard>

        {/* Stock Health & Depletion Status */}
        <TiltCard glowColor="amber" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Stock Health Matrix</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            <div className="text-xs">
              <span className="text-emerald-400 font-bold font-mono text-base">{summary.inStockCount}</span>
              <span className="text-slate-500 ml-1">Healthy</span>
            </div>
            <div className="text-xs border-l border-slate-800 pl-3">
              <span className="text-amber-400 font-bold font-mono text-base">{summary.lowStockCount}</span>
              <span className="text-slate-500 ml-1">Low</span>
            </div>
            <div className="text-xs border-l border-slate-800 pl-3">
              <span className="text-rose-400 font-bold font-mono text-base">{summary.outOfStockCount}</span>
              <span className="text-slate-500 ml-1">Zero</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {summary.lowStockCount + summary.outOfStockCount > 0
              ? `${summary.lowStockCount + summary.outOfStockCount} items need replenishment`
              : 'All inventory within safe thresholds'}
          </p>
        </TiltCard>
      </div>

      {/* 3. Search, Category Pills, Filters & Sorting */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, SKU, barcode, HSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Controls: Stock Filter, Category Dropdown, Sort */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Stock Status Buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  stockStatusFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStockStatusFilter('low_stock')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  stockStatusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Low ({summary.lowStockCount})
              </button>
              <button
                onClick={() => setStockStatusFilter('out_of_stock')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  stockStatusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Zero ({summary.outOfStockCount})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-white focus:outline-none"
              >
                <option value="name">Name</option>
                <option value="stock">Stock Level</option>
                <option value="selling_price">Selling Price</option>
                <option value="purchase_price">Cost Price</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchProducts()}
              title="Refresh"
              className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. 3D Product Cards Grid OR Inventory Ledger Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : products.length === 0 ? (
        <GlassCard className="p-8">
          <EmptyState3D
            title="No Products Found in Catalog"
            description={
              searchTerm || selectedCategory !== 'all' || stockStatusFilter !== 'all'
                ? 'No catalog items match your active filters. Try clearing your search query.'
                : 'Get started by adding your first product or inventory item with HSN & GST configuration.'
            }
            actionLabel="+ Add New Product"
            onAction={() => {
              setEditingProduct(null);
              setIsFormModalOpen(true);
            }}
            icon="product"
          />
        </GlassCard>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => {
            const stock = Number(p.current_stock) || 0;
            const minAlert = Math.max(Number(p.min_stock_alert) || 5, 1);
            const buyPrice = Number(p.purchase_price) || 0;
            const sellPrice = Number(p.selling_price) || 0;
            const isOutOfStock = stock <= 0;
            const isLowStock = !isOutOfStock && stock <= minAlert;
            const healthPercent = isOutOfStock
              ? 4
              : Math.min(100, Math.round((stock / (minAlert * 3)) * 100));

            return (
              <TiltCard
                key={p.id}
                glowColor={isOutOfStock ? 'rose' : isLowStock ? 'amber' : 'emerald'}
                className="p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Avatar & Barcode Scanner Indicator */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center font-extrabold text-sm text-indigo-300 group-hover:-translate-y-1 transition-transform shadow-inner">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isOutOfStock
                            ? 'text-rose-400'
                            : isLowStock
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {isOutOfStock
                          ? '● LOW / DEPLETED'
                          : isLowStock
                          ? '● MEDIUM / REORDER'
                          : '● HIGH STOCK'}
                      </span>
                      {p.barcode && (
                        <div className="relative overflow-hidden mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-400">
                          <Barcode className="w-3 h-3 text-indigo-400" />
                          <span>{p.barcode}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Title & SKU */}
                  <div className="mt-3.5">
                    <h3
                      onClick={() => {
                        setLedgerProductId(p.id);
                        setIsLedgerModalOpen(true);
                      }}
                      className="text-sm font-bold text-white group-hover:text-indigo-300 transition cursor-pointer line-clamp-1"
                    >
                      {p.name}
                    </h3>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <span className="text-indigo-400">{p.sku || 'NO-SKU'}</span>
                      <span>·</span>
                      <span>{p.category || 'General'}</span>
                      <span>·</span>
                      <span>{p.tax_rate}% GST</span>
                    </div>
                  </div>

                  {/* Visual Stock Health Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Available Stock</span>
                      <span
                        className={`font-bold ${
                          isOutOfStock
                            ? 'text-rose-400'
                            : isLowStock
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {stock} {p.unit}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOutOfStock
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                            : isLowStock
                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                            : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                        }`}
                        style={{ width: `${healthPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Price & Quick Actions Footer */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">
                      Selling Rate
                    </div>
                    <div className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors font-mono">
                      ₹{sellPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setAdjustProduct(p);
                        setIsAdjustModalOpen(true);
                      }}
                      title="Adjust Stock"
                      className="p-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                    >
                      <Scale className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setLedgerProductId(p.id);
                        setIsLedgerModalOpen(true);
                      }}
                      title="Stock Ledger"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingProduct(p);
                        setIsFormModalOpen(true);
                      }}
                      title="Edit Product"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </TiltCard>
            );
          })}
        </div>
      ) : (
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-5">Item Details</th>
                <th className="py-4 px-4">Category / Codes</th>
                <th className="py-4 px-4 text-center">Stock Level</th>
                <th className="py-4 px-4 text-right">Purchase Rate</th>
                <th className="py-4 px-4 text-right">Selling Rate</th>
                <th className="py-4 px-4 text-right">Stock Valuation</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {products.map((p) => {
                  const stock = Number(p.current_stock) || 0;
                  const minAlert = Number(p.min_stock_alert) || 0;
                  const buyPrice = Number(p.purchase_price) || 0;
                  const sellPrice = Number(p.selling_price) || 0;
                  const stockValue = stock * buyPrice;

                  const isOutOfStock = stock <= 0;
                  const isLowStock = !isOutOfStock && stock <= minAlert;

                  return (
                    <tr key={p.id} className="table-row-3d">
                      
                      {/* Product Details */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 font-bold">
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm hover:text-indigo-400 transition cursor-pointer"
                              onClick={() => {
                                setLedgerProductId(p.id);
                                setIsLedgerModalOpen(true);
                              }}
                            >
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-indigo-400 font-semibold">
                                {p.sku || 'NO-SKU'}
                              </span>
                              {p.barcode && (
                                <span className="font-mono text-slate-400 flex items-center gap-0.5">
                                  <Barcode className="w-3 h-3" /> {p.barcode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Codes */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px]">
                            {p.category || 'General'}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                            {p.hsn_code ? (
                              <span>HSN: <strong className="text-slate-300">{p.hsn_code}</strong></span>
                            ) : (
                              <span>HSN: —</span>
                            )}
                            <span>•</span>
                            <span className="text-indigo-300 font-semibold">{p.tax_rate}% GST</span>
                          </div>
                        </div>
                      </td>

                      {/* Stock Level Bar & Count */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`font-mono font-bold text-sm px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                              isOutOfStock
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : isLowStock
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isOutOfStock ? (
                              <AlertOctagon className="w-3.5 h-3.5" />
                            ) : isLowStock ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {stock} {p.unit}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-1 font-mono">
                            Min Alert: {p.min_stock_alert} {p.unit}
                          </span>
                        </div>
                      </td>

                      {/* Purchase Rate */}
                      <td className="py-4 px-4 text-right font-mono">
                        <div className="text-slate-300 font-semibold">
                          ₹{buyPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500">per {p.unit}</div>
                      </td>

                      {/* Selling Rate */}
                      <td className="py-4 px-4 text-right font-mono">
                        <div className="text-white font-bold">
                          ₹{sellPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-indigo-400">
                          {p.is_tax_inclusive ? 'Incl. GST' : '+ Tax'}
                        </div>
                      </td>

                      {/* Stock Valuation */}
                      <td className="py-4 px-4 text-right font-mono">
                        <div className="text-emerald-400 font-bold text-sm">
                          ₹{stockValue.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Retail: ₹{(stock * sellPrice).toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Adjust Stock Button */}
                          <button
                            onClick={() => {
                              setAdjustProduct(p);
                              setIsAdjustModalOpen(true);
                            }}
                            title="Adjust Stock (Stock In/Out/Recount)"
                            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                          >
                            <Scale className="w-4 h-4" />
                          </button>

                          {/* Movement History Ledger Button */}
                          <button
                            onClick={() => {
                              setLedgerProductId(p.id);
                              setIsLedgerModalOpen(true);
                            }}
                            title="View Stock Ledger & Audit Movements"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setIsFormModalOpen(true);
                            }}
                            title="Edit Item Details"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Item */}
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Deactivate Item"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <span className="font-bold text-slate-200">{products.length}</span> of{' '}
            <span className="font-bold text-slate-200">{summary.totalProducts}</span> total catalog items
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> In Stock
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Low Alert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Depleted
            </span>
          </div>
        </div>
      </GlassCard>
      )}

      {/* MODALS */}
      {/* 1. Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => {
          fetchProducts();
        }}
        product={editingProduct}
        categories={categories}
      />

      {/* 2. Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustProduct(null);
        }}
        onSuccess={() => {
          fetchProducts();
        }}
        product={adjustProduct}
      />

      {/* 3. Product Ledger Timeline Modal */}
      <ProductLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => {
          setIsLedgerModalOpen(false);
          setLedgerProductId(null);
        }}
        productId={ledgerProductId}
        onOpenAdjustModal={(prod) => {
          setAdjustProduct(prod);
          setIsAdjustModalOpen(true);
        }}
      />

      {/* 4. Low Stock Reorder Advisor Modal */}
      <LowStockModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        onOpenAdjustModal={(prod) => {
          setAdjustProduct(prod);
          setIsAdjustModalOpen(true);
        }}
      />
    </div>
  );
};
