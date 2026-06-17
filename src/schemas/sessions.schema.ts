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
 * `source` is derived from the relational path:
 *   assigned_program.coach_id == supabaseId → "standalone"
 *   assigned_program.coach_id != supabaseId → "coach"
 * `programName` and `coachName` are resolved via joins and present only for
 * coach sessions.
 */
export const UnifiedSessionSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  routineId: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  notes: z.string().nullable(),
  totalSets: z.number().int().min(0),
  routineName: z.string(),
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

// ============== Calendar Schemas ==============

/**
 * Schema for the calendar endpoint query params.
 *
 * `month` must be in "YYYY-MM" format (e.g. "2026-06").
 */
export const SessionCalendarQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format'),
  }),
});

export type SessionCalendarQuery = z.infer<
  typeof SessionCalendarQuerySchema
>['query'];

/**
 * A single session entry in the calendar response.
 */
export const CalendarSessionSummarySchema = z.object({
  id: z.string(),
  routineName: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  totalSets: z.number().int().min(0),
  source: z.enum(['standalone', 'coach']),
});

export type CalendarSessionSummary = z.infer<
  typeof CalendarSessionSummarySchema
>;

// ============== Session Detail Schemas ==============

/**
 * Path params schema for GET /sessions/:sessionId
 */
export const SessionDetailParamsSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1),
  }),
});

export type SessionDetailParams = z.infer<
  typeof SessionDetailParamsSchema
>['params'];

/**
 * A single set in the unified session detail response.
 */
export const UnifiedSetSchema = z.object({
  id: z.string(),
  setNumber: z.number().int(),
  repsCompleted: z.number().int(),
  weightKg: z.number().nullable(),
  /** RPE (Rate of Perceived Exertion) — only available for coach sessions. */
  rpe: z.number().nullable(),
});

export type UnifiedSet = z.infer<typeof UnifiedSetSchema>;

/**
 * An exercise group in the unified session detail response.
 */
export const UnifiedExerciseGroupSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  sets: z.array(UnifiedSetSchema),
  /** Total volume for this exercise: sum(reps * weightKg) */
  totalVolumeKg: z.number(),
});

export type UnifiedExerciseGroup = z.infer<typeof UnifiedExerciseGroupSchema>;

/**
 * Full session detail response shape (unified across coach and standalone).
 */
export const UnifiedSessionDetailSchema = z.object({
  id: z.string(),
  source: z.enum(['coach', 'standalone']),
  routineName: z.string(),
  programName: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  /** Duration in minutes (server-computed). */
  durationMinutes: z.number().int().nullable(),
  notes: z.string().nullable(),
  exercises: z.array(UnifiedExerciseGroupSchema),
  totalSets: z.number().int(),
  totalReps: z.number().int(),
  /** Total volume lifted in kg across all exercises. */
  totalVolumeKg: z.number(),
});

export type UnifiedSessionDetail = z.infer<typeof UnifiedSessionDetailSchema>;
