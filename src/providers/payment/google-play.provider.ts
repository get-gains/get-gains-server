import 'dotenv/config';
import { google, androidpublisher_v3 } from 'googleapis';
import { logger } from '../../utils/logger';
import { Provider, SubscriptionStatus, BillingCycle } from '@prisma/client';
import {
  IPaymentProvider,
  NormalizedSubscription,
  NormalizedPlan,
  VerifyPurchaseResult,
  WebhookEventData,
} from './payment.provider.interface';

// Google Play subscription state constants
const SUBSCRIPTION_STATE = {
  SUBSCRIPTION_STATE_UNSPECIFIED: 0,
  SUBSCRIPTION_STATE_PENDING: 1,
  SUBSCRIPTION_STATE_ACTIVE: 2,
  SUBSCRIPTION_STATE_PAUSED: 3,
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 4,
  SUBSCRIPTION_STATE_ON_HOLD: 5,
  SUBSCRIPTION_STATE_CANCELED: 6,
  SUBSCRIPTION_STATE_EXPIRED: 7,
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 8,
} as const;

// Google Play notification types
const NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
};

/**
 * Google Play Billing provider implementation
 */
export class GooglePlayProvider implements IPaymentProvider {
  public readonly provider = Provider.GOOGLE_PLAY;
  private androidPublisher: androidpublisher_v3.Androidpublisher;
  private packageName: string;

  constructor() {
    logger.debug('Initializing GooglePlayProvider', {
      hasPackageName: !!process.env.GOOGLE_PLAY_PACKAGE_NAME,
      hasServiceAccountJson: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    });

    this.packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || '';

    if (!this.packageName) {
      logger.warn('GOOGLE_PLAY_PACKAGE_NAME not set');
    }

    // Initialize Google API client
    let auth;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Use credentials from environment variable (recommended for production)
      logger.debug('Attempting to parse GOOGLE_SERVICE_ACCOUNT_JSON', {
        envVarLength: process.env.GOOGLE_SERVICE_ACCOUNT_JSON.length,
        firstChars: process.env.GOOGLE_SERVICE_ACCOUNT_JSON.substring(0, 50),
        lastChars: process.env.GOOGLE_SERVICE_ACCOUNT_JSON.substring(
          process.env.GOOGLE_SERVICE_ACCOUNT_JSON.length - 50
        ),
      });

      try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        logger.debug('Successfully parsed Google service account credentials', {
          hasPrivateKey: !!credentials.private_key,
          clientEmail: credentials.client_email,
        });
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/androidpublisher'],
        });
      } catch (error) {
        logger.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON', error);
        throw new Error(
          'Invalid GOOGLE_SERVICE_ACCOUNT_JSON format: ' +
            (error instanceof Error ? error.message : 'Unknown error')
        );
      }
    }

    this.androidPublisher = google.androidpublisher({
      version: 'v3',
      auth,
    });
  }

  /**
   * Map Google Play subscription state to our internal status
   */
  mapStatus(state: number | string): SubscriptionStatus {
    const stateNum = typeof state === 'string' ? parseInt(state, 10) : state;

    switch (stateNum) {
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_PENDING:
        return SubscriptionStatus.PENDING;
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_ACTIVE:
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_IN_GRACE_PERIOD:
        return SubscriptionStatus.ACTIVE;
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_ON_HOLD:
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_PAUSED:
        return SubscriptionStatus.PAST_DUE;
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_CANCELED:
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED:
        return SubscriptionStatus.CANCELED;
      case SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_EXPIRED:
        return SubscriptionStatus.EXPIRED;
      default:
        logger.warn(`Unknown Google Play subscription state: ${state}`);
        return SubscriptionStatus.PENDING;
    }
  }

  /**
   * Map Google Play billing period to our BillingCycle enum
   */
  private mapBillingCycle(period: string): BillingCycle {
    // Period format: P1M (1 month), P1Y (1 year), P1W (1 week), etc.
    if (period.includes('D')) {
      const days = parseInt(period.replace(/\D/g, ''), 10);
      if (days === 1) return BillingCycle.DAILY;
      if (days === 7) return BillingCycle.WEEKLY;
      return BillingCycle.DAILY;
    }
    if (period.includes('W')) return BillingCycle.WEEKLY;
    if (period.includes('M')) {
      const months = parseInt(period.replace(/\D/g, ''), 10);
      if (months === 1) return BillingCycle.MONTHLY;
      if (months === 3) return BillingCycle.QUARTERLY;
      if (months === 6) return BillingCycle.SEMIANNUALLY;
      return BillingCycle.MONTHLY;
    }
    if (period.includes('Y')) return BillingCycle.YEARLY;
    return BillingCycle.MONTHLY;
  }

  /**
   * Verify a purchase from the client
   */
  async verifyPurchase(
    productId: string,
    purchaseToken: string
  ): Promise<VerifyPurchaseResult> {
    try {
      logger.debug('Verifying Google Play purchase', { productId });

      const response =
        await this.androidPublisher.purchases.subscriptionsv2.get({
          packageName: this.packageName,
          token: purchaseToken,
        });

      const subscription = response.data;

      if (!subscription) {
        return {
          isValid: false,
          subscription: null,
          errorMessage: 'Subscription not found',
        };
      }

      const normalized = this.normalizeSubscription(
        subscription,
        purchaseToken
      );

      return {
        isValid: true,
        subscription: normalized,
      };
    } catch (error) {
      logger.error('Failed to verify Google Play purchase', error);
      return {
        isValid: false,
        subscription: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Acknowledge a purchase (required by Google Play)
   */
  async acknowledgePurchase(
    productId: string,
    purchaseToken: string
  ): Promise<boolean> {
    try {
      // Extract just the subscription ID (before the colon)
      // productId may be "get_gains.premium" or "get_gains.premium:premium-subscription"
      const subscriptionId = productId.split(':')[0];

      logger.debug('Acknowledging Google Play purchase', {
        subscriptionId,
        originalProductId: productId,
      });

      await this.androidPublisher.purchases.subscriptions.acknowledge({
        packageName: this.packageName,
        subscriptionId,
        token: purchaseToken,
      });

      logger.info('Google Play purchase acknowledged', { subscriptionId });
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge Google Play purchase', error);
      return false;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(
    productId: string,
    purchaseToken: string
  ): Promise<NormalizedSubscription | null> {
    try {
      const response =
        await this.androidPublisher.purchases.subscriptionsv2.get({
          packageName: this.packageName,
          token: purchaseToken,
        });

      if (!response.data) {
        return null;
      }

      return this.normalizeSubscription(response.data, purchaseToken);
    } catch (error) {
      logger.error('Failed to get Google Play subscription', error);
      return null;
    }
  }

  /**
   * Cancel a subscription (defer cancellation to end of period)
   */
  async cancelSubscription(
    productId: string,
    purchaseToken: string
  ): Promise<boolean> {
    try {
      // Extract just the subscription ID (before the colon)
      // productId may be "get_gains.premium" or "get_gains.premium:premium-subscription"
      const subscriptionId = productId.split(':')[0];

      logger.debug('Canceling Google Play subscription', {
        subscriptionId,
        originalProductId: productId,
      });

      await this.androidPublisher.purchases.subscriptions.cancel({
        packageName: this.packageName,
        subscriptionId,
        token: purchaseToken,
      });

      logger.info('Google Play subscription canceled', { subscriptionId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel Google Play subscription', error);
      return false;
    }
  }

  /**
   * Fetch all subscription products from Google Play Console
   */
  async fetchPlans(): Promise<NormalizedPlan[]> {
    try {
      logger.debug('Fetching Google Play subscription products');

      const response =
        await this.androidPublisher.monetization.subscriptions.list({
          packageName: this.packageName,
        });

      const subscriptions = response.data.subscriptions || [];

      logger.debug(
        `Fetched ${subscriptions.length} subscriptions from Google Play`
      );

      const plans: NormalizedPlan[] = [];

      for (const sub of subscriptions) {
        if (!sub.productId || !sub.basePlans) continue;

        logger.debug('listings', { listings: sub.listings });

        // Get benefits from listings (prefer English, fallback to first available)
        const listing =
          sub.listings?.find((l) => l.languageCode === 'en-US') ||
          sub.listings?.[0];
        const features = listing?.benefits || [];

        // Each subscription can have multiple base plans
        for (const basePlan of sub.basePlans) {
          logger.debug('Processing base plan', { basePlan });
          if (!basePlan.basePlanId) continue;

          // Get pricing from regional config (default to first available)
          const pricing = basePlan.regionalConfigs?.[0];
          const priceInfo = pricing?.price;

          const plan: NormalizedPlan = {
            productId: `${sub.productId}:${basePlan.basePlanId}`,
            name: listing?.title || sub.productId,
            description: listing?.description || sub.productId,
            priceCents: priceInfo?.units
              ? parseInt(priceInfo.units, 10) * 100 +
                (priceInfo.nanos || 0) / 10000000
              : 0,
            currency: priceInfo?.currencyCode || 'PHP',
            billingCycle: this.mapBillingCycle(
              basePlan.autoRenewingBasePlanType?.billingPeriodDuration || 'P1M'
            ),
            trialPeriodDays: basePlan.autoRenewingBasePlanType
              ?.gracePeriodDuration
              ? this.parseDurationToDays(
                  basePlan.autoRenewingBasePlanType.gracePeriodDuration
                )
              : null,
            features,
          };

          plans.push(plan);
        }
      }

      logger.info(`Fetched ${plans.length} plans from Google Play`);
      return plans;
    } catch (error) {
      logger.error('Failed to fetch Google Play plans', error);
      throw error; // Re-throw so caller can handle it
    }
  }

  /**
   * Parse webhook payload from Google Cloud Pub/Sub
   */
  async parseWebhook(
    payload: unknown,
    _headers: Record<string, string>
  ): Promise<WebhookEventData | null> {
    try {
      // Pub/Sub push format
      const message = payload as {
        message?: {
          data?: string;
          messageId?: string;
        };
        subscription?: string;
      };

      if (!message?.message?.data) {
        logger.warn('Invalid Pub/Sub message format');
        return null;
      }

      // Decode base64 message data
      const decodedData = Buffer.from(message.message.data, 'base64').toString(
        'utf-8'
      );
      const notification = JSON.parse(decodedData) as {
        version?: string;
        packageName?: string;
        eventTimeMillis?: string;
        subscriptionNotification?: {
          version?: string;
          notificationType?: number;
          purchaseToken?: string;
          subscriptionId?: string;
        };
      };

      const subNotification = notification.subscriptionNotification;
      if (!subNotification) {
        logger.warn('No subscription notification in payload');
        return null;
      }

      const notificationType = subNotification.notificationType || 0;
      const eventType =
        NOTIFICATION_TYPES[notificationType] || `UNKNOWN_${notificationType}`;

      return {
        provider: Provider.GOOGLE_PLAY,
        eventType,
        subscriptionId: null, // Will be resolved by looking up purchaseToken
        idempotency_key:
          message.message.messageId ??
          `google_play_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        rawPayload: payload,
        purchaseToken: subNotification.purchaseToken,
        productId: subNotification.subscriptionId,
      };
    } catch (error) {
      logger.error('Failed to parse Google Play webhook', error);
      return null;
    }
  }

  /**
   * Normalize Google Play subscription response to our format
   */
  private normalizeSubscription(
    subscription: androidpublisher_v3.Schema$SubscriptionPurchaseV2,
    purchaseToken: string
  ): NormalizedSubscription {
    const lineItems = subscription.lineItems || [];
    const firstItem = lineItems[0];
    const expiryTime = firstItem?.expiryTime;
    const autoRenewEnabled =
      firstItem?.autoRenewingPlan?.autoRenewEnabled ?? false;

    // Parse timestamps
    const startTime = subscription.startTime
      ? new Date(subscription.startTime)
      : new Date();
    const expiryDate = expiryTime ? new Date(expiryTime) : new Date();

    // Calculate period start (use start time or last renewal)
    const currentPeriodStart = startTime;
    let currentPeriodEnd = expiryDate;

    // In development mode, Google Play test subscriptions use accelerated
    // expiry (e.g. 1-month plan = 5 minutes). Extend short periods to 30
    // minutes so we can actually test subscription-gated features.
    if (process.env.NODE_ENV === 'development') {
      const periodMs = expiryDate.getTime() - startTime.getTime();
      const TEN_MINUTES_MS = 10 * 60 * 1000;
      const THIRTY_MINUTES_MS = 30 * 60 * 1000;

      if (periodMs > 0 && periodMs <= TEN_MINUTES_MS) {
        currentPeriodEnd = new Date(startTime.getTime() + THIRTY_MINUTES_MS);
        logger.info(
          'Dev mode: extended test subscription period from ' +
            `${Math.round(periodMs / 60000)}m to 30m`,
          { originalExpiry: expiryDate, extendedExpiry: currentPeriodEnd }
        );
      }
    }

    // Check for cancellation
    const canceledStateContext = subscription.canceledStateContext;
    const canceledAt = canceledStateContext ? new Date() : null;

    // Get subscription state
    // Google Play API v2 returns subscriptionState as a string like "SUBSCRIPTION_STATE_ACTIVE"
    // We need to map it to our internal numeric constants
    logger.debug('Parsing subscription state', {
      rawState: subscription.subscriptionState,
      stateType: typeof subscription.subscriptionState,
    });

    let state: number = SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_UNSPECIFIED;
    if (
      subscription.subscriptionState !== null &&
      subscription.subscriptionState !== undefined
    ) {
      const rawState = subscription.subscriptionState;

      // Check if it's a string enum value (e.g., "SUBSCRIPTION_STATE_ACTIVE")
      if (
        typeof rawState === 'string' &&
        rawState.startsWith('SUBSCRIPTION_STATE_')
      ) {
        // Map the string enum to our numeric constant
        const stateKey = rawState as keyof typeof SUBSCRIPTION_STATE;
        const mappedValue = SUBSCRIPTION_STATE[stateKey];
        state =
          mappedValue !== undefined
            ? mappedValue
            : SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_UNSPECIFIED;
        logger.debug('Mapped string subscription state', {
          rawState,
          mappedState: state,
        });
      } else {
        // Fallback for numeric values (shouldn't happen with v2 API, but just in case)
        const parsed = parseInt(String(rawState), 10);
        state = isNaN(parsed)
          ? SUBSCRIPTION_STATE.SUBSCRIPTION_STATE_UNSPECIFIED
          : parsed;
        logger.debug('Parsed numeric subscription state', { rawState, parsed });
      }
    }

    // Get product ID from line items
    // Format: "productId:basePlanId" to match database Plan.productId format
    const subscriptionId = firstItem?.productId || '';
    const basePlanId = firstItem?.offerDetails?.basePlanId;
    const productId = basePlanId
      ? `${subscriptionId}:${basePlanId}`
      : subscriptionId;

    // Get latest order ID
    const orderId = subscription.latestOrderId || null;

    // Get price info
    const priceAmountMicros = 0; // Would need to look up from product
    const priceCurrencyCode = 'PHP';

    return {
      subscriptionId: `gp_${purchaseToken.substring(0, 20)}`,
      productId,
      status: this.mapStatus(state),
      startDate: startTime,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate: autoRenewEnabled ? currentPeriodEnd : currentPeriodEnd,
      cancelAtPeriodEnd: !autoRenewEnabled,
      canceledAt,
      trialStartDate: null, // Trial info would need separate handling
      trialEndDate: null,
      autoRenew: autoRenewEnabled,
      orderId,
      purchaseToken,
      priceAmountMicros,
      priceCurrencyCode,
    };
  }

  /**
   * Parse ISO 8601 duration to days
   */
  private parseDurationToDays(duration: string): number {
    // Format: P3D (3 days), P7D (7 days), etc.
    const match = duration.match(/P(\d+)D/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

// Singleton instance
let googlePlayProvider: GooglePlayProvider | null = null;

export const getGooglePlayProvider = (): GooglePlayProvider => {
  if (!googlePlayProvider) {
    googlePlayProvider = new GooglePlayProvider();
  }
  return googlePlayProvider;
};
