import { z } from 'zod';

// ============== Unified Today Schema ==============

/**
 * Schema for unified home today status.
 *
 * Endpoint: GET /api/today
 * No params/body are required.
 */
export const GetTodayStatusSchema = z.object({
  query: z.object({}),
});

export type GetTodayStatusQuery = z.infer<typeof GetTodayStatusSchema>['query'];
