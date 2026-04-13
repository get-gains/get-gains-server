import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError } from '../utils/response';
import prisma from '../config/database';
import { SubscriptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from './auth.middleware';

/**
 * Subscription verification result attached to request
 */
interface SubscriptionInfo {
  isSubscribed: boolean;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planId: string;
    tierLevel: number;
    currentPeriodEnd: Date;
  } | null;
}

/**
 * Extend Express Request to include subscription info
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      subscription?: SubscriptionInfo;
    }
  }
}

/**
 * Get user's active subscription with tier level
 * Returns null if no active subscription found
 */
export const getUserSubscriptionWithTier = async (
  supabaseId: string
): Promise<SubscriptionInfo['subscription']> => {
  const dbUser = await prisma.user.findUnique({
    where: { supabase_auth_id: supabaseId },
  });

  if (!dbUser) {
    return null;
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      user_id: dbUser.supabase_auth_id,
      status: SubscriptionStatus.ACTIVE,
      current_period_end: {
        gt: new Date(),
      },
    },
    include: {
      subscription_plan: {
        select: {
          id: true,
          tier_level: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    status: subscription.status,
    planId: subscription.subscription_plan_id,
    tierLevel: subscription.subscription_plan.tier_level,
    currentPeriodEnd: subscription.current_period_end,
  };
};

/**
 * Middleware factory that requires an active subscription.
 * Must be used after authentication middleware.
 *
 * Usage:
 * ```typescript
 * // Require any active subscription
 * router.get('/premium', authenticate, requireSubscription(), myController);
 *
 * // Require specific tier level (e.g., tier 2 or higher)
 * router.get('/pro-feature', authenticate, requireSubscription({ minTier: 2 }), myController);
 * ```
 */
export const requireSubscription = (options?: { minTier?: number }) => {
  const minTier = options?.minTier ?? 1;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user as AuthenticatedUser | undefined;

      if (!user) {
        sendSingleError(res, 'Authentication required', 401);
        return;
      }

      logger.debug('Checking subscription', { userId: user.id, minTier });

      // Use subscription data from auth middleware if available
      const subscriptionData = user.subscription;

      if (!subscriptionData) {
        sendSingleError(res, 'Invalid user session', 401);
        return;
      }

      // Attach detailed subscription info to request if subscribed
      if (subscriptionData.isSubscribed && subscriptionData.subscriptionId) {
        req.subscription = {
          isSubscribed: true,
          subscription: {
            id: subscriptionData.subscriptionId,
            status: subscriptionData.status!,
            planId: subscriptionData.planId!,
            tierLevel: subscriptionData.tierLevel,
            currentPeriodEnd: subscriptionData.currentPeriodEnd!,
          },
        };
      } else {
        req.subscription = {
          isSubscribed: false,
          subscription: null,
        };
      }

      if (!subscriptionData.isSubscribed) {
        logger.debug('No active subscription found', { userId: user.id });
        sendSingleError(res, 'Active subscription required', 403);
        return;
      }

      if (subscriptionData.tierLevel < minTier) {
        logger.debug('Subscription tier too low', {
          userId: user.id,
          currentTier: subscriptionData.tierLevel,
          requiredTier: minTier,
        });
        sendSingleError(
          res,
          `This feature requires a higher subscription tier (tier ${minTier}+)`,
          403
        );
        return;
      }

      logger.debug('Subscription verified', {
        userId: user.id,
        tier: subscriptionData.tierLevel,
      });

      next();
    } catch (error) {
      logger.error('Subscription verification failed', error);
      sendSingleError(res, 'Failed to verify subscription', 500);
    }
  };
};

/**
 * Middleware that attaches subscription info to request without blocking.
 * Useful for routes that work differently for subscribed vs non-subscribed users.
 * Must be used after authentication middleware.
 *
 * Usage:
 * ```typescript
 * router.get('/content', authenticate, attachSubscription, (req, res) => {
 *   if (req.subscription?.isSubscribed) {
 *     // Return premium content
 *   } else {
 *     // Return limited content
 *   }
 * });
 * ```
 */
export const attachSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser | undefined;

    if (!user || !user.subscription) {
      req.subscription = { isSubscribed: false, subscription: null };
      next();
      return;
    }

    // Use subscription data from auth middleware
    const subscriptionData = user.subscription;

    if (subscriptionData.isSubscribed && subscriptionData.subscriptionId) {
      req.subscription = {
        isSubscribed: true,
        subscription: {
          id: subscriptionData.subscriptionId,
          status: subscriptionData.status!,
          planId: subscriptionData.planId!,
          tierLevel: subscriptionData.tierLevel,
          currentPeriodEnd: subscriptionData.currentPeriodEnd!,
        },
      };
    } else {
      req.subscription = {
        isSubscribed: false,
        subscription: null,
      };
    }

    next();
  } catch (error) {
    logger.error('Failed to attach subscription info', error);
    // Don't block the request, just set subscription as null
    req.subscription = { isSubscribed: false, subscription: null };
    next();
  }
};

/**
 * Middleware factory that checks subscription tier for feature access.
 * Returns 403 with specific message if tier is insufficient.
 * Must be used after attachSubscription or requireSubscription middleware.
 *
 * Usage:
 * ```typescript
 * router.get('/advanced', authenticate, attachSubscription, checkTier(2, 'Advanced analytics'), controller);
 * ```
 */
export const checkTier = (requiredTier: number, featureName?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const subscription = req.subscription;

    if (!subscription?.subscription) {
      sendSingleError(
        res,
        featureName
          ? `"${featureName}" requires an active subscription`
          : 'Active subscription required',
        403
      );
      return;
    }

    if (subscription.subscription.tierLevel < requiredTier) {
      sendSingleError(
        res,
        featureName
          ? `"${featureName}" requires a tier ${requiredTier}+ subscription`
          : `This feature requires a tier ${requiredTier}+ subscription`,
        403
      );
      return;
    }

    next();
  };
};
