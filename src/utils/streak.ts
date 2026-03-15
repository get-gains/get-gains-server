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

  const recentSessions = await (prisma as PrismaClient).workoutSession.findMany(
    {
      where: {
        userId,
        completedAt: { not: null },
        startedAt: { gte: lookbackStart, lte: anchor },
      },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
    }
  );

  // Build a set of unique workout dates (YYYY-MM-DD in UTC)
  const workoutDates = new Set(
    recentSessions.map((s) => s.startedAt.toISOString().slice(0, 10))
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

  const recentSessions = await (prisma as PrismaClient).workoutSession.findMany(
    {
      where: {
        userId,
        completedAt: { not: null },
        startedAt: { gte: lookbackStart, lte: anchor },
      },
      select: {
        startedAt: true,
        assignedProgramId: true,
      },
      orderBy: { startedAt: 'desc' },
    }
  );

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
