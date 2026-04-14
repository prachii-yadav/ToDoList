/**
 * AppError — base class for all operational (expected) errors.
 *
 * WHY A BASE CLASS:
 *   The error middleware can do a single `instanceof AppError` check and
 *   use the embedded `statusCode` — no need for separate branches per error type.
 *
 *   Unexpected errors (bugs, uncaught exceptions) will NOT be AppError instances,
 *   so the middleware correctly gives those a 500 without special casing.
 *
 * SOLID — Open/Closed:
 *   Add new error types (ConflictError, UnauthorizedError, etc.) by extending
 *   AppError — zero changes needed in error middleware.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  readonly isOperational = true; // marks this as expected, not a bug

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain — required when extending built-ins in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── 400 Bad Request ───────────────────────────────────────────────────────────
export class ValidationError extends AppError {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
  }
}

// ── 404 Not Found ─────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
  }
}

// ── 409 Conflict ─────────────────────────────────────────────────────────────
// Reserved for future use (e.g. duplicate task names)
export class ConflictError extends AppError {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
  }
}

// ── 422 Unprocessable Entity ──────────────────────────────────────────────────
// Business rule violation (e.g. completing an already-completed task forcefully)
export class UnprocessableError extends AppError {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
  }
}
