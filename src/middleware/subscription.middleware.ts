import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError } from '../utils/response';
import { SubscriptionTier } from '@prisma/client';
import type { AuthenticatedUser } from './auth.middleware';

/**
 * Tier rank for comparison. Higher = more access.
 */
const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  PREMIUM: 1,
};

/**
 * Subscription info attached to request for downstream controllers.
 */
interface SubscriptionInfo {
  isSubscribed: boolean;
  tier: SubscriptionTier;
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
 * Middleware factory that requires an active subscription.
 * Must be used after authenticateSupabaseUser.
 *
 * Usage:
 * ```typescript
 * // Require any paid subscription
 * router.get('/premium', authenticate, requireSubscription(), myController);
 *
 * // Require specific tier
 * router.get('/pro', authenticate, requireSubscription({ minTier: 'PREMIUM' }), myController);
 * ```
 */
export const requireSubscription = (options?: {
  minTier?: SubscriptionTier;
}) => {
  const minTier = options?.minTier ?? SubscriptionTier.PREMIUM;

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const subscriptionData = user.subscription;
    if (!subscriptionData) {
      sendSingleError(res, 'Invalid user session', 401);
      return;
    }

    const userTier = subscriptionData.tier;

    // Attach to request for downstream use
    req.subscription = {
      isSubscribed: subscriptionData.isSubscribed,
      tier: userTier,
    };

    if (!subscriptionData.isSubscribed) {
      logger.debug('No active subscription', { userId: user.id });
      sendSingleError(res, 'Active subscription required', 402);
      return;
    }

    if (TIER_RANK[userTier] < TIER_RANK[minTier]) {
      logger.debug('Subscription tier too low', {
        userId: user.id,
        currentTier: userTier,
        requiredTier: minTier,
      });
      sendSingleError(
        res,
        `This feature requires a ${minTier} subscription`,
        402
      );
      return;
    }

    next();
  };
};

/**
 * Middleware that attaches subscription info to request without blocking.
 * Useful for routes that work differently for subscribed vs non-subscribed users.
 * Must be used after authenticateSupabaseUser.
 */
export const attachSubscription = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const user = req.user as AuthenticatedUser | undefined;

  if (!user?.subscription) {
    req.subscription = {
      isSubscribed: false,
      tier: SubscriptionTier.FREE,
    };
    next();
    return;
  }

  req.subscription = {
    isSubscribed: user.subscription.isSubscribed,
    tier: user.subscription.tier,
  };

  next();
};

/**
 * Middleware factory that checks subscription tier for feature access.
 * Must be used after attachSubscription or requireSubscription.
 */
export const checkTier = (
  requiredTier: SubscriptionTier,
  featureName?: string
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sub = req.subscription;

    if (!sub?.isSubscribed) {
      sendSingleError(
        res,
        featureName
          ? `"${featureName}" requires an active subscription`
          : 'Active subscription required',
        402
      );
      return;
    }

    if (TIER_RANK[sub.tier] < TIER_RANK[requiredTier]) {
      sendSingleError(
        res,
        featureName
          ? `"${featureName}" requires a ${requiredTier} subscription`
          : `This feature requires a ${requiredTier} subscription`,
        402
      );
      return;
    }

    next();
  };
};
