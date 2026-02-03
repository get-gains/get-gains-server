import { z } from 'zod';

// ============== Plan Schemas ==============

/**
 * Schema for getting available plans
 */
export const GetPlansSchema = z.object({
  query: z.object({
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
});

export type GetPlansQuery = z.infer<typeof GetPlansSchema>['query'];

// ============== Subscription Schemas ==============

/**
 * Schema for verifying a purchase
 */
export const VerifyPurchaseSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    purchaseToken: z.string().min(1, 'Purchase token is required'),
    provider: z.enum(['GOOGLE_PAY']).default('GOOGLE_PAY'),
  }),
});

export type VerifyPurchaseInput = z.infer<typeof VerifyPurchaseSchema>['body'];

/**
 * Schema for getting subscription status
 */
export const GetSubscriptionStatusSchema = z.object({
  query: z.object({
    includeHistory: z.coerce.boolean().optional().default(false),
  }),
});

export type GetSubscriptionStatusQuery = z.infer<
  typeof GetSubscriptionStatusSchema
>['query'];

/**
 * Schema for getting subscription history
 */
export const GetSubscriptionHistorySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetSubscriptionHistoryQuery = z.infer<
  typeof GetSubscriptionHistorySchema
>['query'];

// ============== Webhook Schemas ==============

/**
 * Schema for Google Play Pub/Sub webhook
 * Note: We accept any body and validate in the controller
 */
export const GooglePlayWebhookSchema = z.object({
  body: z.object({
    message: z.object({
      data: z.string(),
      messageId: z.string().optional(),
      publishTime: z.string().optional(),
    }),
    subscription: z.string().optional(),
  }),
});

export type GooglePlayWebhookInput = z.infer<
  typeof GooglePlayWebhookSchema
>['body'];
