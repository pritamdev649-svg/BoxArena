import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Zod at the request boundary. Schemas use .strict() so unknown keys are
 * REJECTED, not stripped — a client must not be able to smuggle `role: admin`
 * into a profile update (edge_cases.md §94-95).
 */
export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        /** Express 5 makes req.query a getter — attach parsed output instead. */
        Object.defineProperty(req, 'validatedQuery', {
          value: schemas.query.parse(req.query),
          writable: false,
          configurable: true,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Typed accessor for query params validated above. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}
