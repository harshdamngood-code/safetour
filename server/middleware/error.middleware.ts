import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Centralized API Error Handling Middleware
 * Ensures consistent JSON response structure and prevents leaking internal stack traces in production.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[API Error] ${req.method} ${req.originalUrl} - Status: ${statusCode}:`, err);

  const responsePayload: {
    success: false;
    message: string;
    code: string;
    details?: any;
  } = {
    success: false,
    message: isProduction && statusCode === 500 ? 'An internal server error occurred' : err.message || 'Internal Server Error',
    code: err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR'),
  };

  if (!isProduction && err.details) {
    responsePayload.details = err.details;
  }

  res.status(statusCode).json(responsePayload);
}
