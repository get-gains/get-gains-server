import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError, sendSuccess } from '../utils/response';
import type { UserModel } from '../generated/prisma/models/User';
import type { CoachModel } from '../generated/prisma/models/Coach';
import supabase from '../config/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getUserBySupabaseId } from '../controllers/user.controller';
import prisma from '../config/database';

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SupabaseUser | UserModel;
      appUser?: UserModel;
      coach?: CoachModel;
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
    const err = error as Error;
    logger.error('Authentication error', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Authentication failed', 500);
    return;
  }
};

/**
 * Middleware to require coach profile. Must run after authenticateSupabaseUser.
 * Looks up app User by supabaseId, loads Coach, and attaches both to req.
 * Returns 403 if user has no Coach profile.
 */
export const requireCoach = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supabaseUser = req.user;
    if (!supabaseUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const supabaseId =
      'supabaseId' in supabaseUser ? supabaseUser.supabaseId : supabaseUser.id;
    const appUser = await getUserBySupabaseId(supabaseId);

    if (!appUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    const coach = await prisma.coach.findUnique({
      where: { userId: appUser.id },
    });

    if (!coach) {
      sendSingleError(res, 'Coach profile required', 403);
      return;
    }

    req.appUser = appUser;
    req.coach = coach;
    next();
  } catch (error) {
    const err = error as Error;
    logger.error('requireCoach error', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Authorization failed', 500);
    return;
  }
};
