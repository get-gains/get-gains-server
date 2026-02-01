import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError } from '../utils/response';
import prisma from '../config/database';
import { SubscriptionStatus } from '../generated/prisma/client';

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
const getUserSubscriptionWithTier = async (
  supabaseId: string
): Promise<SubscriptionInfo['subscription']> => {
  const dbUser = await prisma.user.findFirst({
    where: { supabaseId },
  });

  if (!dbUser) {
    return null;
  }

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

  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    status: subscription.status,
    planId: subscription.planId,
    tierLevel: subscription.plan.tierLevel,
    currentPeriodEnd: subscription.currentPeriodEnd,
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
      const user = req.user;

      if (!user) {
        sendSingleError(res, 'Authentication required', 401);
        return;
      }

      const supabaseId = 'id' in user ? user.id : undefined;

      if (!supabaseId) {
        sendSingleError(res, 'Invalid user session', 401);
        return;
      }

      logger.debug('Checking subscription', { userId: supabaseId, minTier });

      const subscription = await getUserSubscriptionWithTier(supabaseId);

      // Attach subscription info to request
      req.subscription = {
        isSubscribed: !!subscription,
        subscription,
      };

      if (!subscription) {
        logger.debug('No active subscription found', { userId: supabaseId });
        sendSingleError(res, 'Active subscription required', 403);
        return;
      }

      if (subscription.tierLevel < minTier) {
        logger.debug('Subscription tier too low', {
          userId: supabaseId,
          currentTier: subscription.tierLevel,
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
        userId: supabaseId,
        tier: subscription.tierLevel,
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
    const user = req.user;

    if (!user) {
      req.subscription = { isSubscribed: false, subscription: null };
      next();
      return;
    }

    const supabaseId = 'id' in user ? user.id : undefined;

    if (!supabaseId) {
      req.subscription = { isSubscribed: false, subscription: null };
      next();
      return;
    }

    const subscription = await getUserSubscriptionWithTier(supabaseId);

    req.subscription = {
      isSubscribed: !!subscription,
      subscription,
    };

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
