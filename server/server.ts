import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { validateEnvironment, ENV, isOriginAllowed } from './config/env.js';
import { initDatabase, checkDatabaseHealth, shutdownDatabase } from './db/db-adapter.js';
import { errorHandler } from './middleware/error.middleware.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { businessRouter } from './modules/business/business.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { onboardingRouter } from './modules/onboarding/onboarding.routes.js';
import { partiesRouter } from './modules/parties/parties.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { purchasesRouter } from './modules/purchases/purchases.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { returnsRouter } from './modules/returns/returns.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';

async function startServer() {
  // 1. Validate Environment variables (Fail Fast in production)
  console.log('[BillFlow Server] Step 1/4: Validating runtime environment...');
  validateEnvironment();

  // 2. Initialize and verify database connectivity & schema (CRITICAL RULE #1 & #2)
  console.log('[BillFlow Server] Step 2/4: Initializing database & verifying schema...');
  await initDatabase();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy for Cloud Run & container reverse proxy environments
  app.set('trust proxy', 1);

  // 3. Security Hardening & Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows embedded Vite development and inline SVGs/styles
      frameguard: false, // Allow rendering inside AI Studio preview iframe
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, ENV)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin '${origin}' is not permitted by CORS policy`), false);
      },
      credentials: true,
    })
  );

  // Global Body Parsers
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Rate limiter for authentication attempts
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
      default: false,
    },
  });

  // Request logger for API calls
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path} - Tenant: ${req.headers['x-business-id'] || 'None'}`);
    }
    next();
  });

  // Real Database Health Check Endpoint (Rule #10)
  app.get('/api/health', async (req: Request, res: Response) => {
    const health = await checkDatabaseHealth();
    const isHealthy = health.status === 'healthy';

    res.status(isHealthy ? 200 : 503).json({
      status: health.status,
      app: 'BillFlow Enterprise Billing & Accounting SaaS',
      version: '2.5.0-PROD',
      timestamp: new Date().toISOString(),
      database: health.database,
      engine: health.engine,
      latencyMs: health.latencyMs,
      version_info: health.version,
      ...(health.error ? { error: health.error } : {}),
    });
  });

  // Mount API Domain Routes FIRST
  console.log('[BillFlow Server] Step 3/4: Mounting API domain routers...');
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/business', businessRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/parties', partiesRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/sync', syncRouter);

  // 404 handler for API routes
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.path}`,
      code: 'NOT_FOUND',
    });
  });

  // Centralized Error Handler (Rule #27)
  app.use(errorHandler);

  // Explicit PWA and public static asset serving with cross-origin headers
  const publicDir = path.join(process.cwd(), 'public');
  app.get(['/manifest.json', '/manifest.webmanifest'], (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(publicDir, 'manifest.json'));
  });
  app.get('/sw.js', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'sw.js'));
  });
  app.use(express.static(publicDir));

  // Vite middleware for development OR static asset serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 4. Start HTTP Server
  console.log('[BillFlow Server] Step 4/4: Binding HTTP listener...');
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 [BillFlow SaaS] Running on http://0.0.0.0:${PORT}`);
    console.log(`====================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[BillFlow Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[BillFlow Server] HTTP connections closed.');
      await shutdownDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('====================================================');
  console.error('[BillFlow Server FATAL Startup Error]:', err);
  console.error('====================================================');
  process.exit(1);
});
