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

// ============== Monthly Insight Schemas ==============

/**
 * Schema for monthly insight endpoint (query params).
 *
 * `month` must be in "YYYY-MM" format (e.g. "2026-06").
 */
export const MonthlyInsightQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  }),
});

export type MonthlyInsightQuery = z.infer<
  typeof MonthlyInsightQuerySchema
>['query'];

/**
 * A single exercise improvement entry — comparing avg weight
 * this month vs the previous month.
 */
export const ExerciseImprovementSchema = z.object({
  exerciseName: z.string(),
  currentAvgWeight: z.number(),
  previousAvgWeight: z.number(),
  percentChange: z.number(),
});

export type ExerciseImprovement = z.infer<typeof ExerciseImprovementSchema>;

/**
 * Schema for the monthly insight response payload.
 *
 * `avgVolumePerSession` normalizes for workout frequency so the number
 * reflects training density, not just showing up more.
 * `percentChange` compares avgVolumePerSession vs the previous month.
 * `sparkline` contains avg volume/session for the last 6 months (null = no data).
 * `exerciseImprovements` lists up to 3 exercises where avg weight
 * increased most vs the previous month.
 */
export const MonthlyInsightResponseSchema = z.object({
  month: z.string(),
  avgVolumePerSession: z.number(),
  percentChange: z.number().nullable(),
  totalVolumeKg: z.number(),
  totalSessions: z.number().int().min(0),
  sparkline: z.array(z.number().nullable()).nullable(),
  // Per-month total volume and session counts for the 6-month sparkline window.
  // Same length as sparkline; index 5 is the target month.
  sparklineVolumes: z.array(z.number()).nullable(),
  sparklineSessions: z.array(z.number().int().min(0)).nullable(),
  exerciseImprovements: z.array(ExerciseImprovementSchema),
});

export type MonthlyInsightResponse = z.infer<
  typeof MonthlyInsightResponseSchema
>;
