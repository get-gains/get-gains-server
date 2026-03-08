import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { WeeklyStatsQuery, SourceStats } from '../schemas/stats.schema';

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
  try {
    const supabaseId = req.user?.id;
    const { weekOf } = (res.locals.validated?.query as WeeklyStatsQuery) || {};

    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    // Resolve app user
    const user = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
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
      userId: user.id,
      weekStart,
      weekEnd,
      isSubscribed,
    });

    // Fetch completed sessions for the week with source indicator
    const sessions = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        completedAt: { not: null },
        startedAt: { gte: weekStart, lt: weekEnd },
      },
      select: {
        startedAt: true,
        completedAt: true,
        assignedProgramId: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // Partition sessions by source
    const standaloneSessions = sessions.filter(
      (s) => s.assignedProgramId === null
    );
    const coachSessions = sessions.filter((s) => s.assignedProgramId !== null);

    // Helper: compute minutes from sessions
    const computeMinutes = (sessionList: typeof sessions): number =>
      sessionList.reduce((sum, s) => {
        if (s.completedAt) {
          const durationMs =
            new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
          return sum + Math.round(durationMs / 60000);
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

    // ── Streak Calculation (90-day lookback) ──

    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const lookbackStart = new Date(today);
    lookbackStart.setUTCDate(today.getUTCDate() - 90);
    lookbackStart.setUTCHours(0, 0, 0, 0);

    const recentSessions = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        completedAt: { not: null },
        startedAt: { gte: lookbackStart, lte: today },
      },
      select: {
        startedAt: true,
        assignedProgramId: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    // Build date sets for streak calculation
    const allDates = new Set<string>();
    const standaloneDates = new Set<string>();
    const coachDates = new Set<string>();

    for (const s of recentSessions) {
      const dateStr = s.startedAt.toISOString().slice(0, 10);
      allDates.add(dateStr);
      if (s.assignedProgramId === null) {
        standaloneDates.add(dateStr);
      } else {
        coachDates.add(dateStr);
      }
    }

    // Helper: count streak backwards from today
    const countStreak = (dates: Set<string>): number => {
      let streak = 0;
      const checkDate = new Date(today);
      checkDate.setUTCHours(0, 0, 0, 0);

      while (dates.has(checkDate.toISOString().slice(0, 10))) {
        streak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      }
      return streak;
    };

    const combinedStreak = countStreak(allDates);
    const standaloneStreak = countStreak(standaloneDates);
    const coachStreak = countStreak(coachDates);

    // Get most recently active coach program name (if subscribed)
    let coachProgramName: string | null = null;
    if (isSubscribed && coachWorkouts > 0) {
      const recentCoachSession = coachSessions[coachSessions.length - 1];
      if (recentCoachSession?.assignedProgramId) {
        const assignedProgram = await prisma.assignedProgram.findUnique({
          where: { id: recentCoachSession.assignedProgramId },
          include: { program: { select: { name: true } } },
        });
        coachProgramName = assignedProgram?.program?.name ?? null;
      }
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
  } catch (error) {
    logger.error('Error fetching unified weekly stats', error);
    sendSingleError(res, 'Failed to fetch weekly stats', 500);
  }
};
