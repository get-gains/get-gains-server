import { z } from 'zod';

// ── Coin History Query ──

export const CoinHistoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    type: z
      .enum(['SESSION_REWARD', 'SHOP_PURCHASE', 'MISSION_REWARD'])
      .optional(),
  }),
});

export type CoinHistoryQuery = z.infer<typeof CoinHistoryQuerySchema>['query'];
