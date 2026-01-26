import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError, sendSuccess } from '../utils/response';
import type { UserModel } from '../generated/prisma/models/User';
import supabase from '../config/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SupabaseUser | UserModel;
    }
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
export const authenticateSupabaseUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      sendSuccess(res, { error: 'No token provided' }, 401);
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      sendSingleError(res, 'Invalid or expired token', 401);
      return;
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    sendSingleError(res, 'Authentication failed', 500);
    return;
  }
};
