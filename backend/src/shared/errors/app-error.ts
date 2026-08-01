/**
 * Error hierarchy. Every error carries a machine-readable `code` from
 * api_contract.md — the Flutter app switches on `code`, never on English
 * message text (edge_cases.md §99).
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'TOKEN_REUSE_DETECTED'
  | 'FORBIDDEN'
  | 'ACCOUNT_SUSPENDED'
  | 'APPLICATION_REJECTED'
  | 'KYC_REQUIRED'
  | 'GEO_RESTRICTED'
  | 'NOT_FOUND'
  | 'SLOT_UNAVAILABLE'
  | 'CHALLENGE_ALREADY_MATCHED'
  | 'PRICE_CHANGED'
  | 'INSUFFICIENT_BALANCE'
  | 'CONFIRMATION_WINDOW_CLOSED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  /** Distinguishes deliberate failures from genuine crashes when logging. */
  readonly isOperational = true;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code: ErrorCode = 'UNAUTHENTICATED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource', code: ErrorCode = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(409, code, message, details);
  }
}

/** Thrown when a user loses a booking race (edge case 12). */
export class SlotUnavailableError extends ConflictError {
  constructor(message = 'That slot was just taken. Please pick another.') {
    super('SLOT_UNAVAILABLE', message);
  }
}

/** Carries the exact shortfall so the UI can prefill a top-up (edge case 27). */
export class InsufficientBalanceError extends ConflictError {
  constructor(shortfallPaise: number) {
    super('INSUFFICIENT_BALANCE', 'Not enough balance in your wallet', { shortfallPaise });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(429, 'RATE_LIMITED', 'Too many requests', { retryAfterSeconds });
  }
}
