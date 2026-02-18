import { Request, Response } from 'express';
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
import { PaymentProvider } from '@prisma/client';
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
      plans = await prisma.plan.findMany({
        orderBy: { sortOrder: 'asc' },
      });
    } else {
      plans = await getAvailablePlans();
    }

    sendSuccess(res, {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        currency: p.currency,
        billingCycle: p.billingCycle,
        features: p.features,
        trialPeriodDays: p.trialPeriodDays,
        productId: p.productId,
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
    const user = req.user!;
    const { includeHistory } = res.locals.validated
      ?.query as GetSubscriptionStatusQuery;

    // Get user from database using Supabase ID
    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.debug('Fetching subscription status', { userId: dbUser.id });

    const subscription = await getUserSubscription(dbUser.id);
    const isActive = await hasActiveSubscription(dbUser.id);

    let history = null;
    if (includeHistory) {
      const historyResult = await getUserSubscriptionHistory(dbUser.id, 5);
      history = historyResult.subscriptions;
    }

    sendSuccess(res, {
      isSubscribed: isActive,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            plan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              billingCycle: subscription.plan.billingCycle,
              tierLevel: subscription.plan.tierLevel,
            },
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            nextBillingDate: subscription.nextBillingDate,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            autoRenew: subscription.autoRenew,
          }
        : null,
      history: history
        ? history.map((s) => ({
            id: s.id,
            status: s.status,
            planName: s.plan.name,
            startDate: s.startDate,
            endedAt: s.endedAt,
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
    const user = req.user!;
    const { limit, offset } = res.locals.validated
      ?.query as GetSubscriptionHistoryQuery;

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.debug('Fetching subscription history', {
      userId: dbUser.id,
      limit,
      offset,
    });

    const { subscriptions, total } = await getUserSubscriptionHistory(
      dbUser.id,
      limit,
      offset
    );

    sendSuccess(res, {
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        plan: {
          id: s.plan.id,
          name: s.plan.name,
          billingCycle: s.plan.billingCycle,
        },
        startDate: s.startDate,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        canceledAt: s.canceledAt,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + subscriptions.length < total,
      },
    });
    return;
  } catch (error) {
    logger.error('Failed to fetch subscription history', error);
    sendSingleError(res, 'Failed to fetch subscription history', 500);
    return;
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
    const user = req.user!;
    const { productId, purchaseToken, provider } = res.locals.validated
      ?.body as VerifyPurchaseInput;

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.info('Verifying purchase', {
      userId: dbUser.id,
      productId,
      provider,
    });

    const paymentProvider =
      provider === 'GOOGLE_PAY'
        ? PaymentProvider.GOOGLE_PAY
        : PaymentProvider.GOOGLE_PAY;

    const result = await verifyAndProcessPurchase(
      dbUser.id,
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
              id: result.subscription.plan.id,
              name: result.subscription.plan.name,
              billingCycle: result.subscription.plan.billingCycle,
              tierLevel: result.subscription.plan.tierLevel,
            },
            currentPeriodStart: result.subscription.currentPeriodStart,
            currentPeriodEnd: result.subscription.currentPeriodEnd,
            nextBillingDate: result.subscription.nextBillingDate,
            cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd,
            autoRenew: result.subscription.autoRenew,
          }
        : null,
    });
  } catch (error) {
    logger.error('Failed to verify purchase', error);
    sendSingleError(res, 'Failed to verify purchase', 500);
  }
};
