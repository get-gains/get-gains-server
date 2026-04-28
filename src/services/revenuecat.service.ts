import prisma from '../config/database';
import { logger } from '../utils/logger';
import {
  SubscriptionTier,
  RcSubscriptionStatus,
  SubscriptionStore,
  RcEventType,
  RcEventStatus,
} from '@prisma/client';
import {
  REVENUECAT_API_BASE,
  REVENUECAT_API_KEY,
  REVENUECAT_PROJECT_ID,
} from '../config/revenuecat';

// ============== Types ==============

interface RcWebhookEvent {
  api_version: string;
  event: {
    id: string;
    type: string;
    app_user_id: string;
    original_app_user_id?: string;
    aliases?: string[];
    product_id?: string;
    entitlement_ids?: string[];
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    environment?: string;
    store?: string;
    is_trial_conversion?: boolean;
    cancel_reason?: string;
    grace_period_expiration_at_ms?: number;
    auto_resume_at_ms?: number;
    original_transaction_id?: string;
    presented_offering_id?: string;
    price_in_purchased_currency?: number;
    currency?: string;
    subscriber_attributes?: Record<string, { value: string }>;
    transaction_id?: string;
  };
}

interface DerivedState {
  tier: SubscriptionTier;
  status: RcSubscriptionStatus;
  store: SubscriptionStore;
}

// ============== Mapping Helpers ==============

const RC_EVENT_TYPE_MAP: Record<string, RcEventType> = {
  INITIAL_PURCHASE: RcEventType.INITIAL_PURCHASE,
  RENEWAL: RcEventType.RENEWAL,
  CANCELLATION: RcEventType.CANCELLATION,
  UNCANCELLATION: RcEventType.UNCANCELLATION,
  NON_RENEWING_PURCHASE: RcEventType.NON_RENEWING_PURCHASE,
  EXPIRATION: RcEventType.EXPIRATION,
  BILLING_ISSUE: RcEventType.BILLING_ISSUE,
  PRODUCT_CHANGE: RcEventType.PRODUCT_CHANGE,
  TRANSFER: RcEventType.TRANSFER,
  SUBSCRIPTION_PAUSED: RcEventType.SUBSCRIPTION_PAUSED,
  SUBSCRIPTION_EXTENDED: RcEventType.SUBSCRIPTION_EXTENDED,
  TEMPORARY_ENTITLEMENT_GRANT: RcEventType.TEMPORARY_ENTITLEMENT_GRANT,
  REFUND: RcEventType.REFUND,
  TEST: RcEventType.TEST,
};

const RC_STORE_MAP: Record<string, SubscriptionStore> = {
  APP_STORE: SubscriptionStore.APP_STORE,
  PLAY_STORE: SubscriptionStore.PLAY_STORE,
  STRIPE: SubscriptionStore.STRIPE,
  PROMOTIONAL: SubscriptionStore.PROMOTIONAL,
  MAC_APP_STORE: SubscriptionStore.APP_STORE,
};

function mapRcEventType(type: string): RcEventType {
  return RC_EVENT_TYPE_MAP[type] ?? RcEventType.TEST;
}

function mapStore(store?: string): SubscriptionStore {
  if (!store) return SubscriptionStore.PLAY_STORE;
  return RC_STORE_MAP[store] ?? SubscriptionStore.PLAY_STORE;
}

/**
 * Derive tier and status from the RC event.
 * Active entitlement = PREMIUM, otherwise FREE.
 */
function deriveState(event: RcWebhookEvent['event']): DerivedState {
  const store = mapStore(event.store);
  const type = event.type;

  // Events that indicate an active subscription
  const activeEvents = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'SUBSCRIPTION_EXTENDED',
    'TEMPORARY_ENTITLEMENT_GRANT',
    'PRODUCT_CHANGE',
  ]);

  // Events that mean subscription is still active but won't renew
  const cancelledEvents = new Set(['CANCELLATION']);

  // Events that mean subscription is gone
  const terminalEvents = new Set(['EXPIRATION', 'REFUND']);

  // Billing issue = grace period
  const gracePeriodEvents = new Set(['BILLING_ISSUE']);

  // Paused
  const pausedEvents = new Set(['SUBSCRIPTION_PAUSED']);

  let tier: SubscriptionTier = SubscriptionTier.FREE;
  let status: RcSubscriptionStatus = RcSubscriptionStatus.EXPIRED;

  if (activeEvents.has(type)) {
    tier = SubscriptionTier.PREMIUM;
    // Check if it's a trial
    if (event.period_type === 'TRIAL') {
      status = RcSubscriptionStatus.TRIALING;
    } else {
      status = RcSubscriptionStatus.ACTIVE;
    }
  } else if (cancelledEvents.has(type)) {
    // Still active until period end
    tier = SubscriptionTier.PREMIUM;
    status = RcSubscriptionStatus.CANCELLED;
  } else if (gracePeriodEvents.has(type)) {
    tier = SubscriptionTier.PREMIUM;
    status = RcSubscriptionStatus.GRACE_PERIOD;
  } else if (pausedEvents.has(type)) {
    tier = SubscriptionTier.FREE;
    status = RcSubscriptionStatus.PAUSED;
  } else if (terminalEvents.has(type)) {
    tier = SubscriptionTier.FREE;
    status = RcSubscriptionStatus.EXPIRED;
  } else if (type === 'NON_RENEWING_PURCHASE') {
    tier = SubscriptionTier.PREMIUM;
    status = RcSubscriptionStatus.ACTIVE;
  } else if (type === 'TRANSFER') {
    // Transfer: new user gets the subscription
    tier = SubscriptionTier.PREMIUM;
    status = RcSubscriptionStatus.ACTIVE;
  }

  return { tier, status, store };
}

// ============== Core Webhook Handler ==============

/**
 * Process a RevenueCat webhook event.
 *
 * Flow (single prisma.$transaction):
 * 1. Idempotency short-circuit
 * 2. Resolve user by app_user_id = supabase_auth_id
 * 3. Derive tier/status from event
 * 4. Transaction: upsert user_subscription + update user.active_subscription_tier + insert rc_subscription_event
 * 5. Evict from coach rosters if tier dropped to FREE
 */
export const processRevenueCatWebhook = async (
  payload: RcWebhookEvent
): Promise<{ processed: boolean; duplicate?: boolean }> => {
  const event = payload.event;
  const rcEventId = event.id;
  const appUserId = event.app_user_id;

  // 1. Idempotency short-circuit
  const existing = await prisma.rc_subscription_event.findUnique({
    where: { rc_event_id: rcEventId },
  });
  if (existing?.status === RcEventStatus.COMPLETED) {
    logger.info('Duplicate RC webhook, already completed', { rcEventId });
    return { processed: true, duplicate: true };
  }

  // 2. Resolve user
  const user = await prisma.user.findUnique({
    where: { supabase_auth_id: appUserId },
    select: {
      supabase_auth_id: true,
      active_subscription_tier: true,
      user_subscription: { select: { status: true } },
    },
  });

  if (!user) {
    // Pre-signup event or unknown user — log and ACK
    logger.warn('RC webhook for unknown user, acknowledging', {
      appUserId,
      rcEventId,
    });
    await prisma.rc_subscription_event.upsert({
      where: { rc_event_id: rcEventId },
      create: {
        rc_event_id: rcEventId,
        user_id: appUserId,
        event_type: mapRcEventType(event.type),
        status: RcEventStatus.FAILED,
        occurred_at: event.purchased_at_ms
          ? new Date(event.purchased_at_ms)
          : new Date(),
        raw_payload: payload as unknown as object,
        error_message: 'User not found',
      },
      update: {
        status: RcEventStatus.FAILED,
        error_message: 'User not found',
        retry_count: { increment: 1 },
      },
    });
    return { processed: true };
  }

  // 3. Derive tier/status
  const { tier, status, store } = deriveState(event);
  const eventType = mapRcEventType(event.type);
  const previousTier = user.active_subscription_tier;
  const previousStatus = user.user_subscription?.status ?? null;
  const entitlementId = event.entitlement_ids?.[0] ?? 'Premium';
  const productId = event.product_id ?? '';
  const occurredAt = event.purchased_at_ms
    ? new Date(event.purchased_at_ms)
    : new Date();
  const periodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date();
  const periodStart = event.purchased_at_ms
    ? new Date(event.purchased_at_ms)
    : new Date();

  // Determine will_renew: false if CANCELLATION, EXPIRATION, REFUND, BILLING_ISSUE
  const noRenewEvents = new Set([
    'CANCELLATION',
    'EXPIRATION',
    'REFUND',
    'BILLING_ISSUE',
    'SUBSCRIPTION_PAUSED',
  ]);
  const willRenew = !noRenewEvents.has(event.type);
  const cancelAtPeriodEnd = event.type === 'CANCELLATION';

  try {
    // 4. Transaction: upsert subscription + update user tier + insert event
    await prisma.$transaction([
      prisma.user_subscription.upsert({
        where: { user_id: user.supabase_auth_id },
        create: {
          user_id: user.supabase_auth_id,
          tier,
          status,
          store,
          entitlement_id: entitlementId,
          product_id: productId,
          rc_original_tx_id: event.original_transaction_id ?? null,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          trial_ends_at: event.period_type === 'TRIAL' ? periodEnd : null,
          cancel_at_period_end: cancelAtPeriodEnd,
          will_renew: willRenew,
        },
        update: {
          tier,
          status,
          store,
          entitlement_id: entitlementId,
          product_id: productId,
          rc_original_tx_id: event.original_transaction_id ?? undefined,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          trial_ends_at: event.period_type === 'TRIAL' ? periodEnd : undefined,
          cancel_at_period_end: cancelAtPeriodEnd,
          will_renew: willRenew,
        },
      }),
      prisma.user.update({
        where: { supabase_auth_id: user.supabase_auth_id },
        data: { active_subscription_tier: tier },
      }),
      prisma.rc_subscription_event.upsert({
        where: { rc_event_id: rcEventId },
        create: {
          rc_event_id: rcEventId,
          user_id: user.supabase_auth_id,
          event_type: eventType,
          status: RcEventStatus.COMPLETED,
          from_tier: previousTier,
          to_tier: tier,
          from_status: previousStatus,
          to_status: status,
          store,
          product_id: productId || null,
          entitlement_id: entitlementId,
          occurred_at: occurredAt,
          raw_payload: payload as unknown as object,
          processed_at: new Date(),
        },
        update: {
          status: RcEventStatus.COMPLETED,
          from_tier: previousTier,
          to_tier: tier,
          from_status: previousStatus,
          to_status: status,
          processed_at: new Date(),
          error_message: null,
        },
      }),
    ]);

    logger.info('RC webhook processed', {
      rcEventId,
      appUserId,
      eventType: event.type,
      tier,
      status,
    });

    // 5. Evict from coach rosters if user lost subscription
    // TODO: Re-enable evictions once subscription flow is stable
    // if (tier === SubscriptionTier.FREE) {
    //   await evictUserFromCoachRosters(user.supabase_auth_id);
    // }

    return { processed: true };
  } catch (error) {
    logger.error('Failed to process RC webhook event', error);

    // Record failure for retry/audit
    await prisma.rc_subscription_event
      .upsert({
        where: { rc_event_id: rcEventId },
        create: {
          rc_event_id: rcEventId,
          user_id: user.supabase_auth_id,
          event_type: eventType,
          status: RcEventStatus.FAILED,
          occurred_at: occurredAt,
          raw_payload: payload as unknown as object,
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        },
        update: {
          status: RcEventStatus.FAILED,
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
          retry_count: { increment: 1 },
        },
      })
      .catch((e) => logger.error('Failed to record RC event failure', e));

    return { processed: false };
  }
};

// ============== Coach Roster Eviction ==============

/**
 * Bulk-ends all active subscribed_coach relationships for a user.
 * Called when a user's subscription tier drops to FREE.
 */
export const evictUserFromCoachRosters = async (
  userId: string
): Promise<void> => {
  const result = await prisma.subscribed_coach.updateMany({
    where: { user_id: userId, ended_at: null },
    data: { ended_at: new Date() },
  });
  if (result.count > 0) {
    logger.info('Evicted user from coach rosters', {
      userId,
      affectedRosters: result.count,
    });
  }
};

// ============== RC API Client ==============

/**
 * Fetch a customer's entitlements from RevenueCat REST API v2.
 * Used by the backfill script.
 */
export const getRevenueCatCustomer = async (
  appUserId: string
): Promise<{
  tier: SubscriptionTier;
  status: RcSubscriptionStatus;
  store: SubscriptionStore;
  entitlementId: string | null;
  productId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  originalTxId: string | null;
} | null> => {
  if (!REVENUECAT_API_KEY || !REVENUECAT_PROJECT_ID) {
    logger.error('RevenueCat API key or project ID not configured');
    return null;
  }

  const url = `${REVENUECAT_API_BASE}/projects/${REVENUECAT_PROJECT_ID}/customers/${appUserId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${REVENUECAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    logger.error('RC API error', {
      status: response.status,
      appUserId,
    });
    return null;
  }

  const data = (await response.json()) as {
    subscriber?: {
      entitlements?: Record<
        string,
        {
          product_identifier?: string;
          purchase_date?: string;
          expires_date?: string;
          store?: string;
          original_purchase_date?: string;
        }
      >;
      subscriptions?: Record<
        string,
        {
          original_purchase_date?: string;
          store?: string;
          store_transaction_id?: string;
        }
      >;
    };
  };

  const entitlements = data.subscriber?.entitlements;
  if (!entitlements || Object.keys(entitlements).length === 0) {
    return {
      tier: SubscriptionTier.FREE,
      status: RcSubscriptionStatus.EXPIRED,
      store: SubscriptionStore.PLAY_STORE,
      entitlementId: null,
      productId: null,
      periodStart: null,
      periodEnd: null,
      originalTxId: null,
    };
  }

  // Take the first active entitlement
  const [entitlementId, entitlement] = Object.entries(entitlements)[0];
  const productId = entitlement.product_identifier ?? null;
  const periodEnd = entitlement.expires_date
    ? new Date(entitlement.expires_date)
    : null;
  const periodStart = entitlement.purchase_date
    ? new Date(entitlement.purchase_date)
    : null;
  const store = mapStore(entitlement.store);

  // Look up original tx id from subscriptions
  const subscriptions = data.subscriber?.subscriptions ?? {};
  const sub = productId ? subscriptions[productId] : undefined;
  const originalTxId = sub?.store_transaction_id ?? null;

  const isActive = periodEnd ? periodEnd > new Date() : false;

  return {
    tier: isActive ? SubscriptionTier.PREMIUM : SubscriptionTier.FREE,
    status: isActive
      ? RcSubscriptionStatus.ACTIVE
      : RcSubscriptionStatus.EXPIRED,
    store,
    entitlementId,
    productId,
    periodStart,
    periodEnd,
    originalTxId,
  };
};
