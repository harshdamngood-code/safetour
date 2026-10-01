import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, BusinessSummary, AuthResponseData } from '../types/auth.types';
import { apiRequest, tokenStorage, refreshAccessToken } from '../lib/api';
import { syncManager } from '../lib/offline-sync';

interface AuthContextType {
  user: User | null;
  businesses: BusinessSummary[];
  activeBusiness: BusinessSummary | null;
  activeBusinessId: string | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    businessName?: string;
    businessType?: string;
    state?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  switchBusiness: (businessId: string) => void;
  refreshUserData: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<BusinessSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeBusinessId = activeBusiness?.id || null;

  const refreshUserData = useCallback(async () => {
    let token = tokenStorage.getToken();
    if (!token) {
      // Attempt silent cookie-based token refresh if HttpOnly refresh cookie exists
      token = await refreshAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
    }

    try {
      const res = await apiRequest<{ user: User; businesses: BusinessSummary[] }>('/auth/me');
      setUser(res.data.user);
      setBusinesses(res.data.businesses || []);

      const savedBizId = tokenStorage.getActiveBusinessId();
      const match = res.data.businesses.find((b) => b.id === savedBizId);
      const chosen = match || res.data.businesses[0] || null;

      setActiveBusiness(chosen);
      if (chosen) {
        tokenStorage.setActiveBusinessId(chosen.id);
        void syncManager.flushQueue();
      }
    } catch (err: any) {
      console.warn('[Auth] Session invalid or expired:', err.message);
      tokenStorage.clearAll();
      setUser(null);
      setBusinesses([]);
      setActiveBusiness(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  useEffect(() => {
    return tokenStorage.onAuthFailure(() => {
      syncManager.stopPendingSync();
      setUser(null);
      setBusinesses([]);
      setActiveBusiness(null);
    });
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AuthResponseData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      const { user, businesses, activeBusiness, tokens } = res.data;
      tokenStorage.setToken(tokens.accessToken);
      if (tokens.refreshToken) {
        tokenStorage.setRefreshTokenMemory(tokens.refreshToken);
      }

      setUser(user);
      setBusinesses(businesses);

      const chosen = activeBusiness || businesses[0] || null;
      setActiveBusiness(chosen);
      if (chosen) {
        await syncManager.switchTenant(chosen.id);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    businessName?: string;
    businessType?: string;
    state?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{
        user: User;
        tokens: { accessToken: string; refreshToken: string };
        activeBusinessId: string | null;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      tokenStorage.setToken(res.data.tokens.accessToken);
      if (res.data.tokens.refreshToken) {
        tokenStorage.setRefreshTokenMemory(res.data.tokens.refreshToken);
      }
      if (res.data.activeBusinessId) {
        tokenStorage.setActiveBusinessId(res.data.activeBusinessId);
      }
      await refreshUserData();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    syncManager.stopPendingSync();
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: tokenStorage.getRefreshTokenMemory() || undefined,
        }),
      });
    } catch {
      // ignore logout failure on network error
    } finally {
      await syncManager.clearTenantCache();
      tokenStorage.clearAll();
      setUser(null);
      setBusinesses([]);
      setActiveBusiness(null);
    }
  };

  const switchBusiness = (businessId: string) => {
    const target = businesses.find((b) => b.id === businessId);
    if (target) {
      setActiveBusiness(target);
      void syncManager.switchTenant(target.id);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        businesses,
        activeBusiness,
        activeBusinessId,
        token: tokenStorage.getToken(),
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        switchBusiness,
        refreshUserData,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
