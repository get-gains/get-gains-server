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
 * Returns combined totals and per-source (standalone / coach) breakdowns.
 * Free users receive standalone stats only; subscribed users receive both.
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

  // Fetch completed sessions for the week with source indicator via relational path
  const sessions = await prisma.workout_session.findMany({
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
  });

  // Partition sessions by source
  const standaloneSessions = sessions.filter(
    (s) => s.assigned_program_routine.assigned_program.coach_id === supabaseId
  );
  const coachSessions = sessions.filter(
    (s) => s.assigned_program_routine.assigned_program.coach_id !== supabaseId
  );

  // Helper: compute minutes from sessions; guard nullable started_at
  const computeMinutes = (sessionList: typeof sessions): number =>
    sessionList.reduce((sum, s) => {
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

  // Combined totals
  const combinedWorkouts = sessions.length;
  const combinedMinutes = computeMinutes(sessions);

  // Per-source weekly stats
  const standaloneWorkouts = standaloneSessions.length;
  const standaloneMinutes = computeMinutes(standaloneSessions);
  const coachWorkouts = coachSessions.length;
  const coachMinutes = computeMinutes(coachSessions);

  // ── Streak Calculation (shared utility) ──

  const { combinedStreak, standaloneStreak, coachStreak } =
    await calculateStreaksBySource(supabaseId, new Date(), prisma);

  // Get most recently active coach program name from included data (no extra DB query)
  let coachProgramName: string | null = null;
  if (isSubscribed && coachSessions.length > 0) {
    const recent = coachSessions[coachSessions.length - 1];
    coachProgramName = recent.assigned_program_routine.assigned_program.name;
  }

  // Build sources array based on subscription status
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

  sendSuccess(res, {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10), // Sunday, not next Monday
    workoutsCompleted: effectiveWorkouts,
    totalMinutes: effectiveMinutes,
    streakDays: effectiveStreak,
    sources,
  });
};
