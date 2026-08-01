import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';

/**
 * The single place errors become responses. Controllers never build error
 * bodies by hand (code_standards.md §6).
 *
 * Envelope is fixed by api_contract.md — clients switch on `code`.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const { statusCode, code, message, details } = normalise(err);

  if (statusCode >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  } else {
    logger.warn({ code, path: req.path, method: req.method }, message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  });
}

interface Normalised {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function normalise(err: unknown): Normalised {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }

  /**
   * A duplicate key on a unique index is usually a lost race, not a bug — the
   * slot/challenge guards rely on it as a last line of defence (edge case 12).
   */
  if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    return {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'That resource already exists or was just taken',
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: err.message,
      details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, code: 'VALIDATION_ERROR', message: `Invalid ${err.path}` };
  }

  /** Never leak stack traces or internal messages in production. */
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: isProduction
      ? 'Something went wrong'
      : err instanceof Error
        ? err.message
        : 'Unknown error',
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}
