import { PrismaClient } from '@prisma/client';

/**
 * Calculate the current streak of consecutive training days for a user.
 *
 * Walks backwards from `anchorDate`, counting how many consecutive calendar
 * days (UTC) have at least one completed workout session across both the
 * coach-assigned system (`workout_session`) and the standalone system
 * (`standalone_session`).
 *
 * Uses a 90-day lookback window for the DB queries.
 *
 * @param userId  - The user's supabase_auth_id
 * @param anchorDate - The date to start counting backwards from (usually today)
 * @param prisma  - Prisma client instance (or transaction client)
 * @returns The number of consecutive training days ending on or before anchorDate
 */
export async function calculateStreak(
  userId: string,
  anchorDate: Date,
  prisma:
    | PrismaClient
    | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
): Promise<number> {
  const anchor = new Date(anchorDate);
  anchor.setUTCHours(23, 59, 59, 999);

  const lookbackStart = new Date(anchor);
  lookbackStart.setUTCDate(anchor.getUTCDate() - 90);
  lookbackStart.setUTCHours(0, 0, 0, 0);

  // Query both systems in parallel for the lookback window
  const [coachSessions, standaloneSessions] = await Promise.all([
    (prisma as PrismaClient).workout_session.findMany({
      where: {
        assigned_program_routine: {
          assigned_program: { user_id: userId },
        },
        completed_at: { not: null },
        started_at: { gte: lookbackStart, lte: anchor },
      },
      select: { started_at: true },
      orderBy: { started_at: 'desc' },
    }),
    (prisma as PrismaClient).standalone_session.findMany({
      where: {
        user_id: userId,
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: lookbackStart, lte: anchor },
      },
      select: { started_at: true },
      orderBy: { started_at: 'desc' },
    }),
  ]);

  // Build a set of unique workout dates (YYYY-MM-DD in UTC)
  const workoutDates = new Set<string>();
  for (const s of coachSessions) {
    workoutDates.add(s.started_at!.toISOString().slice(0, 10));
  }
  for (const s of standaloneSessions) {
    workoutDates.add(s.started_at.toISOString().slice(0, 10));
  }

  // Count streak backwards from anchor date
  let streak = 0;
  const checkDate = new Date(anchor);
  checkDate.setUTCHours(0, 0, 0, 0);

  while (workoutDates.has(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }

  return streak;
}

/**
 * Calculate streaks partitioned by source (standalone, coach, combined).
 *
 * Merges data from both `workout_session` and `standalone_session` tables.
 *
 * - `combinedStreak`: all completed sessions across both systems
 * - `standaloneStreak`: standalone sessions + self-assigned coach sessions
 * - `coachStreak`: coach-assigned sessions only (coach_id != supabaseId)
 *
 * Used by the unified weekly stats endpoint which needs per-source breakdowns.
 *
 * @returns Object with combinedStreak, standaloneStreak, coachStreak
 */
export async function calculateStreaksBySource(
  userId: string,
  anchorDate: Date,
  prisma:
    | PrismaClient
    | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
): Promise<{
  combinedStreak: number;
  standaloneStreak: number;
  coachStreak: number;
}> {
  const anchor = new Date(anchorDate);
  anchor.setUTCHours(23, 59, 59, 999);

  const lookbackStart = new Date(anchor);
  lookbackStart.setUTCDate(anchor.getUTCDate() - 90);
  lookbackStart.setUTCHours(0, 0, 0, 0);

  // Query coach-assigned sessions with coach_id for source partitioning
  const [coachSessions, standaloneSessions] = await Promise.all([
    (prisma as PrismaClient).workout_session.findMany({
      where: {
        assigned_program_routine: {
          assigned_program: { user_id: userId },
        },
        completed_at: { not: null },
        started_at: { gte: lookbackStart, lte: anchor },
      },
      select: {
        started_at: true,
        assigned_program_routine: {
          select: {
            assigned_program: {
              select: { coach_id: true },
            },
          },
        },
      },
      orderBy: { started_at: 'desc' },
    }),

    (prisma as PrismaClient).standalone_session.findMany({
      where: {
        user_id: userId,
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: lookbackStart, lte: anchor },
      },
      select: { started_at: true },
      orderBy: { started_at: 'desc' },
    }),
  ]);

  // Build date sets for each source
  const allDates = new Set<string>();
  const standaloneDates = new Set<string>();
  const coachDates = new Set<string>();

  for (const s of coachSessions) {
    const date = s.started_at!.toISOString().slice(0, 10);
    allDates.add(date);

    const isCoach =
      s.assigned_program_routine.assigned_program.coach_id !== userId;
    if (isCoach) {
      coachDates.add(date);
    } else {
      standaloneDates.add(date);
    }
  }

  for (const s of standaloneSessions) {
    const date = s.started_at.toISOString().slice(0, 10);
    allDates.add(date);
    standaloneDates.add(date);
  }

  // Count streak backwards from anchor date
  const countStreak = (dates: Set<string>): number => {
    let streak = 0;
    const checkDate = new Date(anchor);
    checkDate.setUTCHours(0, 0, 0, 0);

    while (dates.has(checkDate.toISOString().slice(0, 10))) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }
    return streak;
  };

  return {
    combinedStreak: countStreak(allDates),
    standaloneStreak: countStreak(standaloneDates),
    coachStreak: countStreak(coachDates),
  };
}
