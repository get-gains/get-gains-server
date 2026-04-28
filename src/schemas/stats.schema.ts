import { z } from 'zod';

// ============== Weekly Stats Schemas ==============

/**
 * Schema for getting unified weekly stats (query params).
 *
 * `weekOf` is an optional ISO date string; the server normalizes it
 * to the containing Monday–Sunday week.
 */
export const WeeklyStatsQuerySchema = z.object({
  query: z.object({
    weekOf: z.coerce.date().optional(),
  }),
});

export type WeeklyStatsQuery = z.infer<typeof WeeklyStatsQuerySchema>['query'];

// ============== Response Schemas ==============

/**
 * Schema for a per-source stats breakdown entry.
 *
 * `type` is "standalone" or "coach".
 * `programName` is present only for coach sources.
 */
export const SourceStatsSchema = z.object({
  type: z.enum(['standalone', 'coach']),
  workoutsCompleted: z.number().int().min(0),
  totalMinutes: z.number().int().min(0),
  streakDays: z.number().int().min(0),
  programName: z.string().nullable().optional(),
});

export type SourceStats = z.infer<typeof SourceStatsSchema>;

/**
 * Schema for the unified weekly stats response payload.
 *
 * Top-level fields are combined totals across all sources.
 * `sources` contains per-source breakdowns (standalone, coach).
 */
export const UnifiedWeeklyStatsResponseSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  workoutsCompleted: z.number().int().min(0),
  totalMinutes: z.number().int().min(0),
  streakDays: z.number().int().min(0),
  sources: z.array(SourceStatsSchema),
  /** ISO-8601 UTC timestamps of each completed session's started_at this week. */
  sessionDates: z.array(z.string()),
});

export type UnifiedWeeklyStatsResponse = z.infer<
  typeof UnifiedWeeklyStatsResponseSchema
>;
