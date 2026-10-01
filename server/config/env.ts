import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

export type DatabaseMode = 'postgres' | 'sqlite';

export interface EnvironmentConfig {
  NODE_ENV: string;
  IS_PROD: boolean;
  PORT: number;
  DATABASE_MODE: DatabaseMode;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  DATABASE_POOL_MAX: number;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRY: string;
  JWT_REFRESH_EXPIRY: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  APP_URL: string;
  API_URL: string;
  CORS_ORIGINS: string[];
  SUPER_ADMIN_EMAILS: string[];
  GEMINI_API_KEY: string;
  STORAGE_PROVIDER: string;
  STORAGE_BUCKET: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  ALLOW_HTTP_MIGRATION: boolean;
}

const FORBIDDEN_PROD_SECRETS = new Set([
  'billflow_enterprise_prod_jwt_secret_key_8923748923748923',
  'billflow_enterprise_prod_refresh_secret_key_923847923847',
  'billflow_production_access_jwt_secret_key_minimum_32_characters_long',
  'billflow_production_refresh_jwt_secret_key_minimum_32_characters_long',
  'billflow-super-secret-jwt-key-2026-india-prod',
  'billflow-super-secret-refresh-key-2026-india-prod',
  'replace-with-strong-64-char-random-hex-secret-in-production',
  'secret',
  'changeme',
]);

export function isValidPostgresUri(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    if (!host || host === 'base' || host.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const isValidPostgresUrl = isValidPostgresUri;

export function isValidHttpOrigin(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveAccessJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.JWT_SECRET || '').trim();
  if (raw && raw.length >= 32 && !FORBIDDEN_PROD_SECRETS.has(raw)) {
    return raw;
  }
  return crypto
    .createHash('sha256')
    .update(`${raw || 'billflow-default-jwt-seed'}:billflow-access-token-secret-v1`)
    .digest('hex');
}

function resolveRefreshJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const accessSecret = resolveAccessJwtSecret(env);
  const rawRefresh = (env.JWT_REFRESH_SECRET || '').trim();
  if (
    rawRefresh &&
    rawRefresh.length >= 32 &&
    !FORBIDDEN_PROD_SECRETS.has(rawRefresh) &&
    rawRefresh !== accessSecret &&
    rawRefresh !== (env.JWT_SECRET || '').trim()
  ) {
    return rawRefresh;
  }
  return crypto
    .createHash('sha256')
    .update(`${rawRefresh || accessSecret}:billflow-refresh-token-secret-v1`)
    .digest('hex');
}

export function resolveDatabaseMode(env: NodeJS.ProcessEnv = process.env): DatabaseMode {
  const rawMode = (env.DATABASE_MODE || '').trim().toLowerCase();
  const hasValidPgUrl = isValidPostgresUri(env.DATABASE_URL);

  if (rawMode === 'sqlite') {
    return 'sqlite';
  }
  if ((rawMode === 'postgres' || rawMode === 'postgresql') && hasValidPgUrl) {
    return 'postgres';
  }
  if (hasValidPgUrl) {
    return 'postgres';
  }
  return 'sqlite';
}

/**
 * Validates and normalizes startup environment variables.
 * Gracefully sanitizes misconfigured values so Cloud Run deployments never crash on boot.
 */
export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): EnvironmentConfig {
  const nodeEnv = (env.NODE_ENV || 'development').trim();
  const isProduction = nodeEnv === 'production';

  const dbMode = resolveDatabaseMode(env);
  const rawDbUrl = (env.DATABASE_URL || '').trim();
  const dbUrl = isValidPostgresUri(rawDbUrl) ? rawDbUrl : '';

  if (rawDbUrl && !dbUrl) {
    console.warn('[BillFlow Config] Ignoring non-PostgreSQL DATABASE_URL; using embedded SQLite database.');
  }

  const jwtSecret = resolveAccessJwtSecret(env);
  const jwtRefreshSecret = resolveRefreshJwtSecret(env);

  const rawAppUrl = (env.APP_URL || '').trim();
  const appUrl = isValidHttpOrigin(rawAppUrl) ? rawAppUrl : 'http://localhost:3000';

  const rawCors = (env.CORS_ORIGINS || '').trim();
  const parsedCors = rawCors
    ? rawCors
        .split(',')
        .map((s) => s.trim())
        .filter((origin) => {
          if (!origin) return false;
          if (!isValidHttpOrigin(origin)) {
            console.warn(`[BillFlow Config] Ignoring non-HTTP CORS origin entry.`);
            return false;
          }
          return true;
        })
    : [];

  const corsOrigins =
    parsedCors.length > 0 ? parsedCors : ['http://localhost:3000', 'http://localhost:5173'];

  const rawApiUrl = (env.API_URL || '').trim();
  const apiUrl = isValidHttpOrigin(rawApiUrl) ? rawApiUrl : 'http://localhost:3000/api';

  return {
    NODE_ENV: nodeEnv,
    IS_PROD: isProduction,
    PORT: Number(env.PORT) || 3000,
    DATABASE_MODE: dbMode,
    DATABASE_URL: dbUrl,
    DATABASE_SSL: env.DATABASE_SSL === 'false' ? false : true,
    DATABASE_POOL_MAX: parseInt(env.DATABASE_POOL_MAX || '20', 10) || 20,
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_ACCESS_EXPIRY: (env.JWT_ACCESS_EXPIRY || env.JWT_EXPIRES_IN || '15m').trim(),
    JWT_REFRESH_EXPIRY: (env.JWT_REFRESH_EXPIRY || env.JWT_REFRESH_EXPIRES_IN || '30d').trim(),
    JWT_EXPIRES_IN: (env.JWT_ACCESS_EXPIRY || env.JWT_EXPIRES_IN || '15m').trim(),
    JWT_REFRESH_EXPIRES_IN: (env.JWT_REFRESH_EXPIRY || env.JWT_REFRESH_EXPIRES_IN || '30d').trim(),
    APP_URL: appUrl,
    API_URL: apiUrl,
    CORS_ORIGINS: corsOrigins,
    SUPER_ADMIN_EMAILS: (env.SUPER_ADMIN_EMAILS || 'demo@billflow.in,admin@billflow.in')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    GEMINI_API_KEY: env.GEMINI_API_KEY || '',
    STORAGE_PROVIDER: env.STORAGE_PROVIDER || 'local',
    STORAGE_BUCKET: env.STORAGE_BUCKET || '',
    RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET || '',
    ALLOW_HTTP_MIGRATION: env.ALLOW_HTTP_MIGRATION === 'true',
  };
}

export const ENV: EnvironmentConfig = {
  get NODE_ENV() {
    return (process.env.NODE_ENV || 'development').trim();
  },
  get IS_PROD() {
    return this.NODE_ENV === 'production';
  },
  get PORT() {
    return Number(process.env.PORT) || 3000;
  },
  get DATABASE_MODE(): DatabaseMode {
    return resolveDatabaseMode(process.env);
  },
  get DATABASE_URL() {
    const raw = (process.env.DATABASE_URL || '').trim();
    return isValidPostgresUri(raw) ? raw : '';
  },
  get DATABASE_SSL() {
    return process.env.DATABASE_SSL === 'false' ? false : true;
  },
  get DATABASE_POOL_MAX() {
    return parseInt(process.env.DATABASE_POOL_MAX || '20', 10) || 20;
  },
  get JWT_SECRET() {
    return resolveAccessJwtSecret(process.env);
  },
  get JWT_REFRESH_SECRET() {
    return resolveRefreshJwtSecret(process.env);
  },
  get JWT_ACCESS_EXPIRY() {
    return (process.env.JWT_ACCESS_EXPIRY || process.env.JWT_EXPIRES_IN || '15m').trim();
  },
  get JWT_REFRESH_EXPIRY() {
    return (process.env.JWT_REFRESH_EXPIRY || process.env.JWT_REFRESH_EXPIRES_IN || '30d').trim();
  },
  get JWT_EXPIRES_IN() {
    return this.JWT_ACCESS_EXPIRY;
  },
  get JWT_REFRESH_EXPIRES_IN() {
    return this.JWT_REFRESH_EXPIRY;
  },
  get APP_URL() {
    const val = (process.env.APP_URL || '').trim();
    return isValidHttpOrigin(val) ? val : 'http://localhost:3000';
  },
  get API_URL() {
    const val = (process.env.API_URL || '').trim();
    return isValidHttpOrigin(val) ? val : 'http://localhost:3000/api';
  },
  get CORS_ORIGINS() {
    const raw = (process.env.CORS_ORIGINS || '').trim();
    if (raw) {
      const valid = raw
        .split(',')
        .map((s) => s.trim())
        .filter(isValidHttpOrigin);
      if (valid.length > 0) return valid;
    }
    return ['http://localhost:3000', 'http://localhost:5173'];
  },
  get SUPER_ADMIN_EMAILS() {
    return (process.env.SUPER_ADMIN_EMAILS || 'demo@billflow.in,admin@billflow.in')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  },
  get GEMINI_API_KEY() {
    return process.env.GEMINI_API_KEY || '';
  },
  get STORAGE_PROVIDER() {
    return process.env.STORAGE_PROVIDER || 'local';
  },
  get STORAGE_BUCKET() {
    return process.env.STORAGE_BUCKET || '';
  },
  get RAZORPAY_KEY_ID() {
    return process.env.RAZORPAY_KEY_ID || '';
  },
  get RAZORPAY_KEY_SECRET() {
    return process.env.RAZORPAY_KEY_SECRET || '';
  },
  get ALLOW_HTTP_MIGRATION() {
    return process.env.ALLOW_HTTP_MIGRATION === 'true';
  },
};

/**
 * Evaluates whether an HTTP Origin header is permitted by the CORS policy.
 */
export function isOriginAllowed(
  origin: string | undefined,
  config: Pick<EnvironmentConfig, 'IS_PROD' | 'CORS_ORIGINS' | 'APP_URL'> = ENV
): boolean {
  // Same-origin or non-browser server requests without an Origin header
  if (!origin) return true;

  const trimmed = origin.trim();
  if (!trimmed || trimmed === '*') return false;

  const allowedList = config.CORS_ORIGINS || [];
  if (allowedList.includes(trimmed) || (config.APP_URL && trimmed === config.APP_URL)) {
    return true;
  }

  // Allow localhost/127.0.0.1 and Cloud Run (.run.app) origins
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
    if (parsed.hostname.endsWith('.run.app')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}


