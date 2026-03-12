import { z } from 'zod';

// ============== Session History Schemas ==============

/**
 * Schema for getting unified session history (query params).
 *
 * `source` filters by workout source: "standalone", "coach", or "all".
 * `limit` and `offset` control pagination (max 50 per page).
 */
export const SessionHistoryQuerySchema = z.object({
  query: z.object({
    source: z.enum(['standalone', 'coach', 'all']).default('all'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

export type SessionHistoryQuery = z.infer<
  typeof SessionHistoryQuerySchema
>['query'];

// ============== Response Schemas ==============

/**
 * Schema for a single session in the unified history response.
 *
 * `source` is derived from `assignedProgramId IS NULL` (standalone) vs
 * `IS NOT NULL` (coach). `programName` and `coachName` are resolved via
 * joins and present only for coach sessions.
 */
export const UnifiedSessionSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  assignedProgramId: z.string().nullable(),
  routineId: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  notes: z.string().nullable(),
  totalSets: z.number().int().min(0),
  routineName: z.string().nullable(),
  source: z.enum(['standalone', 'coach']),
  programName: z.string().nullable(),
  coachName: z.string().nullable(),
});

export type UnifiedSessionSummary = z.infer<typeof UnifiedSessionSummarySchema>;

/**
 * Schema for the paginated session history response.
 */
export const UnifiedSessionHistoryResponseSchema = z.object({
  sessions: z.array(UnifiedSessionSummarySchema),
  pagination: z.object({
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  }),
});

export type UnifiedSessionHistoryResponse = z.infer<
  typeof UnifiedSessionHistoryResponseSchema
>;
