import prisma from '../config/database';
import { logger } from '../utils/logger';
import {
  Provider,
  SubscriptionStatus,
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
      user_id: userId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
      },
    },
    include: {
      subscription_plan: true,
    },
    orderBy: {
      start_date: 'desc',
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
      where: { user_id: userId },
      include: {
        subscription_plan: true,
      },
      orderBy: { start_date: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.subscription.count({ where: { user_id: userId } }),
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
  provider: Provider
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

  // The productId from Google Play API is in format "subscriptionId:basePlanId"
  const normalizedProductId = result.subscription.productId;

  // Extract subscriptionId and basePlanId from the composite productId
  const [googleSubId, googleBasePlan] = normalizedProductId.includes(':')
    ? normalizedProductId.split(':')
    : [normalizedProductId, null];

  // Find provider_plan by provider_product_id (exact match)
  let providerPlan = await prisma.provider_plan.findFirst({
    where: {
      provider: Provider.GOOGLE_PLAY,
      provider_product_id: normalizedProductId,
      is_active: true,
    },
    include: { subscription_plan: true },
  });

  // Fallback: match by provider_subscription_id (and optionally base plan id)
  if (!providerPlan && googleSubId) {
    providerPlan = await prisma.provider_plan.findFirst({
      where: {
        provider: Provider.GOOGLE_PLAY,
        provider_subscription_id: googleSubId,
        ...(googleBasePlan ? { provider_base_plan_id: googleBasePlan } : {}),
        is_active: true,
      },
      include: { subscription_plan: true },
    });
  }

  if (!providerPlan) {
    logger.error('Plan not found for product', { productId, provider });
    return { success: false, error: 'Plan not found' };
  }

  const subscriptionPlan = providerPlan.subscription_plan;

  // Check if subscription already exists
  const existingSubscription = await prisma.subscription.findFirst({
    where: { purchase_token: purchaseToken },
  });

  let subscription;

  if (existingSubscription) {
    // Update existing subscription
    subscription = await updateSubscriptionFromProvider(
      existingSubscription.id,
      existingSubscription.subscription_plan_id,
      result.subscription
    );
    logger.info('Updated existing subscription', {
      subscriptionId: subscription.id,
    });
  } else {
    // Create new subscription (with SCD2)
    subscription = await createSubscription(
      userId,
      subscriptionPlan.id,
      provider,
      result.subscription
    );
    logger.info('Created new subscription', {
      subscriptionId: subscription.id,
    });

    // Create subscription event
    await createSubscriptionEvent(
      subscription.id,
      'CREATED',
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
 * Create a new subscription record with SCD2 plan history (B4)
 */
const createSubscription = async (
  userId: string,
  planId: string,
  provider: Provider,
  normalizedSub: NormalizedSubscription
) => {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        user_id: userId,
        subscription_plan_id: planId,
        provider,
        external_subscription_id: normalizedSub.subscriptionId,
        status: normalizedSub.status,
        start_date: normalizedSub.startDate,
        current_period_start: normalizedSub.currentPeriodStart,
        current_period_end: normalizedSub.currentPeriodEnd,
        next_billing_date: normalizedSub.nextBillingDate,
        cancel_at_period_end: normalizedSub.cancelAtPeriodEnd,
        canceled_at: normalizedSub.canceledAt,
        trial_start_date: normalizedSub.trialStartDate,
        trial_end_date: normalizedSub.trialEndDate,
        order_id: normalizedSub.orderId,
        purchase_token: normalizedSub.purchaseToken,
        auto_renew: normalizedSub.autoRenew,
      },
      include: { subscription_plan: true },
    });

    // SCD2: initial history row
    await tx.subscription_plan_history.create({
      data: {
        subscription_id: subscription.id,
        subscription_plan_id: planId,
        effective_from: now,
        effective_until: null,
        change_reason: 'initial',
      },
    });

    return subscription;
  });
};

/**
 * Update subscription from provider data.
 * If the provider reports a different productId, performs a B4 SCD2 plan-change
 * inside a transaction: closes the open history row and inserts a new one.
 */
const updateSubscriptionFromProvider = async (
  subscriptionId: string,
  currentSubscriptionPlanId: string,
  normalizedSub: NormalizedSubscription
) => {
  const now = new Date();

  // Resolve new plan from the provider's reported productId (if any)
  let newSubscriptionPlanId: string | null = null;
  let changeReason: 'upgrade' | 'downgrade' | null = null;
  if (normalizedSub.productId) {
    const newProviderPlan = await prisma.provider_plan.findFirst({
      where: { provider_product_id: normalizedSub.productId, is_active: true },
      include: { subscription_plan: true },
    });
    if (
      newProviderPlan &&
      newProviderPlan.subscription_plan_id !== currentSubscriptionPlanId
    ) {
      newSubscriptionPlanId = newProviderPlan.subscription_plan_id;
      const oldPlan = await prisma.subscription_plan.findUnique({
        where: { id: currentSubscriptionPlanId },
      });
      const newPlan = newProviderPlan.subscription_plan;
      changeReason =
        newPlan.tier_level > (oldPlan?.tier_level ?? 0)
          ? 'upgrade'
          : 'downgrade';
    }
  }

  return prisma.$transaction(async (tx) => {
    if (newSubscriptionPlanId && changeReason) {
      // B4 SCD2: close previous open history row
      await tx.subscription_plan_history.updateMany({
        where: { subscription_id: subscriptionId, effective_until: null },
        data: { effective_until: now },
      });
      // B4 SCD2: insert new history row
      await tx.subscription_plan_history.create({
        data: {
          subscription_id: subscriptionId,
          subscription_plan_id: newSubscriptionPlanId,
          effective_from: now,
          effective_until: null,
          change_reason: changeReason,
        },
      });
    }

    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: normalizedSub.status,
        current_period_start: normalizedSub.currentPeriodStart,
        current_period_end: normalizedSub.currentPeriodEnd,
        next_billing_date: normalizedSub.nextBillingDate,
        cancel_at_period_end: normalizedSub.cancelAtPeriodEnd,
        canceled_at: normalizedSub.canceledAt,
        order_id: normalizedSub.orderId,
        auto_renew: normalizedSub.autoRenew,
        ...(newSubscriptionPlanId
          ? { subscription_plan_id: newSubscriptionPlanId }
          : {}),
      },
      include: {
        subscription_plan: {
          include: { provider_plans: true },
        },
      },
    });
  });
};

/**
 * Create a subscription event for audit trail
 */
export const createSubscriptionEvent = async (
  subscriptionId: string,
  eventType: string,
  fromStatus: SubscriptionStatus | null,
  toStatus: SubscriptionStatus | null,
  triggeredBy: string,
  reason?: string,
  webhookEventId?: string,
  metadata?: object
) => {
  return prisma.subscription_event.create({
    data: {
      subscription_id: subscriptionId,
      event_type: eventType,
      from_status: fromStatus,
      to_status: toStatus,
      triggered_by: triggeredBy,
      reason,
      webhook_event_id: webhookEventId,
      metadata: metadata as object | undefined,
    },
  });
};

/**
 * Process a webhook event from a payment provider (B3: idempotency)
 */
export const processWebhookEvent = async (
  eventData: WebhookEventData,
  ipAddress?: string,
  userAgent?: string
) => {
  const idempotencyKey = eventData.idempotency_key;

  // 1. Idempotency: if already COMPLETED, skip
  const existing = await prisma.webhook_event.findUnique({
    where: { idempotency_key: idempotencyKey },
  });
  if (existing?.status === WebhookStatus.COMPLETED) {
    logger.info('Duplicate webhook, already completed', { idempotencyKey });
    return { processed: true, duplicate: true };
  }

  // 2. Upsert webhook_event as PENDING
  const webhookEvent = await prisma.webhook_event.upsert({
    where: { idempotency_key: idempotencyKey },
    create: {
      idempotency_key: idempotencyKey,
      provider: eventData.provider,
      event_type: eventData.eventType,
      subscription_id: eventData.subscriptionId,
      raw_payload: eventData.rawPayload as object,
      status: WebhookStatus.PENDING,
      ip_address: ipAddress,
      user_agent: userAgent,
    },
    update: {
      status: WebhookStatus.PENDING,
      error_message: null,
    },
  });

  try {
    if (!eventData.purchaseToken) {
      throw new Error('No purchase token in webhook');
    }

    const subscription = await prisma.subscription.findFirst({
      where: { purchase_token: eventData.purchaseToken },
      include: { subscription_plan: { include: { provider_plans: true } } },
    });

    if (!subscription) {
      logger.warn('Subscription not found for webhook', {
        purchaseToken: eventData.purchaseToken?.substring(0, 20),
      });
      await prisma.webhook_event.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookStatus.COMPLETED,
          processed_at: new Date(),
          subscription_id: null,
        },
      });
      return { processed: true, subscriptionFound: false };
    }

    // Find matching provider_plan for this subscription
    const providerPlan = subscription.subscription_plan.provider_plans[0];
    const provider = getPaymentProvider(subscription.provider);

    const updatedSub = providerPlan
      ? await provider.getSubscription(
          providerPlan.provider_product_id,
          eventData.purchaseToken
        )
      : null;

    if (updatedSub) {
      const previousStatus = subscription.status;

      await updateSubscriptionFromProvider(
        subscription.id,
        subscription.subscription_plan_id,
        updatedSub
      );

      const eventType = mapWebhookToEventType(eventData.eventType);
      if (eventType) {
        await createSubscriptionEvent(
          subscription.id,
          eventType,
          previousStatus,
          updatedSub.status,
          'webhook',
          eventData.eventType,
          webhookEvent.id
        );
      }

      if (
        eventData.eventType === 'SUBSCRIPTION_RENEWED' &&
        updatedSub.orderId
      ) {
        await recordPayment(
          subscription.user_id,
          subscription.id,
          subscription.subscription_plan_id,
          subscription.provider,
          subscription.subscription_plan.price_cents,
          subscription.subscription_plan.currency,
          updatedSub.orderId
        );
      }

      // Evict from coach rosters on terminal events only.
      // CANCELED = paid through end of period; PAST_DUE = grace period retrying payment.
      // Only EXPIRED and REVOKED mean the user has truly lost access.
      if (
        eventData.eventType === 'SUBSCRIPTION_EXPIRED' ||
        eventData.eventType === 'SUBSCRIPTION_REVOKED'
      ) {
        await evictUserFromCoachRosters(subscription.user_id);
      }
    }

    await prisma.webhook_event.update({
      where: { id: webhookEvent.id },
      data: {
        status: WebhookStatus.COMPLETED,
        processed_at: new Date(),
        subscription_id: subscription.id,
      },
    });

    return { processed: true, subscriptionFound: true };
  } catch (error) {
    logger.error('Failed to process webhook event', error);
    await prisma.webhook_event.update({
      where: { id: webhookEvent.id },
      data: {
        status: WebhookStatus.FAILED,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        retry_count: { increment: 1 },
      },
    });
    return { processed: false, error };
  }
};

/**
 * Bulk-ends all active subscribed_coach relationships for a user.
 * Call only on terminal events (EXPIRED, REVOKED) — not on CANCELED or PAST_DUE.
 * CANCELED means the user paid through the end of the period.
 * PAST_DUE means a grace period is active and the payment provider is retrying.
 */
const evictUserFromCoachRosters = async (userId: string): Promise<void> => {
  const result = await prisma.subscribed_coach.updateMany({
    where: { user_id: userId, ended_at: null },
    data: { ended_at: new Date() },
  });
  logger.info('Evicted user from coach rosters', {
    userId,
    affectedRosters: result.count,
  });
};

/**
 * Record a payment in payment history (B5: composite key idempotency)
 */
const recordPayment = async (
  userId: string,
  subscriptionId: string,
  subscriptionPlanId: string,
  provider: Provider,
  amountCents: number,
  currency: string,
  providerOrderId: string
) => {
  // Idempotency check (B5 composite key)
  const existing = await prisma.payment_history.findUnique({
    where: {
      subscription_id_provider_order_id: {
        subscription_id: subscriptionId,
        provider_order_id: providerOrderId,
      },
    },
  });
  if (existing) {
    logger.info('Payment already recorded, skipping', {
      subscriptionId,
      providerOrderId,
    });
    return existing;
  }

  return prisma.payment_history.create({
    data: {
      user_id: userId,
      subscription_id: subscriptionId,
      subscription_plan_id: subscriptionPlanId,
      provider,
      amount_cents: amountCents,
      currency,
      payment_date: new Date(),
      provider_order_id: providerOrderId,
      status: PaymentStatus.COMPLETED,
    },
  });
};

/**
 * Map webhook event type to subscription event type string
 */
const mapWebhookToEventType = (webhookEventType: string): string | null => {
  const mapping: Record<string, string> = {
    SUBSCRIPTION_PURCHASED: 'CREATED',
    SUBSCRIPTION_RENEWED: 'RENEWED',
    SUBSCRIPTION_CANCELED: 'CANCELED',
    SUBSCRIPTION_EXPIRED: 'EXPIRED',
    SUBSCRIPTION_PAUSED: 'PAUSED',
    SUBSCRIPTION_RESTARTED: 'RESUMED',
    SUBSCRIPTION_REVOKED: 'REFUNDED',
    SUBSCRIPTION_ON_HOLD: 'PAYMENT_FAILED',
    SUBSCRIPTION_RECOVERED: 'PAYMENT_RECOVERED',
  };

  return mapping[webhookEventType] ?? null;
};

/**
 * Get available subscription plans
 */
export const getAvailablePlans = async () => {
  return prisma.subscription_plan.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
    include: { provider_plans: { where: { is_active: true } } },
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
      user_id: userId,
      status: SubscriptionStatus.ACTIVE,
      current_period_end: {
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
  const providers = [getPaymentProvider(Provider.GOOGLE_PLAY)];
  const results: { added: number; skipped: number; errors: string[] } = {
    added: 0,
    skipped: 0,
    errors: [],
  };

  for (const provider of providers) {
    try {
      const plans = await provider.fetchPlans();

      for (const plan of plans) {
        // Parse composite productId into subscriptionId:basePlanId
        const [providerSubscriptionId, providerBasePlanId] =
          plan.productId.includes(':')
            ? plan.productId.split(':')
            : [plan.productId, null];

        // Check if provider_plan already exists
        const existingProviderPlan = await prisma.provider_plan.findUnique({
          where: {
            provider_provider_product_id: {
              provider: Provider.GOOGLE_PLAY,
              provider_product_id: plan.productId,
            },
          },
        });

        if (existingProviderPlan) {
          results.skipped++;
          logger.debug(`Plan already exists: ${plan.productId}`);
          continue;
        }

        // Upsert subscription_plan by name
        const subscriptionPlan = await prisma.subscription_plan.upsert({
          where: { name: plan.name },
          create: {
            name: plan.name,
            description: plan.description || '',
            price_cents: plan.priceCents,
            currency: plan.currency,
            billing_cycle: plan.billingCycle,
            features: plan.features,
            trial_period_days: plan.trialPeriodDays,
            is_active: true,
          },
          update: {
            price_cents: plan.priceCents,
            currency: plan.currency,
            features: plan.features,
            trial_period_days: plan.trialPeriodDays,
          },
        });

        // Upsert provider_plan by (provider, provider_product_id)
        await prisma.provider_plan.upsert({
          where: {
            provider_provider_product_id: {
              provider: Provider.GOOGLE_PLAY,
              provider_product_id: plan.productId,
            },
          },
          create: {
            subscription_plan_id: subscriptionPlan.id,
            provider: Provider.GOOGLE_PLAY,
            provider_product_id: plan.productId,
            provider_subscription_id: providerSubscriptionId,
            provider_base_plan_id: providerBasePlanId,
            is_active: true,
          },
          update: {
            provider_subscription_id: providerSubscriptionId,
            provider_base_plan_id: providerBasePlanId,
            is_active: true,
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

export const fetchPlansFromProvider = async (providerType: Provider) => {
  const provider = getPaymentProvider(providerType);
  return provider.fetchPlans();
};
