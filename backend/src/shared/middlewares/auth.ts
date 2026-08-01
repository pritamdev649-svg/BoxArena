import type { NextFunction, Request, Response } from 'express';
import { AccountStatus, UserModel, UserRole, type IUser } from '../../models/index.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';
import { verifyAccessToken } from '../../modules/auth/auth.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Verifies the JWT, then RE-READS role and status from the database.
 *
 * A JWT issued before a suspension is still cryptographically valid — trusting
 * its claims alone means a suspended user keeps full access for up to 15
 * minutes, and a demoted admin keeps admin rights (edge_cases.md §9).
 * The extra read is worth it on every authenticated route.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required');
    }

    const claims = verifyAccessToken(header.slice(7));
    const user = await UserModel.findById(claims.sub);

    if (!user) throw new UnauthorizedError('Account no longer exists');

    if (user.status === AccountStatus.SUSPENDED || user.status === AccountStatus.DELETED) {
      throw new ForbiddenError('This account is not active', 'ACCOUNT_SUSPENDED');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Route-level role gate. Ownership scoping happens in the service layer. */
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!allowed.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have access to this resource'));
    }
    next();
  };
}

/** Throws rather than returning undefined, so controllers stay unbranched. */
export function currentUser(req: Request): IUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
