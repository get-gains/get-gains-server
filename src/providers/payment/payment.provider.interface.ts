import { Provider, SubscriptionStatus, BillingCycle } from '@prisma/client';

/**
 * Normalized subscription data from any payment provider
 */
export interface NormalizedSubscription {
  subscriptionId: string;
  productId: string;
  status: SubscriptionStatus;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  autoRenew: boolean;
  orderId: string | null;
  purchaseToken: string | null;
  priceAmountMicros: number;
  priceCurrencyCode: string;
}

/**
 * Normalized plan/product data from any payment provider
 */
export interface NormalizedPlan {
  productId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingCycle: BillingCycle;
  trialPeriodDays: number | null;
  features: string[];
}

/**
 * Webhook event data
 */
export interface WebhookEventData {
  provider: Provider;
  eventType: string;
  subscriptionId: string | null;
  idempotency_key: string;
  rawPayload: unknown;
  purchaseToken?: string;
  productId?: string;
}

/**
 * Purchase verification result
 */
export interface VerifyPurchaseResult {
  isValid: boolean;
  subscription: NormalizedSubscription | null;
  errorMessage?: string;
}

/**
 * Interface for payment provider implementations
 * Allows easy addition of new providers (Apple, Stripe, etc.)
 */
export interface IPaymentProvider {
  readonly provider: Provider;

  /**
   * Verify a purchase/subscription from the client
   */
  verifyPurchase(
    productId: string,
    purchaseToken: string
  ): Promise<VerifyPurchaseResult>;

  /**
   * Acknowledge a purchase (required for some providers)
   */
  acknowledgePurchase(
    productId: string,
    purchaseToken: string
  ): Promise<boolean>;

  /**
   * Get subscription details from the provider
   */
  getSubscription(
    productId: string,
    purchaseToken: string
  ): Promise<NormalizedSubscription | null>;

  /**
   * Cancel a subscription
   */
  cancelSubscription(
    productId: string,
    purchaseToken: string
  ): Promise<boolean>;

  /**
   * Fetch all available plans/products from the provider
   */
  fetchPlans(): Promise<NormalizedPlan[]>;

  /**
   * Parse and validate webhook payload
   */
  parseWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<WebhookEventData | null>;

  /**
   * Map provider-specific status to normalized status
   */
  mapStatus(providerStatus: number | string): SubscriptionStatus;
}
