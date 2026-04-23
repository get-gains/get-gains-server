import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { user as UserModel } from '@prisma/client';
import type { coach as CoachModel } from '@prisma/client';
import supabase from '../config/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import prisma from '../config/database';
import { SubscriptionTier } from '@prisma/client';
import {
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  UnexpectedException,
} from '../lib/errors';
import { mapSupabaseError } from '../lib/errors/supabase-error-mapper';
import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

/**
 * Authenticated user with subscription data.
 * After the RevenueCat migration, tier comes from the denormalized
 * `user.active_subscription_tier` column — no extra DB query.
 */
export interface AuthenticatedUser extends SupabaseUser {
  subscription: {
    isSubscribed: boolean;
    tier: SubscriptionTier;
  };
}

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | UserModel;
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
 * After authentication, the user is available on `req.user` with subscription data attached
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
      throw new UnauthorizedException(
        'AUTH_TOKEN_MISSING',
        'No token provided'
      );
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      if (error instanceof SupabaseAuthError) {
        throw mapSupabaseError(error, 'authentication');
      }
      throw new UnauthorizedException(
        'AUTH_TOKEN_INVALID',
        'Invalid or expired token'
      );
    }

    // Fetch user's tier from denormalized column — no subscription join needed
    const dbUser = await prisma.user.findUnique({
      where: { supabase_auth_id: user.id },
      select: { active_subscription_tier: true },
    });

    const tier = dbUser?.active_subscription_tier ?? SubscriptionTier.FREE;

    (user as AuthenticatedUser).subscription = {
      tier,
      isSubscribed: tier !== SubscriptionTier.FREE,
    };

    req.user = user as AuthenticatedUser;
    next();
  } catch (error) {
    // Re-throw AppExceptions (they'll be caught by global error handler)
    if (error instanceof UnauthorizedException) throw error;
    const err = error as Error;
    logger.error('Authentication error', {
      message: err.message,
      stack: err.stack,
    });
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Authentication failed'
    );
  }
};

/**
 * Middleware to attach app User to request. Must run after authenticateSupabaseUser.
 * Looks up app User by supabase_auth_id and attaches to req.appUser.
 * Returns 404 if user not found in database.
 */
export const requireAppUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supabaseUser = req.user;
    if (!supabaseUser) {
      throw new UnauthorizedException(
        'UNAUTHENTICATED',
        'Authentication required'
      );
    }

    const supabaseId =
      'supabase_auth_id' in supabaseUser
        ? supabaseUser.supabase_auth_id
        : supabaseUser.id;

    const appUser = await prisma.user.findUnique({
      where: { supabase_auth_id: supabaseId },
    });

    if (!appUser) {
      throw new NotFoundException('AUTH_APP_USER_NOT_FOUND', 'User not found');
    }

    req.appUser = appUser;
    next();
  } catch (error) {
    // Re-throw AppExceptions
    if (
      error instanceof UnauthorizedException ||
      error instanceof NotFoundException
    )
      throw error;
    const err = error as Error;
    logger.error('requireAppUser error', {
      message: err.message,
      stack: err.stack,
    });
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Authorization failed'
    );
  }
};

/**
 * Middleware to require coach profile. Must run after authenticateSupabaseUser.
 * Looks up app User by supabase_auth_id, loads Coach, and attaches both to req.
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
      throw new UnauthorizedException(
        'UNAUTHENTICATED',
        'Authentication required'
      );
    }

    const supabaseId =
      'supabase_auth_id' in supabaseUser
        ? supabaseUser.supabase_auth_id
        : supabaseUser.id;

    const appUser = await prisma.user.findUnique({
      where: { supabase_auth_id: supabaseId },
    });

    if (!appUser) {
      throw new NotFoundException('AUTH_APP_USER_NOT_FOUND', 'User not found');
    }

    const coach = await prisma.coach.findUnique({
      where: { user_id: appUser.supabase_auth_id },
    });

    if (!coach) {
      throw new ForbiddenException(
        'AUTH_COACH_REQUIRED',
        'Coach profile required'
      );
    }

    req.appUser = appUser;
    req.coach = coach;
    next();
  } catch (error) {
    // Re-throw AppExceptions
    if (
      error instanceof UnauthorizedException ||
      error instanceof NotFoundException ||
      error instanceof ForbiddenException
    )
      throw error;
    const err = error as Error;
    logger.error('requireCoach error', {
      message: err.message,
      stack: err.stack,
    });
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Authorization failed'
    );
  }
};
