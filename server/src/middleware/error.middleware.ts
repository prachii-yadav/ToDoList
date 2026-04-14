import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import logger from '../utils/logger';

/**
 * Global error handler (4-arg signature required by Express).
 * ZodError → 400, AppError → its statusCode, everything else → 500.
 * New AppError subclasses need no changes here — statusCode is on the error.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] ?? 'n/a';

  // ── Zod: malformed request shape ──────────────────────────────────────────
  if (err instanceof ZodError) {
    const issues = err.issues.map(e => ({
      field:   e.path.map(String).join('.') || 'body',
      message: e.message,
    }));

    logger.warn(`[${requestId}] Validation failed: ${JSON.stringify(issues)}`);

    res.status(400).json({
      success:   false,
      error:     'Validation failed',
      issues,
      requestId,
    });
    return;
  }

  // ── express.json() body-size limit exceeded ───────────────────────────────
  if (
    err instanceof Error &&
    (err as Error & { status?: number }).status === 413
  ) {
    logger.warn(`[${requestId}] Request body too large`);
    res.status(413).json({
      success:   false,
      error:     'Request body exceeds the 10kb size limit.',
      requestId,
    });
    return;
  }

  // ── Expected domain error (AppError subclass) ─────────────────────────────
  if (err instanceof AppError) {
    logger.warn(`[${requestId}] ${err.name} (${err.statusCode}): ${err.message}`);

    res.status(err.statusCode).json({
      success:   false,
      error:     err.message,
      requestId,
    });
    return;
  }

  // ── Unexpected error — log full trace, return safe message ────────────────
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[${requestId}] Unexpected error: ${message}`, err instanceof Error ? err : undefined);

  res.status(500).json({
    success:   false,
    error:     'An unexpected error occurred. Please try again later.',
    requestId,
  });
}
