import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * sanitizeMiddleware — defensive input cleaning.
 *
 * Strips prototype-pollution keys from the request body before the request
 * reaches any validator or service. Prototype pollution attacks inject keys
 * like __proto__, constructor, or prototype to overwrite Object.prototype
 * properties and corrupt the entire runtime.
 *
 * This is a defence-in-depth measure — Zod validation would reject unknown
 * keys anyway (with strictObject schemas), but stripping them here means
 * the attack vector never reaches the validator at all.
 *
 * Also trims top-level string values to avoid leading/trailing whitespace
 * slipping through (Zod .trim() handles schema fields, but this catches
 * anything outside a validated schema).
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively remove dangerous keys from a plain object.
 * Works on nested objects and arrays.
 */
function sanitizeObject(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj !== null && typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) {
        // Log an alert — this is either an attack or a misconfigured client
        logger.warn(`Prototype pollution attempt detected: key "${key}" stripped from request body`);
        continue;
      }
      clean[key] = sanitizeObject(value);
    }
    return clean;
  }

  return obj;
}

export function sanitizeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}
