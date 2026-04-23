import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  GetSubscriptionStatusQuery,
  GetSubscriptionHistoryQuery,
} from '../schemas/subscription.schema';
import prisma from '../config/database';

// ============== Subscription Controllers ==============

/**
 * Get current user's subscription status (from RC-backed user_subscription)
 */
export const getSubscriptionStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;
    const { includeHistory } = res.locals.validated
      ?.query as GetSubscriptionStatusQuery;

    logger.debug('Fetching subscription status', { userId });

    const [user, userSub] = await Promise.all([
      prisma.user.findUnique({
        where: { supabase_auth_id: userId },
        select: { active_subscription_tier: true },
      }),
      prisma.user_subscription.findUnique({
        where: { user_id: userId },
      }),
    ]);

    const tier = user?.active_subscription_tier ?? 'FREE';
    const isSubscribed = tier !== 'FREE';

    let history = null;
    if (includeHistory) {
      const events = await prisma.rc_subscription_event.findMany({
        where: { user_id: userId },
        orderBy: { occurred_at: 'desc' },
        take: 5,
      });
      history = events.map((e) => ({
        eventType: e.event_type,
        fromTier: e.from_tier,
        toTier: e.to_tier,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        occurredAt: e.occurred_at,
      }));
    }

    sendSuccess(res, {
      isSubscribed,
      tier,
      subscription: userSub
        ? {
            status: userSub.status,
            store: userSub.store,
            productId: userSub.product_id,
            entitlementId: userSub.entitlement_id,
            currentPeriodStart: userSub.current_period_start,
            currentPeriodEnd: userSub.current_period_end,
            cancelAtPeriodEnd: userSub.cancel_at_period_end,
            willRenew: userSub.will_renew,
          }
        : null,
      history,
    });
  } catch (error) {
    logger.error('Failed to fetch subscription status', error);
    sendSingleError(res, 'Failed to fetch subscription status', 500);
  }
};

/**
 * Get user's subscription event history
 */
export const getSubscriptionHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;
    const { limit, offset } = res.locals.validated
      ?.query as GetSubscriptionHistoryQuery;

    logger.debug('Fetching subscription history', { userId, limit, offset });

    const [events, total] = await Promise.all([
      prisma.rc_subscription_event.findMany({
        where: { user_id: userId },
        orderBy: { occurred_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.rc_subscription_event.count({ where: { user_id: userId } }),
    ]);

    sendSuccess(res, {
      events: events.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        fromTier: e.from_tier,
        toTier: e.to_tier,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        store: e.store,
        productId: e.product_id,
        occurredAt: e.occurred_at,
        createdAt: e.created_at,
      })),
      pagination: {
        total,
        limit: limit!,
        offset: offset!,
        hasMore: offset! + events.length < total,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch subscription history', error);
    sendSingleError(res, 'Failed to fetch subscription history', 500);
  }
};
