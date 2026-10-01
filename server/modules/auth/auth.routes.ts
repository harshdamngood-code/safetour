import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { dbQueryOne, dbQueryAll, dbRun, withTransaction, TransactionContext } from '../../db/db-adapter.js';
import { ENV } from '../../config/env.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

const REFRESH_COOKIE_NAME = 'billflow_refresh_token';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Validation Schemas
const RegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').optional(),
  businessType: z.string().optional(),
  state: z.string().optional(),
});

const LoginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone required'),
  password: z.string().min(1, 'Password required'),
});

/**
 * Computes deterministic SHA-256 hex digest of a refresh token.
 * Raw refresh tokens are NEVER stored in the database.
 */
export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Extracts cookie value from raw Cookie header without requiring external middleware.
 */
function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return undefined;
}

/**
 * Sets HttpOnly Secure SameSite cookie for refresh token.
 */
function setRefreshTokenCookie(req: Request, res: Response, refreshToken: string): void {
  const isSecure = ENV.IS_PROD || req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
  });
}

function clearRefreshTokenCookie(req: Request, res: Response): void {
  const isSecure = ENV.IS_PROD || req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/api/auth',
  });
}

export async function generateTokens(
  user: { id: string; email: string; full_name?: string; fullName?: string; phone?: string; is_super_admin?: number | boolean },
  meta?: { deviceInfo?: string; ipAddress?: string; tx?: TransactionContext }
) {
  const tokenId = uuidv4();
  const payload = {
    userId: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName || '',
    phone: user.phone || '',
    isSuperAdmin: Boolean(user.is_super_admin),
  };

  // Short-lived access token
  const accessToken = jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: (ENV.JWT_EXPIRES_IN || '15m') as any,
  });

  // Cryptographically signed + random entropy refresh token
  const refreshPayload = {
    userId: user.id,
    jti: tokenId,
    entropy: crypto.randomBytes(24).toString('hex'),
    type: 'refresh',
  };
  const refreshToken = jwt.sign(refreshPayload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: (ENV.JWT_REFRESH_EXPIRES_IN || '30d') as any,
  });

  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  await dbRun(
    `INSERT INTO refresh_tokens (
      id, user_id, token_hash, device_info, ip_address, is_revoked, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      tokenId,
      user.id,
      tokenHash,
      (meta?.deviceInfo || 'Web Client').slice(0, 250),
      (meta?.ipAddress || '127.0.0.1').slice(0, 95),
      expiresAt,
      now,
      now,
    ],
    meta?.tx
  );

  return { accessToken, refreshToken, tokenHash };
}

/**
 * POST /api/auth/register
 * Real user registration with optional instant business creation.
 */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: parseResult.error.issues[0]?.message || 'Validation failed',
        errors: parseResult.error.issues,
      });
      return;
    }

    const { fullName, email, phone, password, businessName, businessType, state } = parseResult.data;

    // Check if email already registered
    const existing = await dbQueryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'A user with this email address already exists. Please log in.',
      });
      return;
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    let createdBusinessId: string | null = null;

    await withTransaction(async (tx) => {
      // Insert user
      await tx.run(
        `INSERT INTO users (id, full_name, email, phone, password_hash, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [userId, fullName, email.toLowerCase(), phone || null, passwordHash, now, now]
      );

      // If business name provided during registration, onboard initial business
      if (businessName) {
        createdBusinessId = uuidv4();
        const stateName = state || 'Maharashtra';
        const stateCode = '27'; // Default Indian state code

        await tx.run(
          `INSERT INTO businesses (
            id, owner_id, business_name, legal_name, business_type, phone, email,
            address_line1, city, state, state_code, pincode, currency, invoice_prefix,
            invoice_next_number, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'INV', 1, ?, ?)`,
          [
            createdBusinessId,
            userId,
            businessName,
            businessName,
            businessType || 'Retail',
            phone || '+91 9999999999',
            email.toLowerCase(),
            'Main Road',
            'Mumbai',
            stateName,
            stateCode,
            '400001',
            now,
            now,
          ]
        );

        // Link owner
        await tx.run(
          `INSERT INTO business_users (id, business_id, user_id, role, is_active, created_at)
           VALUES (?, ?, ?, 'OWNER', 1, ?)`,
          [uuidv4(), createdBusinessId, userId, now]
        );
      }

      // Audit log
      await tx.run(
        `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, 'USER_REGISTERED', 'USER', ?, ?, ?, ?)`,
        [
          uuidv4(),
          createdBusinessId,
          userId,
          userId,
          JSON.stringify({ fullName, email }),
          req.ip || '127.0.0.1',
          now,
        ]
      );
    });

    const user = { id: userId, email: email.toLowerCase(), full_name: fullName, phone };
    const tokens = await generateTokens(user, {
      deviceInfo: (req.headers['user-agent'] as string) || 'Web',
      ipAddress: req.ip || '127.0.0.1',
    });

    setRefreshTokenCookie(req, res, tokens.refreshToken);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: userId,
          email: email.toLowerCase(),
          fullName,
          phone,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        activeBusinessId: createdBusinessId,
      },
    });
  } catch (err: any) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred during registration. Please try again.',
    });
  }
});

/**
 * POST /api/auth/login
 * Real login with password verification and authorized businesses retrieval.
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: parseResult.error.issues[0]?.message || 'Invalid credentials',
      });
      return;
    }

    const { identifier, password } = parseResult.data;
    const cleanId = identifier.trim().toLowerCase();

    // Find user by email or phone
    const user = await dbQueryOne<any>(
      `SELECT * FROM users WHERE (LOWER(email) = ? OR phone = ?) AND is_active = 1`,
      [cleanId, cleanId]
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email/phone or password. Please check your credentials.',
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: 'Invalid email/phone or password. Please check your credentials.',
      });
      return;
    }

    // Retrieve all businesses this user has access to
    const businesses = await dbQueryAll<any>(
      `SELECT b.id, b.business_name, b.legal_name, b.business_type, b.business_category,
              b.gstin, b.city, b.state, b.state_code, b.invoice_prefix, b.currency,
              bu.role, bu.custom_permissions
       FROM business_users bu
       JOIN businesses b ON bu.business_id = b.id
       WHERE bu.user_id = ? AND bu.is_active = 1
       ORDER BY bu.created_at ASC`,
      [user.id]
    );

    const tokens = await generateTokens(user, {
      deviceInfo: (req.headers['user-agent'] as string) || 'Web',
      ipAddress: req.ip || '127.0.0.1',
    });

    setRefreshTokenCookie(req, res, tokens.refreshToken);

    // Audit log
    await dbRun(
      `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'USER_LOGIN', 'USER', ?, ?, ?, ?)`,
      [
        uuidv4(),
        businesses[0]?.id || null,
        user.id,
        user.id,
        JSON.stringify({ device: req.headers['user-agent'] || 'Web' }),
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          isSuperAdmin: Boolean(user.is_super_admin),
        },
        businesses,
        activeBusiness: businesses[0] || null,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred during login. Please try again.',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token and rotate refresh token securely with reuse detection.
 */
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawRefreshToken =
      getCookieValue(req, REFRESH_COOKIE_NAME) ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '');

    if (!rawRefreshToken || rawRefreshToken.length < 10) {
      res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_MISSING',
        message: 'Valid refresh token required',
      });
      return;
    }

    // 1. Verify token cryptographic signature
    let decoded: any;
    try {
      decoded = jwt.verify(rawRefreshToken, ENV.JWT_REFRESH_SECRET);
    } catch {
      clearRefreshTokenCookie(req, res);
      res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Invalid or expired refresh token',
      });
      return;
    }

    const incomingHash = hashRefreshToken(rawRefreshToken);

    // 2. Check hashed token in database
    const tokenRecord = await dbQueryOne<any>(
      `SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ?`,
      [incomingHash, decoded.userId]
    );

    if (!tokenRecord) {
      clearRefreshTokenCookie(req, res);
      res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_NOT_FOUND',
        message: 'Refresh token not recognized or revoked',
      });
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 3. Detect Refresh Token Reuse (replay of an already-rotated or revoked token)
    if (tokenRecord.is_revoked === 1 || tokenRecord.is_revoked === true || tokenRecord.revoked_at) {
      // Compromised token family: revoke ALL active refresh tokens for this user immediately
      await dbRun(
        `UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ?, updated_at = ? WHERE user_id = ?`,
        [nowIso, nowIso, decoded.userId]
      );
      await dbRun(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, 'REFRESH_TOKEN_REUSE_DETECTED', 'SECURITY', ?, ?, ?, ?)`,
        [
          uuidv4(),
          decoded.userId,
          tokenRecord.id,
          JSON.stringify({ message: 'Revoked all user sessions due to refresh token replay' }),
          req.ip || '127.0.0.1',
          nowIso,
        ]
      );
      clearRefreshTokenCookie(req, res);
      res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Security alert: Refresh token was already used. All sessions have been revoked.',
      });
      return;
    }

    // 4. Enforce database-level expiration check
    if (new Date(tokenRecord.expires_at).getTime() <= now.getTime()) {
      await dbRun(
        `UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ?, updated_at = ? WHERE id = ?`,
        [nowIso, nowIso, tokenRecord.id]
      );
      clearRefreshTokenCookie(req, res);
      res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired. Please log in again.',
      });
      return;
    }

    // 5. Find active user
    const user = await dbQueryOne<any>(`SELECT * FROM users WHERE id = ? AND is_active = 1`, [decoded.userId]);
    if (!user) {
      clearRefreshTokenCookie(req, res);
      res.status(401).json({
        success: false,
        code: 'USER_INACTIVE',
        message: 'User not found or account disabled',
      });
      return;
    }

    // 6. Rotate refresh token atomically inside transaction
    const tokens = await withTransaction(async (tx) => {
      const nextTokens = await generateTokens(user, {
        deviceInfo: (req.headers['user-agent'] as string) || tokenRecord.device_info || 'Web',
        ipAddress: req.ip || tokenRecord.ip_address || '127.0.0.1',
        tx,
      });

      await tx.run(
        `UPDATE refresh_tokens
         SET is_revoked = 1, revoked_at = ?, replaced_by_token_hash = ?, updated_at = ?
         WHERE id = ?`,
        [nowIso, nextTokens.tokenHash, nowIso, tokenRecord.id]
      );

      return nextTokens;
    });

    setRefreshTokenCookie(req, res, tokens.refreshToken);

    res.json({
      success: true,
      message: 'Tokens rotated successfully',
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (err: any) {
    console.error('[Auth Refresh Error]:', err);
    res.status(500).json({ success: false, message: 'Token refresh failed' });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile & tenant memberships.
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const user = await dbQueryOne<any>(
      `SELECT id, full_name, email, phone, is_active, is_super_admin, created_at FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User account not found' });
      return;
    }

    const businesses = await dbQueryAll<any>(
      `SELECT b.id, b.business_name, b.legal_name, b.business_type, b.business_category,
              b.gstin, b.city, b.state, b.state_code, b.invoice_prefix, b.currency,
              bu.role, bu.custom_permissions
       FROM business_users bu
       JOIN businesses b ON bu.business_id = b.id
       WHERE bu.user_id = ? AND bu.is_active = 1
       ORDER BY bu.created_at ASC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          isSuperAdmin: Boolean(user.is_super_admin),
          createdAt: user.created_at,
        },
        businesses,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch user session profile' });
  }
});

/**
 * POST /api/auth/logout
 * Terminates user session and revokes refresh tokens in database.
 */
authRouter.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const nowIso = new Date().toISOString();
    const rawRefreshToken =
      getCookieValue(req, REFRESH_COOKIE_NAME) ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '');

    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await dbRun(
        `UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ?, updated_at = ? WHERE token_hash = ? AND user_id = ?`,
        [nowIso, nowIso, tokenHash, userId]
      );
    } else {
      await dbRun(
        `UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ?, updated_at = ? WHERE user_id = ? AND is_revoked = 0`,
        [nowIso, nowIso, userId]
      );
    }

    clearRefreshTokenCookie(req, res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});
