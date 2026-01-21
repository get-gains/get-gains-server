import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { logger } from '../utils/logger';
import { sendSingleError } from '../utils/response';
import type { UserModel } from '../generated/prisma/models/User';

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UserModel {}
  }
}

/**
 * Middleware to protect routes with JWT Bearer token authentication
 *
 * Usage in routes:
 * ```typescript
 * router.get('/protected', authenticate, myController);
 * ```
 *
 * After authentication, the user is available on `req.user`
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: Error | null, user: Express.User | false) => {
      if (err) {
        logger.error('Authentication error', err);
        return sendSingleError(res, 'Authentication error', 500);
      }

      if (!user) {
        logger.debug('Authentication failed: Invalid or missing token');
        return sendSingleError(res, 'Unauthorized', 401);
      }

      // Attach user to request
      req.user = user;
      logger.debug('Request authenticated', { userId: user.id });
      next();
    }
  )(req, res, next);
};

/**
 * Optional authentication middleware
 *
 * Attempts to authenticate the user but allows the request to proceed
 * even if authentication fails. Useful for routes that have different
 * behavior for authenticated vs unauthenticated users.
 *
 * Usage in routes:
 * ```typescript
 * router.get('/public', optionalAuth, myController);
 * // req.user will be set if authenticated, undefined otherwise
 * ```
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: Error | null, user: Express.User | false) => {
      if (err) {
        logger.error('Optional auth error', err);
        return next();
      }

      if (user) {
        req.user = user;
        logger.debug('Optional auth: User authenticated', { userId: user.id });
      } else {
        logger.debug('Optional auth: No valid token, proceeding as guest');
      }

      next();
    }
  )(req, res, next);
};

/**
 * Middleware for local (email/password) authentication
 *
 * Used in login routes. On success, the user is attached to `req.user`.
 *
 * Usage in routes:
 * ```typescript
 * router.post('/login', authenticateLocal, loginController);
 * ```
 */
export const authenticateLocal = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  passport.authenticate(
    'local',
    { session: false },
    (
      err: Error | null,
      user: Express.User | false,
      info: { message: string } | undefined
    ) => {
      if (err) {
        logger.error('Local authentication error', err);
        return sendSingleError(res, 'Authentication error', 500);
      }

      if (!user) {
        const message = info?.message || 'Invalid credentials';
        logger.debug('Local authentication failed', { message });
        return sendSingleError(res, message, 401);
      }

      req.user = user;
      logger.debug('Local authentication successful', { userId: user.id });
      next();
    }
  )(req, res, next);
};
