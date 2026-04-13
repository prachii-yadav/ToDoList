import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import logger from '../utils/logger';

/**
 * Global error-handling middleware.
 *
 * Express recognises a 4-argument function signature as an error handler.
 * All unhandled errors thrown in controllers/services flow here via next(err).
 *
 * Error mapping:
 *  ZodError  → 400  (schema validation failures — request body / params / query)
 *  AppError  → uses the statusCode embedded in the error class (400 / 404 / 409 / 422)
 *  Anything else → 500 (unexpected bug — full stack logged, safe message to client)
 *
 * SOLID — Open/Closed:
 *   Adding a new AppError subclass (e.g. UnauthorizedError with statusCode 401)
 *   requires ZERO changes here — the statusCode is already on the error.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] ?? 'n/a';

  // ── Zod validation error (malformed request shape) ─────────────────────────
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

  // ── Operational error (AppError subclass) ──────────────────────────────────
  // These are expected domain errors — log at warn level, forward statusCode
  if (err instanceof AppError) {
    logger.warn(`[${requestId}] ${err.name} (${err.statusCode}): ${err.message}`);

    res.status(err.statusCode).json({
      success:   false,
      error:     err.message,
      requestId,
    });
    return;
  }

  // ── Unexpected error (bug / unhandled exception) ───────────────────────────
  // Log full stack trace at error level — never expose internals to client
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[${requestId}] Unexpected error: ${message}`, err instanceof Error ? err : undefined);

  res.status(500).json({
    success:   false,
    error:     'An unexpected error occurred. Please try again later.',
    requestId,
  });
}
