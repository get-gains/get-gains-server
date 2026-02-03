import prisma from '../config/database';
import { logger } from '../utils/logger';
import {
  PaymentProvider,
  SubscriptionStatus,
  SubscriptionEventType,
  WebhookStatus,
  PaymentStatus,
} from '@prisma/client';
import {
  getPaymentProvider,
  NormalizedSubscription,
  WebhookEventData,
} from '../providers/payment';

/**
 * Subscription service handles all subscription business logic
 */

/**
 * Get user's current subscription status
 */
export const getUserSubscription = async (userId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
      },
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return subscription;
};

/**
 * Get all subscriptions for a user
 */
export const getUserSubscriptionHistory = async (
  userId: string,
  limit = 20,
  offset = 0
) => {
  logger.debug('Fetching subscription history', {
    userId,
    limit,
    offset,
  });
  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.subscription.count({ where: { userId } }),
  ]);

  logger.debug('Fetched subscription history', { subscriptions, total });

  return { subscriptions, total };
};

/**
 * Verify and process a purchase from the client
 */
export const verifyAndProcessPurchase = async (
  userId: string,
  productId: string,
  purchaseToken: string,
  provider: PaymentProvider
) => {
  const paymentProvider = getPaymentProvider(provider);

  // Verify the purchase with the provider
  const result = await paymentProvider.verifyPurchase(productId, purchaseToken);

  if (!result.isValid || !result.subscription) {
    logger.warn('Purchase verification failed', {
      userId,
      productId,
      error: result.errorMessage,
    });
    return { success: false, error: result.errorMessage };
  }

  // Find the plan in our database
  // First try exact match with full productId:basePlanId from Google Play
  const normalizedProductId = result.subscription.productId;
  let plan = await prisma.plan.findFirst({
    where: {
      productId: normalizedProductId,
      provider,
      isActive: true,
    },
  });

  // Fallback: try matching by subscription ID only (for backwards compatibility)
  if (!plan) {
    const subscriptionIdOnly = normalizedProductId.split(':')[0];
    plan = await prisma.plan.findFirst({
      where: {
        productId: {
          startsWith: subscriptionIdOnly,
        },
        provider,
        isActive: true,
      },
    });
  }

  if (!plan) {
    logger.error('Plan not found for product', { productId, provider });
    return { success: false, error: 'Plan not found' };
  }

  // Check if subscription already exists
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      purchaseToken,
    },
  });

  let subscription;

  if (existingSubscription) {
    // Update existing subscription
    subscription = await updateSubscriptionFromProvider(
      existingSubscription.id,
      result.subscription
    );
    logger.info('Updated existing subscription', {
      subscriptionId: subscription.id,
    });
  } else {
    // Create new subscription
    subscription = await createSubscription(
      userId,
      plan.id,
      result.subscription
    );
    logger.info('Created new subscription', {
      subscriptionId: subscription.id,
    });

    // Create subscription event
    await createSubscriptionEvent(
      subscription.id,
      SubscriptionEventType.CREATED,
      null,
      subscription.status,
      'user',
      'Purchase verified'
    );
  }

  // Acknowledge the purchase
  await paymentProvider.acknowledgePurchase(productId, purchaseToken);

  return { success: true, subscription };
};

/**
 * Create a new subscription record
 */
const createSubscription = async (
  userId: string,
  planId: string,
  normalizedSub: NormalizedSubscription
) => {
  return prisma.subscription.create({
    data: {
      userId,
      planId,
      subscriptionId: normalizedSub.subscriptionId,
      status: normalizedSub.status,
      startDate: normalizedSub.startDate,
      currentPeriodStart: normalizedSub.currentPeriodStart,
      currentPeriodEnd: normalizedSub.currentPeriodEnd,
      nextBillingDate: normalizedSub.nextBillingDate,
      cancelAtPeriodEnd: normalizedSub.cancelAtPeriodEnd,
      canceledAt: normalizedSub.canceledAt,
      trialStartDate: normalizedSub.trialStartDate,
      trialEndDate: normalizedSub.trialEndDate,
      orderId: normalizedSub.orderId,
      purchaseToken: normalizedSub.purchaseToken,
      autoRenew: normalizedSub.autoRenew,
    },
    include: {
      plan: true,
    },
  });
};

/**
 * Update subscription from provider data
 */
const updateSubscriptionFromProvider = async (
  subscriptionId: string,
  normalizedSub: NormalizedSubscription
) => {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: normalizedSub.status,
      currentPeriodStart: normalizedSub.currentPeriodStart,
      currentPeriodEnd: normalizedSub.currentPeriodEnd,
      nextBillingDate: normalizedSub.nextBillingDate,
      cancelAtPeriodEnd: normalizedSub.cancelAtPeriodEnd,
      canceledAt: normalizedSub.canceledAt,
      orderId: normalizedSub.orderId,
      autoRenew: normalizedSub.autoRenew,
    },
    include: {
      plan: true,
    },
  });
};

/**
 * Create a subscription event for audit trail
 */
export const createSubscriptionEvent = async (
  subscriptionId: string,
  eventType: SubscriptionEventType,
  fromStatus: SubscriptionStatus | null,
  toStatus: SubscriptionStatus | null,
  triggeredBy: string,
  reason?: string,
  metadata?: object
) => {
  return prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      eventType,
      fromStatus,
      toStatus,
      triggeredBy,
      reason,
      metadata: metadata as object | undefined,
    },
  });
};

/**
 * Process a webhook event from a payment provider
 */
export const processWebhookEvent = async (
  eventData: WebhookEventData,
  ipAddress?: string,
  userAgent?: string
) => {
  // Create webhook event record
  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      provider: eventData.provider,
      eventType: eventData.eventType,
      subscriptionId: eventData.subscriptionId,
      rawPayload: eventData.rawPayload as object,
      status: WebhookStatus.PROCESSING,
      ipAddress,
      userAgent,
    },
  });

  try {
    // Find subscription by purchase token
    if (!eventData.purchaseToken) {
      throw new Error('No purchase token in webhook');
    }

    const subscription = await prisma.subscription.findFirst({
      where: { purchaseToken: eventData.purchaseToken },
      include: { plan: true },
    });

    if (!subscription) {
      logger.warn('Subscription not found for webhook', {
        purchaseToken: eventData.purchaseToken?.substring(0, 20),
      });
      // Still mark as completed - might be a new purchase we haven't processed yet
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookStatus.COMPLETED,
          subscriptionId: null,
        },
      });
      return { processed: true, subscriptionFound: false };
    }

    // Get updated subscription info from provider
    const provider = getPaymentProvider(subscription.plan.provider);
    const updatedSub = await provider.getSubscription(
      subscription.plan.productId,
      eventData.purchaseToken
    );

    if (updatedSub) {
      const previousStatus = subscription.status;

      // Update subscription
      await updateSubscriptionFromProvider(subscription.id, updatedSub);

      // Create subscription event
      const eventType = mapWebhookToEventType(eventData.eventType);
      if (eventType) {
        await createSubscriptionEvent(
          subscription.id,
          eventType,
          previousStatus,
          updatedSub.status,
          'webhook',
          eventData.eventType
        );
      }

      // Handle specific events
      if (eventData.eventType === 'SUBSCRIPTION_RENEWED') {
        await recordPayment(
          subscription.userId,
          subscription.id,
          subscription.planId,
          subscription.plan.priceCents,
          subscription.plan.currency
        );
      }
    }

    // Mark webhook as completed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: WebhookStatus.COMPLETED,
        subscriptionId: subscription.id,
      },
    });

    return { processed: true, subscriptionFound: true };
  } catch (error) {
    logger.error('Failed to process webhook event', error);

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: WebhookStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: { increment: 1 },
      },
    });

    return { processed: false, error };
  }
};

/**
 * Record a payment in payment history
 */
const recordPayment = async (
  userId: string,
  subscriptionId: string,
  planId: string,
  amountCents: number,
  currency: string
) => {
  return prisma.paymentHistory.create({
    data: {
      userId,
      subscriptionId,
      planId,
      amountCents,
      currency,
      paymentDate: new Date(),
      orderId: `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: PaymentStatus.COMPLETED,
    },
  });
};

/**
 * Map webhook event type to our subscription event type
 */
const mapWebhookToEventType = (
  webhookEventType: string
): SubscriptionEventType | null => {
  const mapping: Record<string, SubscriptionEventType> = {
    SUBSCRIPTION_PURCHASED: SubscriptionEventType.CREATED,
    SUBSCRIPTION_RENEWED: SubscriptionEventType.RENEWED,
    SUBSCRIPTION_CANCELED: SubscriptionEventType.CANCELED,
    SUBSCRIPTION_EXPIRED: SubscriptionEventType.EXPIRED,
    SUBSCRIPTION_PAUSED: SubscriptionEventType.PAUSED,
    SUBSCRIPTION_RESTARTED: SubscriptionEventType.RESUMED,
    SUBSCRIPTION_REVOKED: SubscriptionEventType.REFUNDED,
    SUBSCRIPTION_ON_HOLD: SubscriptionEventType.PAYMENT_FAILED,
    SUBSCRIPTION_RECOVERED: SubscriptionEventType.PAYMENT_RECOVERED,
  };

  return mapping[webhookEventType] || null;
};

/**
 * Get available plans
 */
export const getAvailablePlans = async () => {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
};

/**
 * Check if user has active subscription
 */
export const hasActiveSubscription = async (
  userId: string
): Promise<boolean> => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: {
        gt: new Date(),
      },
    },
  });

  return !!subscription;
};

/**
 * Sync plans from payment providers to database
 */
export const syncPlansFromProviders = async () => {
  const providers = [getPaymentProvider(PaymentProvider.GOOGLE_PAY)];
  const results: { added: number; skipped: number; errors: string[] } = {
    added: 0,
    skipped: 0,
    errors: [],
  };

  for (const provider of providers) {
    try {
      const plans = await provider.fetchPlans();

      for (const plan of plans) {
        // Check if plan already exists
        const existing = await prisma.plan.findUnique({
          where: { productId: plan.productId },
        });

        if (existing) {
          results.skipped++;
          logger.debug(`Plan already exists: ${plan.productId}`);
          continue;
        }

        // Create new plan
        await prisma.plan.create({
          data: {
            name: plan.name,
            description: plan.description,
            priceCents: plan.priceCents,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            features: plan.features,
            provider: provider.provider,
            productId: plan.productId,
            trialPeriodDays: plan.trialPeriodDays,
            isActive: true,
          },
        });

        results.added++;
        logger.info(`Added plan: ${plan.productId}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`${provider.provider}: ${errorMessage}`);
      logger.error(`Failed to sync plans from ${provider.provider}`, error);
    }
  }

  return results;
};
