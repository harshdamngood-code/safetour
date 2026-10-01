const TOKEN_KEY = 'billflow_access_token';
const ACTIVE_BIZ_KEY = 'billflow_active_business_id';
const DEVICE_ID_KEY = 'billflow_device_id';

// Legacy keys to migrate and purge immediately on startup
const LEGACY_TOKEN_KEY = 'billflow_token';
const LEGACY_BIZ_KEY = 'billflow_business_id';

// Refresh token is kept strictly in memory (never in localStorage) alongside HttpOnly cookie
let inMemoryRefreshToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const authFailureListeners = new Set<() => void>();

function migrateLegacyStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacyToken) {
      if (!localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(TOKEN_KEY, legacyToken);
      }
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }

    const legacyBiz = localStorage.getItem(LEGACY_BIZ_KEY);
    if (legacyBiz) {
      if (!localStorage.getItem(ACTIVE_BIZ_KEY)) {
        localStorage.setItem(ACTIVE_BIZ_KEY, legacyBiz);
      }
      localStorage.removeItem(LEGACY_BIZ_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

migrateLegacyStorage();

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: any[];

  constructor(message: string, status: number, code?: string, errors?: any[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export const tokenStorage = {
  getToken: (): string | null => {
    migrateLegacyStorage();
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  },
  setToken: (token: string): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  },
  clearToken: (): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    inMemoryRefreshToken = null;
  },
  getRefreshTokenMemory: (): string | null => inMemoryRefreshToken,
  setRefreshTokenMemory: (refreshToken: string | null): void => {
    inMemoryRefreshToken = refreshToken;
  },
  getActiveBusinessId: (): string | null => {
    migrateLegacyStorage();
    return typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_BIZ_KEY) : null;
  },
  setActiveBusinessId: (id: string): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_BIZ_KEY, id);
      localStorage.removeItem(LEGACY_BIZ_KEY);
    }
  },
  clearActiveBusinessId: (): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACTIVE_BIZ_KEY);
      localStorage.removeItem(LEGACY_BIZ_KEY);
    }
  },
  getDeviceId: (): string => {
    if (typeof localStorage === 'undefined') return 'server_env';
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      devId = `dev_${generateUUID()}`;
      localStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  },
  clearAll: (): void => {
    tokenStorage.clearToken();
    tokenStorage.clearActiveBusinessId();
  },
  onAuthFailure: (listener: () => void): (() => void) => {
    authFailureListeners.add(listener);
    return () => {
      authFailureListeners.delete(listener);
    };
  },
};

function notifyAuthFailure(): void {
  tokenStorage.clearAll();
  authFailureListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener error
    }
  });
}

/**
 * Performs single-flight refresh token rotation via `/api/auth/refresh`.
 * Uses HttpOnly cookie (`credentials: 'include'`) and in-memory refreshToken fallback.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          inMemoryRefreshToken ? { refreshToken: inMemoryRefreshToken } : {}
        ),
      });

      if (!response.ok) {
        notifyAuthFailure();
        return null;
      }

      const data = await response.json();
      const newAccessToken = data?.data?.tokens?.accessToken;
      const newRefreshToken = data?.data?.tokens?.refreshToken;

      if (newAccessToken) {
        tokenStorage.setToken(newAccessToken);
        if (newRefreshToken) {
          tokenStorage.setRefreshTokenMemory(newRefreshToken);
        }
        return newAccessToken;
      }

      notifyAuthFailure();
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export interface ApiRequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
  businessIdOverride?: string;
}

/**
 * Centralized Production API Gateway for all authenticated and public requests.
 * Automatically attaches Authorization, X-Business-ID, JSON headers, handles 401 token
 * refresh & single retry, and normalizes API errors.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<{ success: boolean; data: T; message?: string; [key: string]: any }> {
  const normalizedEndpoint = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;

  const executeFetch = async (overrideToken?: string | null) => {
    const token = overrideToken !== undefined ? overrideToken : tokenStorage.getToken();
    const businessId = options.businessIdOverride || tokenStorage.getActiveBusinessId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (businessId && !headers['X-Business-ID'] && !headers['x-business-id']) {
      headers['X-Business-ID'] = businessId;
    }

    const { skipAuthRefresh: _skip, businessIdOverride: _biz, ...fetchInit } = options;

    return fetch(`/api${normalizedEndpoint}`, {
      ...fetchInit,
      credentials: 'include',
      headers,
    });
  };

  let response = await executeFetch();

  // Automatic 401 Refresh-Token Rotation & Retry
  const isAuthEndpoint =
    normalizedEndpoint.startsWith('/auth/login') ||
    normalizedEndpoint.startsWith('/auth/register') ||
    normalizedEndpoint.startsWith('/auth/refresh') ||
    normalizedEndpoint.startsWith('/auth/logout');

  if (response.status === 401 && !isAuthEndpoint && !options.skipAuthRefresh) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await executeFetch(refreshedToken);
    }
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = { success: false, message: 'Invalid response from server' };
  }

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || `Request failed with status ${response.status}`,
      response.status,
      data.code,
      data.errors
    );
  }

  return data;
}

export const api = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
