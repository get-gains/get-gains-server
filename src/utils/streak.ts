import { PrismaClient } from '@prisma/client';

/**
 * Calculate the current streak of consecutive training days for a user.
 *
 * Walks backwards from `anchorDate`, counting how many consecutive calendar
 * days (UTC) have at least one completed workout session.
 *
 * Uses a 90-day lookback window for the DB query.
 *
 * @param userId  - The app user's ID (not supabaseId)
 * @param anchorDate - The date to start counting backwards from (usually today, or session.startedAt for coin calculations)
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

  const recentSessions = await (
    prisma as PrismaClient
  ).workout_session.findMany({
    where: {
      assigned_program_routine: {
        assigned_program: { user_id: userId },
      },
      completed_at: { not: null },
      started_at: { gte: lookbackStart, lte: anchor },
    },
    select: { started_at: true },
    orderBy: { started_at: 'desc' },
  });

  // Build a set of unique workout dates (YYYY-MM-DD in UTC)
  const workoutDates = new Set(
    recentSessions.map((s) => s.started_at!.toISOString().slice(0, 10))
  );

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

  const recentSessions = await (
    prisma as PrismaClient
  ).workout_session.findMany({
    where: {
      assigned_program_routine: {
        assigned_program: { user_id: userId },
      },
      completed_at: { not: null },
      started_at: { gte: lookbackStart, lte: anchor },
    },
    select: { started_at: true },
    orderBy: { started_at: 'desc' },
  });

  // Build date set for streak calculation
  // In the new schema every session belongs to an assigned_program_routine;
  // the standalone/coach distinction no longer exists.
  const allDates = new Set<string>();

  for (const s of recentSessions) {
    allDates.add(s.started_at!.toISOString().slice(0, 10));
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

  const combinedStreak = countStreak(allDates);

  return {
    combinedStreak,
    standaloneStreak: combinedStreak,
    coachStreak: combinedStreak,
  };
}
