import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { UnauthorizedException } from '../lib/errors';
import { WeeklyStatsQuery, SourceStats } from '../schemas/stats.schema';
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

  // Combined totals (all sessions across both systems)
  const combinedWorkouts =
    allStandaloneSessions.length + allCoachSessions.length;
  const combinedMinutes =
    computeMinutes(allStandaloneSessions) + computeMinutes(allCoachSessions);

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
