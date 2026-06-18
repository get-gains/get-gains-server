import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { UnauthorizedException } from '../lib/errors';
import {
  WeeklyStatsQuery,
  SourceStats,
  MonthlyInsightQuery,
} from '../schemas/stats.schema';
import { calculateStreaksBySource } from '../utils/streak';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

// ============== Unified Weekly Stats ==============

/**
 * Get unified weekly stats with per-source breakdown.
 *
 * Merges completed sessions from both the coach-assigned system
 * (`workout_session`) and the standalone system (`standalone_session`)
 * for the current week window.
 *
 * Returns combined totals and per-source (standalone / coach) breakdowns.
 * Standalone sessions are always source "standalone".
 *
 * Uses `attachSubscription` middleware (non-blocking) to determine
 * subscription status via `req.subscription.isSubscribed`.
 *
 * @route GET /api/stats/weekly
 */
export const getWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : (rawUser as AuthenticatedUser).id
    : undefined;
  const { weekOf } = (res.locals.validated?.query as WeeklyStatsQuery) || {};

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const isSubscribed = req.subscription?.isSubscribed ?? false;

  // Determine the week window (Monday–Sunday)
  const referenceDate = weekOf ? new Date(weekOf) : new Date();
  const dayOfWeek = referenceDate.getUTCDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(referenceDate);
  weekStart.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  logger.debug('Fetching unified weekly stats', {
    supabaseId,
    weekStart,
    weekEnd,
    isSubscribed,
  });

  // Fetch completed sessions for the week from both systems in parallel
  const [coachSessions, standaloneSessions] = await Promise.all([
    prisma.workout_session.findMany({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: { not: null },
        started_at: { gte: weekStart, lt: weekEnd },
      },
      select: {
        started_at: true,
        completed_at: true,
        assigned_program_routine: {
          select: {
            assigned_program: {
              select: {
                coach_id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { started_at: 'asc' },
    }),

    prisma.standalone_session.findMany({
      where: {
        user_id: supabaseId,
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: weekStart, lt: weekEnd },
      },
      select: {
        started_at: true,
        completed_at: true,
        program_routine: {
          select: {
            program: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { started_at: 'asc' },
    }),
  ]);

  // Partition coach-assigned sessions by source
  const selfAssignedCoach = coachSessions.filter(
    (s) => s.assigned_program_routine.assigned_program.coach_id === supabaseId
  );
  const coachAssignedCoach = coachSessions.filter(
    (s) => s.assigned_program_routine.assigned_program.coach_id !== supabaseId
  );

  // All standalone sessions are "standalone" source
  // Self-assigned coach sessions are also "standalone" source
  const allStandaloneSessions = [
    ...standaloneSessions.map((s) => ({
      started_at: s.started_at,
      completed_at: s.completed_at,
      programName: s.program_routine.program.name,
      type: 'standalone' as const,
    })),
    ...selfAssignedCoach.map((s) => ({
      started_at: s.started_at,
      completed_at: s.completed_at,
      programName: s.assigned_program_routine.assigned_program.name,
      type: 'standalone' as const,
    })),
  ];

  const allCoachSessions = coachAssignedCoach.map((s) => ({
    started_at: s.started_at,
    completed_at: s.completed_at,
    programName: s.assigned_program_routine.assigned_program.name,
    type: 'coach' as const,
  }));

  // Helper: compute minutes from sessions; guard nullable started_at
  const computeMinutes = (
    list: Array<{ started_at: Date | null; completed_at: Date | null }>
  ): number =>
    list.reduce((sum, s) => {
      if (s.started_at && s.completed_at) {
        return (
          sum +
          Math.round(
            (s.completed_at.getTime() - s.started_at.getTime()) / 60000
          )
        );
      }
      return sum;
    }, 0);

  // ── Session-granularity note ──
  // ALL counts below are SESSION-grained (session arrays, never set arrays).
  // The system intentionally counts completed workout sessions, not
  // individual performed sets. One session with 2 exercises × 3 sets = 1
  // workout. Audit 2026-06-18: verified correct — see
  // test/stats-weekly.test.ts.
  //
  // computeMinutes() also iterates session objects (not sets), so
  // totalMinutes, avgVolumePerSession, and Avg/Workout are all
  // session-grained.

  // Combined totals (all sessions across both systems)
  const combinedWorkouts =
    allStandaloneSessions.length + allCoachSessions.length;
  const combinedMinutes =
    computeMinutes(allStandaloneSessions) + computeMinutes(allCoachSessions);

  logger.debug('Weekly stats session counts', {
    standaloneSessions: allStandaloneSessions.length,
    coachSessions: allCoachSessions.length,
    combinedWorkouts,
  });

  // Per-source weekly stats
  const standaloneWorkouts = allStandaloneSessions.length;
  const standaloneMinutes = computeMinutes(allStandaloneSessions);
  const coachWorkouts = allCoachSessions.length;
  const coachMinutes = computeMinutes(allCoachSessions);

  // ── Streak Calculation (shared utility) ──

  const { combinedStreak, standaloneStreak, coachStreak } =
    await calculateStreaksBySource(supabaseId, new Date(), prisma);

  // Get most recently active coach program name from included data
  let coachProgramName: string | null = null;
  if (isSubscribed && allCoachSessions.length > 0) {
    coachProgramName =
      allCoachSessions[allCoachSessions.length - 1].programName;
  }

  // Build sources array
  const sources: SourceStats[] = [];

  if (standaloneWorkouts > 0) {
    sources.push({
      type: 'standalone',
      workoutsCompleted: standaloneWorkouts,
      totalMinutes: standaloneMinutes,
      streakDays: standaloneStreak,
    });
  }

  if (isSubscribed && coachWorkouts > 0) {
    sources.push({
      type: 'coach',
      workoutsCompleted: coachWorkouts,
      totalMinutes: coachMinutes,
      streakDays: coachStreak,
      programName: coachProgramName,
    });
  }

  // For free users, combined totals should reflect standalone only
  const effectiveWorkouts = isSubscribed
    ? combinedWorkouts
    : standaloneWorkouts;
  const effectiveMinutes = isSubscribed ? combinedMinutes : standaloneMinutes;
  const effectiveStreak = isSubscribed ? combinedStreak : standaloneStreak;

  const allSessions = [...allStandaloneSessions, ...allCoachSessions];
  const effectiveSessions = isSubscribed ? allSessions : allStandaloneSessions;

  sendSuccess(res, {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10),
    workoutsCompleted: effectiveWorkouts,
    totalMinutes: effectiveMinutes,
    streakDays: effectiveStreak,
    sources,
    sessionDates: effectiveSessions
      .map((s) => s.started_at?.toISOString() ?? null)
      .filter((d): d is string => d !== null),
  });
};

// ============== Monthly Insight ==============

/**
 * Get monthly training insight including avg volume/session, trend %, 6-month
 * sparkline data, and top exercise weight improvements vs previous month.
 *
 * Fetches sessions from both coach-assigned (`workout_session`) and standalone
 * (`standalone_session`) systems, then aggregates `reps × weight` from each
 * system's performed_set tables.
 *
 * @route GET /api/stats/monthly-insight?month=YYYY-MM
 */
export const getMonthlyInsight = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : (rawUser as AuthenticatedUser).id
    : undefined;

  const { month } = (res.locals.validated?.query as MonthlyInsightQuery) || {
    month: '',
  };

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  if (!month) {
    res.status(400).json({ error: 'month query param is required (YYYY-MM)' });
    return;
  }

  // Parse target month and previous month
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const targetStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const targetEnd = new Date(Date.UTC(year, monthNum, 1));

  const prevStart = new Date(Date.UTC(year, monthNum - 2, 1));
  const prevEnd = new Date(Date.UTC(year, monthNum - 1, 1));

  // Build sparkline months (last 6 months including current)
  const sparklineMonths: { start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, monthNum - 1 - i, 1));
    const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    sparklineMonths.push({ start: s, end: e });
  }

  // ── Helper: fetch sessions & volume for a date range ──
  // NOTE: session count is derived from coachIds.length + standaloneIds.length
  // (session IDs, NOT set counts), so avgVolumePerSession divides by correct
  // session count. Audit 2026-06-18.
  async function fetchVolumeForRange(
    start: Date,
    end: Date
  ): Promise<{ sessions: number; volume: number }> {
    const [coachSessions, standaloneSessions] = await Promise.all([
      prisma.workout_session.findMany({
        where: {
          assigned_program_routine: {
            assigned_program: { user_id: supabaseId },
          },
          completed_at: { not: null },
          deleted_at: null,
          started_at: { gte: start, lt: end },
        },
        select: { id: true },
      }),
      prisma.standalone_session.findMany({
        where: {
          user_id: supabaseId,
          completed_at: { not: null },
          deleted_at: null,
          started_at: { gte: start, lt: end },
        },
        select: { id: true },
      }),
    ]);

    const coachIds = coachSessions.map((s) => s.id);
    const standaloneIds = standaloneSessions.map((s) => s.id);

    const [coachSets, standaloneSets] = await Promise.all([
      coachIds.length > 0
        ? prisma.performed_set.findMany({
            where: { workout_session_id: { in: coachIds } },
            select: { reps: true, weight: true },
          })
        : ([] as { reps: number; weight: number | null }[]),
      standaloneIds.length > 0
        ? prisma.standalone_performed_set.findMany({
            where: { session_id: { in: standaloneIds } },
            select: { reps: true, weight: true },
          })
        : ([] as { reps: number; weight: number }[]),
    ]);

    const volume = [
      ...coachSets.map((s) => s.reps * (s.weight ?? 0)),
      ...standaloneSets.map((s) => s.reps * s.weight),
    ].reduce((sum, v) => sum + v, 0);

    return { sessions: coachIds.length + standaloneIds.length, volume };
  }

  // ── Fetch target month & previous month volume ──
  const [target, previous, ...sparklineResults] = await Promise.all([
    fetchVolumeForRange(targetStart, targetEnd),
    fetchVolumeForRange(prevStart, prevEnd),
    ...sparklineMonths.map((m) => fetchVolumeForRange(m.start, m.end)),
  ]);

  const avgVolumePerSession =
    target.sessions > 0 ? target.volume / target.sessions : 0;

  const previousAvg =
    previous.sessions > 0 ? previous.volume / previous.sessions : 0;

  const percentChange =
    previousAvg > 0
      ? Math.round(((avgVolumePerSession - previousAvg) / previousAvg) * 100)
      : null;

  const sparkline = sparklineResults.map((r) =>
    r.sessions > 0 ? Math.round(r.volume / r.sessions) : null
  );

  // Per-month total volume and session counts for the sparkline window
  const sparklineVolumes = sparklineResults.map(
    (r) => Math.round(r.volume * 100) / 100
  );
  const sparklineSessions = sparklineResults.map((r) => r.sessions);

  // ── Exercise improvements: compare avg weight per exercise ──
  async function getExerciseAvgWeights(
    start: Date,
    end: Date
  ): Promise<
    Map<string, { name: string; totalWeight: number; setCount: number }>
  > {
    const exerciseMap = new Map<
      string,
      { name: string; totalWeight: number; setCount: number }
    >();

    // Coach sets with exercise names via snapshot
    const coachSessions = await prisma.workout_session.findMany({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: start, lt: end },
      },
      select: { id: true },
    });

    const coachIds = coachSessions.map((s) => s.id);
    if (coachIds.length > 0) {
      const coachSets = await prisma.performed_set.findMany({
        where: { workout_session_id: { in: coachIds }, weight: { gt: 0 } },
        select: {
          reps: true,
          weight: true,
          exercise_name_snapshot: true,
          assigned_program_routine_exercise: {
            select: { exercise: { select: { name: true } } },
          },
        },
      });

      for (const ps of coachSets) {
        const name =
          ps.exercise_name_snapshot ??
          ps.assigned_program_routine_exercise?.exercise?.name ??
          'Unknown';
        const entry = exerciseMap.get(name) ?? {
          name,
          totalWeight: 0,
          setCount: 0,
        };
        entry.totalWeight += ps.weight ?? 0;
        entry.setCount += 1;
        exerciseMap.set(name, entry);
      }
    }

    // Standalone sets with exercise names
    const standaloneSessions = await prisma.standalone_session.findMany({
      where: {
        user_id: supabaseId,
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: start, lt: end },
      },
      select: { id: true },
    });

    const standaloneIds = standaloneSessions.map((s) => s.id);
    if (standaloneIds.length > 0) {
      const standaloneSets = await prisma.standalone_performed_set.findMany({
        where: { session_id: { in: standaloneIds }, weight: { gt: 0 } },
        select: {
          reps: true,
          weight: true,
          exercise: {
            select: { exercise: { select: { name: true } } },
          },
        },
      });

      for (const ps of standaloneSets) {
        const name = ps.exercise?.exercise?.name ?? 'Unknown';
        const entry = exerciseMap.get(name) ?? {
          name,
          totalWeight: 0,
          setCount: 0,
        };
        entry.totalWeight += ps.weight;
        entry.setCount += 1;
        exerciseMap.set(name, entry);
      }
    }

    return exerciseMap;
  }

  const [targetWeights, previousWeights] = await Promise.all([
    getExerciseAvgWeights(targetStart, targetEnd),
    getExerciseAvgWeights(prevStart, prevEnd),
  ]);

  const exerciseImprovements: Array<{
    exerciseName: string;
    currentAvgWeight: number;
    previousAvgWeight: number;
    percentChange: number;
  }> = [];

  for (const [name, current] of targetWeights) {
    const previous = previousWeights.get(name);
    if (!previous || previous.setCount === 0) continue;

    const currentAvg = current.totalWeight / current.setCount;
    const prevAvg = previous.totalWeight / previous.setCount;
    const pct = Math.round(((currentAvg - prevAvg) / prevAvg) * 100);

    if (pct > 0) {
      exerciseImprovements.push({
        exerciseName: name,
        currentAvgWeight: Math.round(currentAvg * 100) / 100,
        previousAvgWeight: Math.round(prevAvg * 100) / 100,
        percentChange: pct,
      });
    }
  }

  // Sort by percent change descending, take top 3
  exerciseImprovements.sort((a, b) => b.percentChange - a.percentChange);
  const topImprovements = exerciseImprovements.slice(0, 3);

  logger.debug('Monthly insight computed', {
    supabaseId,
    month,
    avgVolumePerSession,
    percentChange,
    sparkline,
    improvements: topImprovements.length,
  });

  sendSuccess(res, {
    month,
    avgVolumePerSession: Math.round(avgVolumePerSession * 100) / 100,
    percentChange,
    totalVolumeKg: Math.round(target.volume * 100) / 100,
    totalSessions: target.sessions,
    sparkline,
    sparklineVolumes,
    sparklineSessions,
    exerciseImprovements: topImprovements,
  });
};
