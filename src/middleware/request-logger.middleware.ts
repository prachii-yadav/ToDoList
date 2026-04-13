import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * requestLoggerMiddleware — logs every HTTP request with timing.
 *
 * Attaches a unique request ID (x-request-id) to each request so all log
 * lines for that request can be correlated in log aggregators (Datadog, etc.).
 *
 * Output format:
 *   [reqId] --> METHOD /path
 *   [reqId] <-- METHOD /path 201 45ms
 *
 * The response line is written AFTER the response finishes via the
 * 'finish' event — so the status code and duration are both accurate.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Honour an existing request ID from a reverse proxy (e.g. Nginx, API gateway)
  // so the ID is consistent end-to-end; generate a fresh one if none provided
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();

  // Attach to request so downstream middleware/error handler can reference it
  req.headers['x-request-id'] = requestId;

  // Echo back so the client can correlate its own logs
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  logger.info(`[${requestId}] --> ${req.method} ${req.originalUrl}`);

  // Log AFTER the response is fully sent — gives accurate status + duration
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level    = res.statusCode >= 500 ? 'error'
                   : res.statusCode >= 400 ? 'warn'
                   : 'info';

    logger[level](
      `[${requestId}] <-- ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
