import { z } from 'zod';

// ============== Subscription Schemas ==============

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
