import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { calculateStreak } from '../utils/streak';

// ── Types ──

interface LeaderboardWeights {
  sessions: number;
  streak: number;
  accuracy: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  rank: number;
  sessionsCompleted: number;
  streakDays: number;
  avgAccuracy: number;
  compositeScore: number;
  isCurrentUser: boolean;
}

export interface ClassLeaderboardResult {
  coachId: string;
  coachName: string;
  entries: LeaderboardEntry[];
  currentUserRank: number | null;
  totalClients: number;
  lastUpdated: string;
}

// ── Default weights (used if LEADERBOARD_WEIGHTS not in EconomyConfig) ──

const DEFAULT_WEIGHTS: LeaderboardWeights = {
  sessions: 1,
  streak: 1,
  accuracy: 1,
};

/**
 * Load leaderboard weights from EconomyConfig.
 * Falls back to equal weighting (1:1:1) if not configured.
 */
async function loadLeaderboardWeights(
  prisma:
    | PrismaClient
    | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
): Promise<LeaderboardWeights> {
  try {
    const row = await (prisma as PrismaClient).economyConfig.findUnique({
      where: { key: 'LEADERBOARD_WEIGHTS' },
    });
    if (row && row.value && typeof row.value === 'object') {
      const val = row.value as Record<string, unknown>;
      return {
        sessions:
          typeof val.sessions === 'number'
            ? val.sessions
            : DEFAULT_WEIGHTS.sessions,
        streak:
          typeof val.streak === 'number' ? val.streak : DEFAULT_WEIGHTS.streak,
        accuracy:
          typeof val.accuracy === 'number'
            ? val.accuracy
            : DEFAULT_WEIGHTS.accuracy,
      };
    }
  } catch (error) {
    logger.warn('Failed to load LEADERBOARD_WEIGHTS, using defaults', {
      error,
    });
  }
  return DEFAULT_WEIGHTS;
}

/**
 * Compute the class leaderboard for a specific coach.
 *
 * Steps:
 * 1. Verify the requesting user is subscribed to the coach
 * 2. Get all active subscribers (clients) of the coach
 * 3. For each client, compute metrics (sessions, streak, accuracy) over the last 90 days
 * 4. Normalize each metric (0–100)
 * 5. Calculate weighted composite score
 * 6. Sort DESC and assign ranks
 */
export async function computeClassLeaderboard(
  requestingUserId: string,
  coachId: string,
  limit: number,
  prisma: PrismaClient
): Promise<ClassLeaderboardResult> {
  const now = new Date();

  // ── Load coach info ──
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { id: true, name: true },
  });
  if (!coach) {
    throw new LeaderboardError('Coach not found.', 404);
  }

  // ── Verify requesting user is subscribed to this coach ──
  const subscription = await prisma.subscribedCoach.findUnique({
    where: {
      userId_coachId: { userId: requestingUserId, coachId },
    },
  });
  if (!subscription || subscription.endedAt !== null) {
    throw new LeaderboardError(
      'You must be subscribed to this coach to view their class leaderboard.',
      403
    );
  }

  // ── Get all active subscribers of this coach ──
  const activeSubscribers = await prisma.subscribedCoach.findMany({
    where: {
      coachId,
      endedAt: null,
    },
    select: {
      userId: true,
      user: {
        select: { id: true, nickname: true },
      },
    },
  });

  if (activeSubscribers.length === 0) {
    return {
      coachId: coach.id,
      coachName: coach.name,
      entries: [],
      currentUserRank: null,
      totalClients: 0,
      lastUpdated: now.toISOString(),
    };
  }

  // ── 90-day lookback window ──
  const lookbackStart = new Date(now);
  lookbackStart.setUTCDate(now.getUTCDate() - 90);
  lookbackStart.setUTCHours(0, 0, 0, 0);

  // ── Get coach's program IDs (for scoping sessions to this coach) ──
  const coachPrograms = await prisma.program.findMany({
    where: { coachId },
    select: { id: true },
  });
  const coachProgramIds = coachPrograms.map((p) => p.id);

  // ── Get all assigned program IDs for coach's programs ──
  const assignedPrograms = await prisma.assignedProgram.findMany({
    where: { programId: { in: coachProgramIds } },
    select: { id: true, userId: true },
  });
  const assignedProgramIdsByUser = new Map<string, string[]>();
  for (const ap of assignedPrograms) {
    const existing = assignedProgramIdsByUser.get(ap.userId) ?? [];
    existing.push(ap.id);
    assignedProgramIdsByUser.set(ap.userId, existing);
  }

  // ── Load weights ──
  const weights = await loadLeaderboardWeights(prisma);

  // ── Compute metrics for each subscriber ──
  const clientIds = activeSubscribers.map((s) => s.userId);

  // Batch query: completed sessions for all clients in the last 90 days under this coach's programs
  const allAssignedProgramIds = assignedPrograms.map((ap) => ap.id);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: { in: clientIds },
      completedAt: { not: null },
      startedAt: { gte: lookbackStart },
      assignedProgramId: { in: allAssignedProgramIds },
    },
    select: { id: true, userId: true },
  });

  // Count sessions per user
  const sessionCountByUser = new Map<string, number>();
  const sessionIdsByUser = new Map<string, string[]>();
  for (const s of sessions) {
    sessionCountByUser.set(
      s.userId,
      (sessionCountByUser.get(s.userId) ?? 0) + 1
    );
    const ids = sessionIdsByUser.get(s.userId) ?? [];
    ids.push(s.id);
    sessionIdsByUser.set(s.userId, ids);
  }

  // Batch query: form comparison results for all sessions
  const allSessionIds = sessions.map((s) => s.id);
  const formResults = await prisma.formComparisonResult.findMany({
    where: {
      workoutSessionId: { in: allSessionIds },
    },
    select: { workoutSessionId: true, overallScore: true },
  });

  // Compute average accuracy per user
  const accuracySumByUser = new Map<string, { sum: number; count: number }>();
  const sessionToUser = new Map<string, string>();
  for (const s of sessions) {
    sessionToUser.set(s.id, s.userId);
  }
  for (const fr of formResults) {
    if (!fr.workoutSessionId) continue;
    const userId = sessionToUser.get(fr.workoutSessionId);
    if (!userId) continue;
    const acc = accuracySumByUser.get(userId) ?? { sum: 0, count: 0 };
    acc.sum += fr.overallScore;
    acc.count += 1;
    accuracySumByUser.set(userId, acc);
  }

  // ── Compute streaks (must be done per-user; uses existing utility) ──
  const streakByUser = new Map<string, number>();
  await Promise.all(
    clientIds.map(async (userId) => {
      const streak = await calculateStreak(userId, now, prisma);
      streakByUser.set(userId, streak);
    })
  );

  // ── Find max sessions in class for normalization ──
  const maxSessions = Math.max(1, ...Array.from(sessionCountByUser.values()));

  // ── Build raw entries ──
  const rawEntries: {
    userId: string;
    displayName: string;
    sessionsCompleted: number;
    streakDays: number;
    avgAccuracy: number;
    compositeScore: number;
  }[] = [];

  for (const sub of activeSubscribers) {
    const userId = sub.userId;
    const sessionsCompleted = sessionCountByUser.get(userId) ?? 0;
    const streakDays = streakByUser.get(userId) ?? 0;

    const accData = accuracySumByUser.get(userId);
    const avgAccuracy =
      accData && accData.count > 0 ? accData.sum / accData.count : 0;

    // Normalize each metric (0–100)
    const sessionsScore = Math.min(sessionsCompleted / maxSessions, 1.0) * 100;
    const streakScore = Math.min(streakDays / 10, 1.0) * 100;
    const accuracyScore = avgAccuracy * 100;

    // Weighted composite score
    const totalWeight = weights.sessions + weights.streak + weights.accuracy;
    const compositeScore =
      totalWeight > 0
        ? (weights.sessions * sessionsScore +
            weights.streak * streakScore +
            weights.accuracy * accuracyScore) /
          totalWeight
        : 0;

    // Privacy: use nickname, fallback to anonymized ID
    const displayName =
      sub.user.nickname || `Athlete ${userId.substring(0, 6)}`;

    rawEntries.push({
      userId,
      displayName,
      sessionsCompleted,
      streakDays,
      avgAccuracy: Math.round(avgAccuracy * 1000) / 1000, // 3 decimal places
      compositeScore: Math.round(compositeScore * 10) / 10, // 1 decimal place
    });
  }

  // ── Sort by compositeScore DESC and assign ranks ──
  rawEntries.sort((a, b) => b.compositeScore - a.compositeScore);

  let currentUserRank: number | null = null;
  const entries: LeaderboardEntry[] = rawEntries
    .slice(0, limit)
    .map((entry, index) => {
      const rank = index + 1;
      const isCurrentUser = entry.userId === requestingUserId;
      if (isCurrentUser) {
        currentUserRank = rank;
      }
      return {
        userId: entry.userId,
        displayName: entry.displayName,
        rank,
        sessionsCompleted: entry.sessionsCompleted,
        streakDays: entry.streakDays,
        avgAccuracy: entry.avgAccuracy,
        compositeScore: entry.compositeScore,
        isCurrentUser,
      };
    });

  // If user wasn't in the visible entries, find their rank in full list
  if (currentUserRank === null) {
    const fullRankIndex = rawEntries.findIndex(
      (e) => e.userId === requestingUserId
    );
    if (fullRankIndex >= 0) {
      currentUserRank = fullRankIndex + 1;
    }
  }

  logger.info('Computed class leaderboard', {
    coachId,
    totalClients: activeSubscribers.length,
    entriesReturned: entries.length,
  });

  return {
    coachId: coach.id,
    coachName: coach.name,
    entries,
    currentUserRank,
    totalClients: activeSubscribers.length,
    lastUpdated: now.toISOString(),
  };
}

// ── Error class for leaderboard-specific errors ──

export class LeaderboardError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'LeaderboardError';
    this.statusCode = statusCode;
  }
}
