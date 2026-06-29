import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedUser } from './auth.middleware';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  UnexpectedException,
} from '../lib/errors';
import type { AdminScope } from '../schemas/admin-admins.schema';

/**
 * Middleware to require an authenticated admin user.
 *
 * Must run after `authenticateSupabaseUser`. Loads the app `User` row,
 * verifies `is_admin`, and attaches `req.appUser`.
 *
 * @param req  Express request with authenticated Supabase user
 * @param res  Express response
 * @param next Next function
 * @throws UnauthorizedException if not authenticated
 * @throws NotFoundException if app user not found
 * @throws ForbiddenException if user is not an admin
 */
export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supabaseUser = req.user as AuthenticatedUser | undefined;
    if (!supabaseUser) {
      throw new UnauthorizedException(
        'UNAUTHENTICATED',
        'Authentication required'
      );
    }

    const appUser = await prisma.user.findUnique({
      where: { supabase_auth_id: supabaseUser.id },
    });

    if (!appUser) {
      throw new NotFoundException('AUTH_APP_USER_NOT_FOUND', 'User not found');
    }

    if (!appUser.is_admin) {
      throw new ForbiddenException(
        'AUTH_ADMIN_REQUIRED',
        'Admin access required'
      );
    }

    req.appUser = appUser;
    next();
  } catch (error) {
    if (
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    const err = error as Error;
    logger.error('requireAdmin error', {
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
 * Middleware to require a specific admin scope (or super_admin).
 *
 * Must run after `authenticateSupabaseUser` + `requireAdmin`.
 * Loads the user's admin_scope rows and checks for the required scope.
 * If the user has `super_admin`, all scopes are implicitly granted.
 *
 * @param scopes One or more scopes (any match passes)
 * @throws ForbiddenException if none of the required scopes (or super_admin) are held
 */
export const requireAdminScope =
  (...scopes: AdminScope[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const appUser = req.appUser;
      if (!appUser) {
        throw new UnauthorizedException(
          'UNAUTHENTICATED',
          'Authentication required'
        );
      }

      const userScopes = await prisma.admin_scope.findMany({
        where: { supabase_auth_id: appUser.supabase_auth_id },
        select: { scope: true },
      });

      const scopeSet = new Set(userScopes.map((s) => s.scope));

      if (scopeSet.has('super_admin')) {
        return next();
      }

      const hasScope = scopes.some((s) => scopeSet.has(s));
      if (!hasScope) {
        throw new ForbiddenException(
          'AUTH_ADMIN_SCOPE_REQUIRED',
          `Missing required scope: ${scopes.join(' or ')}`
        );
      }

      next();
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      const err = error as Error;
      logger.error('requireAdminScope error', {
        message: err.message,
        stack: err.stack,
      });

      throw new UnexpectedException(
        'UNEXPECTED_EXCEPTION',
        'Scope verification failed'
      );
    }
  };
