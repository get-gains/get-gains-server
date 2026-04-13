import { Request, Response } from 'express';
import { Provider } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  GetPlansQuery,
  VerifyPurchaseInput,
  GetSubscriptionStatusQuery,
  GetSubscriptionHistoryQuery,
} from '../schemas/subscription.schema';
import {
  getAvailablePlans,
  getUserSubscription,
  getUserSubscriptionHistory,
  verifyAndProcessPurchase,
  hasActiveSubscription,
} from '../services/subscription.service';
import prisma from '../config/database';

// ============== Plan Controllers ==============

/**
 * Get all available subscription plans
 */
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeInactive } = res.locals.validated?.query as GetPlansQuery;

    logger.debug('Fetching subscription plans', { includeInactive });

    let plans;
    if (includeInactive) {
      plans = await prisma.subscription_plan.findMany({
        orderBy: { sort_order: 'asc' },
        include: { provider_plans: { where: { is_active: true } } },
      });
    } else {
      plans = await getAvailablePlans();
    }

    sendSuccess(res, {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.price_cents,
        currency: p.currency,
        billingCycle: p.billing_cycle,
        features: p.features,
        trialPeriodDays: p.trial_period_days,
        tierLevel: p.tier_level,
        productId: p.provider_plans[0]?.provider_product_id ?? null,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch plans', error);
    sendSingleError(res, 'Failed to fetch plans', 500);
  }
};

// ============== Subscription Controllers ==============

/**
 * Get current user's subscription status
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

    const subscription = await getUserSubscription(userId);
    const isActive = await hasActiveSubscription(userId);

    let history = null;
    if (includeHistory) {
      const historyResult = await getUserSubscriptionHistory(userId, 5);
      history = historyResult.subscriptions;
    }

    sendSuccess(res, {
      isSubscribed: isActive,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            plan: {
              id: subscription.subscription_plan.id,
              name: subscription.subscription_plan.name,
              billingCycle: subscription.subscription_plan.billing_cycle,
              tierLevel: subscription.subscription_plan.tier_level,
            },
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            nextBillingDate: subscription.next_billing_date,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            autoRenew: subscription.auto_renew,
          }
        : null,
      history: history
        ? history.map((s) => ({
            id: s.id,
            status: s.status,
            planName: s.subscription_plan.name,
            startDate: s.start_date,
            endedAt: s.ended_at,
          }))
        : null,
    });
  } catch (error) {
    logger.error('Failed to fetch subscription status', error);
    sendSingleError(res, 'Failed to fetch subscription status', 500);
  }
};

/**
 * Get user's subscription history
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

    const { subscriptions, total } = await getUserSubscriptionHistory(
      userId,
      limit,
      offset
    );

    sendSuccess(res, {
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        plan: {
          id: s.subscription_plan.id,
          name: s.subscription_plan.name,
          billingCycle: s.subscription_plan.billing_cycle,
        },
        startDate: s.start_date,
        currentPeriodStart: s.current_period_start,
        currentPeriodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        canceledAt: s.canceled_at,
        endedAt: s.ended_at,
        createdAt: s.created_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + subscriptions.length < total,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch subscription history', error);
    sendSingleError(res, 'Failed to fetch subscription history', 500);
  }
};

/**
 * Verify a purchase from the client and create/update subscription
 */
export const verifyPurchase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;
    const { productId, purchaseToken, provider } = res.locals.validated
      ?.body as VerifyPurchaseInput;

    logger.info('Verifying purchase', { userId, productId, provider });

    const paymentProvider =
      provider === 'GOOGLE_PLAY' ? Provider.GOOGLE_PLAY : Provider.GOOGLE_PLAY;

    const result = await verifyAndProcessPurchase(
      userId,
      productId,
      purchaseToken,
      paymentProvider
    );

    if (!result.success) {
      sendSingleError(res, result.error || 'Purchase verification failed', 400);
      return;
    }

    sendSuccess(res, {
      success: true,
      subscription: result.subscription
        ? {
            id: result.subscription.id,
            status: result.subscription.status,
            plan: {
              id: result.subscription.subscription_plan.id,
              name: result.subscription.subscription_plan.name,
              billingCycle: result.subscription.subscription_plan.billing_cycle,
              tierLevel: result.subscription.subscription_plan.tier_level,
            },
            currentPeriodStart: result.subscription.current_period_start,
            currentPeriodEnd: result.subscription.current_period_end,
            nextBillingDate: result.subscription.next_billing_date,
            cancelAtPeriodEnd: result.subscription.cancel_at_period_end,
            autoRenew: result.subscription.auto_renew,
          }
        : null,
    });
  } catch (error) {
    logger.error('Failed to verify purchase', error);
    sendSingleError(res, 'Failed to verify purchase', 500);
  }
};
