import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { apiRequest, tokenStorage, ApiError } from './api';

export type QueuedOperationStatus = 'PENDING' | 'SYNCING' | 'APPLIED' | 'SKIPPED' | 'FAILED';

export interface QueuedSyncOperation {
  operation_id: string;
  business_id: string;
  device_id: string;
  action: string;
  entity_type: string;
  payload: any;
  status: QueuedOperationStatus;
  created_at: string;
  retries: number;
  next_retry_at?: number;
  last_error?: string;
  last_attempt?: string;
}

interface BillFlowDB extends DBSchema {
  products: {
    key: string;
    value: any;
    indexes: { 'by-barcode': string; 'by-name': string; 'by-business': string };
  };
  customers: {
    key: string;
    value: any;
    indexes: { 'by-phone': string; 'by-business': string };
  };
  sync_queue: {
    key: string;
    value: QueuedSyncOperation;
  };
}

let dbPromise: Promise<IDBPDatabase<BillFlowDB>> | null = null;

function createOperationUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `op_${crypto.randomUUID()}`;
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = openDB<BillFlowDB>('billflow_offline_store', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const pStore = db.createObjectStore('products', { keyPath: 'id' });
          pStore.createIndex('by-barcode', 'barcode');
          pStore.createIndex('by-name', 'name');

          const cStore = db.createObjectStore('customers', { keyPath: 'id' });
          cStore.createIndex('by-phone', 'phone');

          db.createObjectStore('sync_queue', { keyPath: 'operation_id' });
        }
      },
    });
  }
  return dbPromise;
}

export type SyncState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'SYNC_ERROR';

const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 300000; // 5 minutes

export function calculateBackoffDelay(retries: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, retries - 1)));
  const jitter = Math.floor(Math.random() * 500);
  return exp + jitter;
}

class SyncManager {
  private listeners: Array<(state: SyncState, pendingCount: number) => void> = [];
  private state: SyncState = typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private currentSyncTenantId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.state = 'ONLINE';
        this.notify();
        this.flushQueue();
      });
      window.addEventListener('offline', () => {
        this.state = 'OFFLINE';
        this.stopPendingSync();
        this.notify();
      });
    }
  }

  public subscribe(cb: (state: SyncState, pendingCount: number) => void) {
    this.listeners.push(cb);
    this.notify();
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public stopPendingSync(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.isFlushing = false;
  }

  private async notify() {
    try {
      const db = await getOfflineDB();
      const activeBusinessId = tokenStorage.getActiveBusinessId();
      const allOps = await db.getAll('sync_queue');
      const tenantOps = activeBusinessId
        ? allOps.filter((op) => op.business_id === activeBusinessId)
        : [];
      this.listeners.forEach((l) => l(this.state, tenantOps.length));
    } catch {
      // ignore in SSR or non-IDB environments
    }
  }

  /**
   * Enqueues an offline creation or mutation operation with strict tenant isolation and persistent device UUID.
   */
  public async queueOperation(
    action: string,
    entityType: string,
    payload: any,
    explicitBusinessId?: string
  ): Promise<string> {
    const businessId = explicitBusinessId || tokenStorage.getActiveBusinessId();
    if (!businessId) {
      throw new Error('Cannot queue offline operation without an active business tenant.');
    }

    const db = await getOfflineDB();
    const opId = payload?.operation_id || createOperationUUID();
    const deviceId = tokenStorage.getDeviceId();

    const record: QueuedSyncOperation = {
      operation_id: opId,
      business_id: businessId,
      device_id: deviceId,
      action,
      entity_type: entityType,
      payload,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      retries: 0,
      next_retry_at: Date.now(),
    };

    await db.put('sync_queue', record);
    await this.notify();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void this.flushQueue();
    }

    return opId;
  }

  /**
   * Cache products locally for instantaneous offline lookup & POS barcode scans (tagged with active business_id)
   */
  public async cacheProducts(products: any[], businessId?: string) {
    const activeBiz = businessId || tokenStorage.getActiveBusinessId();
    if (!activeBiz) return;
    const db = await getOfflineDB();
    const tx = db.transaction('products', 'readwrite');
    for (const p of products) {
      await tx.store.put({ ...p, business_id: p.business_id || activeBiz });
    }
    await tx.done;
  }

  /**
   * Cache customers locally (tagged with active business_id)
   */
  public async cacheCustomers(customers: any[], businessId?: string) {
    const activeBiz = businessId || tokenStorage.getActiveBusinessId();
    if (!activeBiz) return;
    const db = await getOfflineDB();
    const tx = db.transaction('customers', 'readwrite');
    for (const c of customers) {
      await tx.store.put({ ...c, business_id: c.business_id || activeBiz });
    }
    await tx.done;
  }

  /**
   * Fast offline product search with strict tenant verification
   */
  public async findProductOffline(query: string, businessId?: string) {
    const targetBiz = businessId || tokenStorage.getActiveBusinessId();
    if (!targetBiz) return [];

    const db = await getOfflineDB();
    const all = await db.getAll('products');
    const q = query.toLowerCase().trim();
    return all.filter((p) => {
      if (p.business_id !== targetBiz) return false;
      return p.name?.toLowerCase().includes(q) || p.barcode === q || p.sku === q;
    });
  }

  /**
   * Purges cached catalog data (products/customers) for the old tenant while preserving
   * unsynced tenant-scoped queue items safely isolated by business_id.
   */
  public async clearTenantCache() {
    try {
      const db = await getOfflineDB();
      const pTx = db.transaction('products', 'readwrite');
      await pTx.store.clear();
      await pTx.done;

      const cTx = db.transaction('customers', 'readwrite');
      await cTx.store.clear();
      await cTx.done;
    } catch (err) {
      console.warn('[Offline Sync] Failed to clear local cache:', err);
    }
  }

  /**
   * Safe tenant switch handler (Requirement #4):
   * 1. Stop pending sync for old tenant
   * 2. Clear old tenant cache
   * 3. Update active tenant ID
   * 4. Refresh queue state for new tenant without allowing cross-tenant sync
   */
  public async switchTenant(newBusinessId: string | null): Promise<void> {
    this.stopPendingSync();
    await this.clearTenantCache();
    this.currentSyncTenantId = newBusinessId;
    if (newBusinessId) {
      tokenStorage.setActiveBusinessId(newBusinessId);
    } else {
      tokenStorage.clearActiveBusinessId();
    }
    await this.notify();
    if (newBusinessId && typeof navigator !== 'undefined' && navigator.onLine) {
      void this.flushQueue();
    }
  }

  /**
   * Sends pending queued mutations for the currently authenticated active business to `/api/sync/batch`.
   * Uses centralized `apiRequest` so 401 access token expiry automatically refreshes and retries.
   */
  public async flushQueue(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.state = 'OFFLINE';
      await this.notify();
      return;
    }

    if (this.isFlushing) return;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const activeBusinessId = tokenStorage.getActiveBusinessId();
    const accessToken = tokenStorage.getToken();

    // Must have an authenticated session and active business to sync
    if (!activeBusinessId || !accessToken) {
      return;
    }

    this.currentSyncTenantId = activeBusinessId;
    const db = await getOfflineDB();
    const allOps = await db.getAll('sync_queue');

    // STRICT TENANT ISOLATION: Only select operations belonging to `activeBusinessId`
    const tenantOps = allOps.filter((o) => o.business_id === activeBusinessId);

    if (tenantOps.length === 0) {
      this.state = 'SYNCED';
      await this.notify();
      return;
    }

    const nowMs = Date.now();
    const eligibleOps = tenantOps.filter(
      (op) => (op.retries || 0) < MAX_RETRIES && (!op.next_retry_at || op.next_retry_at <= nowMs)
    );

    if (eligibleOps.length === 0) {
      const hasExhausted = tenantOps.some((op) => (op.retries || 0) >= MAX_RETRIES);
      if (hasExhausted) {
        this.state = 'SYNC_ERROR';
      } else {
        // Schedule timer for the earliest next_retry_at
        const nextTimes = tenantOps
          .map((op) => op.next_retry_at || nowMs + BASE_BACKOFF_MS)
          .filter((t) => t > nowMs);
        if (nextTimes.length > 0) {
          const delay = Math.max(1000, Math.min(...nextTimes) - nowMs);
          this.retryTimer = setTimeout(() => void this.flushQueue(), delay);
        }
      }
      await this.notify();
      return;
    }

    this.isFlushing = true;
    this.state = 'SYNCING';
    await this.notify();

    const deviceId = tokenStorage.getDeviceId();

    try {
      const data = await apiRequest<{
        processed: number;
        results: Array<{
          operation_id: string;
          status: 'APPLIED' | 'SKIPPED' | 'FAILED';
          entity_id?: string | null;
          error?: string;
        }>;
      }>('/sync/batch', {
        method: 'POST',
        businessIdOverride: activeBusinessId,
        body: JSON.stringify({
          operations: eligibleOps.map((o) => ({
            operation_id: o.operation_id,
            business_id: o.business_id,
            device_id: o.device_id || deviceId,
            action: o.action,
            entity_type: o.entity_type,
            payload: o.payload,
            timestamp: o.created_at,
          })),
        }),
      });

      // Verify tenant did not switch while request was in flight
      if (tokenStorage.getActiveBusinessId() !== activeBusinessId) {
        this.isFlushing = false;
        return;
      }

      type SyncBatchResultItem = {
        operation_id: string;
        status: 'APPLIED' | 'SKIPPED' | 'FAILED';
        entity_id?: string | null;
        error?: string;
      };
      const results: SyncBatchResultItem[] = (data as any).results || data.data?.results || [];
      const resultMap = new Map<string, SyncBatchResultItem>(
        results.map((r: SyncBatchResultItem) => [r.operation_id, r])
      );

      let hasFailures = false;
      let minBackoff = MAX_BACKOFF_MS;
      const tx = db.transaction('sync_queue', 'readwrite');

      for (const op of eligibleOps) {
        const res = resultMap.get(op.operation_id);
        // Delete ONLY when server confirms APPLIED or safely SKIPPED (idempotent duplicate)
        if (res && (res.status === 'APPLIED' || res.status === 'SKIPPED')) {
          await tx.store.delete(op.operation_id);
        } else {
          hasFailures = true;
          const nextRetries = (op.retries || 0) + 1;
          const backoffMs = calculateBackoffDelay(nextRetries);
          minBackoff = Math.min(minBackoff, backoffMs);
          await tx.store.put({
            ...op,
            status: 'FAILED',
            retries: nextRetries,
            next_retry_at: Date.now() + backoffMs,
            last_error: res?.error || 'Sync rejected by server',
            last_attempt: new Date().toISOString(),
          });
        }
      }
      await tx.done;

      if (hasFailures) {
        this.state = 'SYNC_ERROR';
        this.retryTimer = setTimeout(() => void this.flushQueue(), minBackoff);
      } else {
        this.state = 'SYNCED';
      }
    } catch (err: any) {
      const isAuthErr = err instanceof ApiError && err.status === 401;
      let minBackoff = MAX_BACKOFF_MS;
      const tx = db.transaction('sync_queue', 'readwrite');
      for (const op of eligibleOps) {
        const nextRetries = (op.retries || 0) + 1;
        const backoffMs = calculateBackoffDelay(nextRetries);
        minBackoff = Math.min(minBackoff, backoffMs);
        await tx.store.put({
          ...op,
          status: 'FAILED',
          retries: nextRetries,
          next_retry_at: Date.now() + backoffMs,
          last_error: err?.message || 'Network or server error during sync',
          last_attempt: new Date().toISOString(),
        });
      }
      await tx.done;
      this.state = 'SYNC_ERROR';
      if (!isAuthErr) {
        this.retryTimer = setTimeout(() => void this.flushQueue(), minBackoff);
      }
    } finally {
      this.isFlushing = false;
      await this.notify();
    }
  }

  public async getPendingOperations(businessId?: string): Promise<QueuedSyncOperation[]> {
    const db = await getOfflineDB();
    const targetBiz = businessId || tokenStorage.getActiveBusinessId();
    const all = await db.getAll('sync_queue');
    return targetBiz ? all.filter((op) => op.business_id === targetBiz) : all;
  }

  public async retryAll(): Promise<void> {
    const db = await getOfflineDB();
    const activeBusinessId = tokenStorage.getActiveBusinessId();
    const ops = await db.getAll('sync_queue');
    const tx = db.transaction('sync_queue', 'readwrite');
    for (const op of ops) {
      if (!activeBusinessId || op.business_id === activeBusinessId) {
        await tx.store.put({
          ...op,
          status: 'PENDING',
          retries: 0,
          next_retry_at: Date.now(),
        });
      }
    }
    await tx.done;
    return this.flushQueue();
  }
}

export const syncManager = new SyncManager();
