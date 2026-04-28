import { PrismaClient } from '@prisma/client';
import { LEADERBOARD_WEIGHTS, LeaderboardWeights } from '../config/economy';
import { logger } from '../utils/logger';
import { calculateStreak } from '../utils/streak';
import { NotFoundException, ForbiddenException } from '../lib/errors';

// ── Types ──

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
    where: { user_id: coachId },
    include: { user: true },
  });
  if (!coach) {
    throw new NotFoundException('USER_COACH_NOT_FOUND', 'Coach not found.');
  }

  // ── Verify requesting user is subscribed to this coach ──
  const subscription = await prisma.subscribed_coach.findFirst({
    where: { user_id: requestingUserId, coach_id: coachId, ended_at: null },
  });
  if (!subscription) {
    throw new ForbiddenException(
      'FORBIDDEN',
      'You must be subscribed to this coach to view their class leaderboard.'
    );
  }

  // ── Get all active subscribers of this coach ──
  const activeSubscribers = await prisma.subscribed_coach.findMany({
    where: {
      coach_id: coachId,
      ended_at: null,
    },
    select: {
      user_id: true,
      user: {
        select: { supabase_auth_id: true, nickname: true },
      },
    },
  });

  if (activeSubscribers.length === 0) {
    return {
      coachId: coach.user_id,
      coachName: coach.user.full_name,
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

  // ── Get all assigned program IDs for this coach ──
  const assignedPrograms = await prisma.assigned_program.findMany({
    where: { coach_id: coachId, deleted_at: null },
    select: { id: true, user_id: true },
  });
  const assignedProgramIdsByUser = new Map<string, string[]>();
  for (const ap of assignedPrograms) {
    const existing = assignedProgramIdsByUser.get(ap.user_id) ?? [];
    existing.push(ap.id);
    assignedProgramIdsByUser.set(ap.user_id, existing);
  }

  // ── Load weights from static config ──
  const weights: LeaderboardWeights = LEADERBOARD_WEIGHTS;

  // ── Compute metrics for each subscriber ──
  const clientIds = activeSubscribers.map((s) => s.user_id);

  // Batch query: completed sessions for all clients in the last 90 days under this coach's programs
  const allAssignedProgramIds = assignedPrograms.map((ap) => ap.id);

  const sessions = await prisma.workout_session.findMany({
    where: {
      completed_at: { not: null },
      started_at: { gte: lookbackStart },
      assigned_program_routine: {
        assigned_program: {
          user_id: { in: clientIds },
          id: { in: allAssignedProgramIds },
        },
      },
    },
    select: {
      id: true,
      assigned_program_routine: {
        select: {
          assigned_program: { select: { user_id: true } },
        },
      },
    },
  });

  // Count sessions per user
  const sessionCountByUser = new Map<string, number>();
  const sessionIdsByUser = new Map<string, string[]>();
  for (const s of sessions) {
    const userId = s.assigned_program_routine.assigned_program.user_id;
    sessionCountByUser.set(userId, (sessionCountByUser.get(userId) ?? 0) + 1);
    const ids = sessionIdsByUser.get(userId) ?? [];
    ids.push(s.id);
    sessionIdsByUser.set(userId, ids);
  }

  // Batch query: performed_set accuracy results for all sessions
  const allSessionIds = sessions.map((s) => s.id);
  const formResults = await prisma.performed_set.findMany({
    where: {
      workout_session_id: { in: allSessionIds },
    },
    select: { workout_session_id: true, overall_score: true },
  });

  // Compute average accuracy per user
  const accuracySumByUser = new Map<string, { sum: number; count: number }>();
  const sessionToUser = new Map<string, string>();
  for (const s of sessions) {
    sessionToUser.set(
      s.id,
      s.assigned_program_routine.assigned_program.user_id
    );
  }
  for (const fr of formResults) {
    if (!fr.workout_session_id) continue;
    const userId = sessionToUser.get(fr.workout_session_id);
    if (!userId) continue;
    const acc = accuracySumByUser.get(userId) ?? { sum: 0, count: 0 };
    acc.sum += fr.overall_score / 100; // normalize 0–100 int to 0.0–1.0 float
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
    const userId = sub.user_id;
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
    coachId: coach.user_id,
    coachName: coach.user.full_name,
    entries,
    currentUserRank,
    totalClients: activeSubscribers.length,
    lastUpdated: now.toISOString(),
  };
}
