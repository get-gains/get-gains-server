import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError, sendSuccess } from '../utils/response';
import type { UserModel } from '../generated/prisma/models/User';
import supabase from '../config/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import prisma from '../config/database';
import { SubscriptionStatus } from '../generated/prisma/client';

/**
 * Authenticated user with subscription data
 */
export interface AuthenticatedUser extends SupabaseUser {
  subscription?: {
    isSubscribed: boolean;
    tierLevel: number;
    subscriptionId?: string;
    planId?: string;
    status?: SubscriptionStatus;
    currentPeriodEnd?: Date;
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

    // Fetch user's subscription data
    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (dbUser) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: dbUser.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: {
            gt: new Date(),
          },
        },
        include: {
          plan: {
            select: {
              id: true,
              tierLevel: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Attach user with subscription data to request object
      (user as AuthenticatedUser).subscription = subscription
        ? {
            isSubscribed: true,
            tierLevel: subscription.plan.tierLevel,
            subscriptionId: subscription.id,
            planId: subscription.planId,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : {
            isSubscribed: false,
            tierLevel: 0, // Free tier
          };
    } else {
      // User not in database yet (first login), default to free tier
      (user as AuthenticatedUser).subscription = {
        isSubscribed: false,
        tierLevel: 0,
      };
    }

    req.user = user as AuthenticatedUser;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    sendSingleError(res, 'Authentication failed', 500);
    return;
  }
};
