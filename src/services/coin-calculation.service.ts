import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { calculateStreak } from '../utils/streak';
import {
  COINS_PER_SET,
  COMPLETION_BONUS,
  DURATION_BONUSES,
  STREAK_BONUS_PER_DAY,
  STREAK_BONUS_CAP,
  ACCURACY_TIERS,
  DurationBonusTier,
  AccuracyTier,
} from '../config/economy';

// ── Coin breakdown result ──

export interface CoinBreakdown {
  transactionId: string;
  total: number;
  breakdown: {
    setCoins: number;
    accuracyMultiplier: number;
    accuracyLabel: string;
    completionBonus: number;
    durationBonus: number;
    streakBonus: number;
    streakValue: number;
    setsCompleted: number;
    avgAccuracy: number;
    sessionDurationMin: number;
  };
  newBalance: number;
}

/**
 * Resolve the accuracy tier (multiplier + label) from an average overallScore.
 * Tiers are matched top-down (first qualifying tier wins).
 */
function resolveAccuracyTier(
  avgAccuracy: number,
  tiers: readonly AccuracyTier[]
): { multiplier: number; label: string } {
  // Sort descending by min to ensure top-down matching
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  for (const tier of sorted) {
    if (avgAccuracy >= tier.min) {
      return { multiplier: tier.multiplier, label: tier.label };
    }
  }
  // Fallback (should never happen if 0.0 tier exists)
  return { multiplier: 0.5, label: 'Low' };
}

/**
 * Resolve the duration bonus from session length in minutes.
 * Tiers are matched top-down (first qualifying tier wins).
 */
function resolveDurationBonus(
  durationMin: number,
  tiers: readonly DurationBonusTier[]
): number {
  // Sort descending by minMinutes
  const sorted = [...tiers].sort((a, b) => b.minMinutes - a.minMinutes);
  for (const tier of sorted) {
    if (durationMin >= tier.minMinutes) {
      return tier.bonus;
    }
  }
  return 0;
}

/**
 * Calculate session coins and persist the transaction + balance update.
 *
 * Formula: (sets × COINS_PER_SET × accuracyMultiplier) + completionBonus + durationBonus + streakBonus
 *
 * Idempotent: if a SESSION_REWARD transaction already exists for this workoutSessionId, returns null.
 */
export async function calculateSessionCoins(
  userId: string,
  workoutSessionId: string,
  prisma: PrismaClient
): Promise<CoinBreakdown | null> {
  return prisma.$transaction(async (tx) => {
    // ── Idempotency check ──
    const existing = await tx.coin_transactions.findFirst({
      where: {
        workout_session_id: workoutSessionId,
        transaction_type: 'SESSION_REWARD',
      },
    });
    if (existing) {
      logger.info('Coin award already exists for session, skipping', {
        workoutSessionId,
      });
      return null;
    }

    // ── Load session ──
    const session = await tx.workout_session.findUnique({
      where: { id: workoutSessionId },
      select: { started_at: true, completed_at: true },
    });
    if (!session || !session.completed_at || !session.started_at) {
      logger.warn('Session not found or not completed for coin calculation', {
        workoutSessionId,
      });
      return null;
    }

    // ── Load performed sets ──
    const performedSets = await tx.performed_set.findMany({
      where: { workout_session_id: workoutSessionId },
      select: { overall_score: true },
    });

    const setsCompleted = performedSets.length;

    // ── Calculate session duration ──
    const durationMs =
      session.completed_at.getTime() - session.started_at.getTime();
    const sessionDurationMin = Math.floor(durationMs / 60_000);

    // ── Average accuracy (overall_score is 0-100 int; tiers use 0.0-1.0 float) ──
    let avgAccuracy = 0;
    if (performedSets.length > 0) {
      avgAccuracy =
        performedSets.reduce((sum, s) => sum + s.overall_score, 0) /
        performedSets.length /
        100;
    }

    // ── Resolve accuracy tier ──
    const { multiplier: accuracyMultiplier, label: accuracyLabel } =
      resolveAccuracyTier(avgAccuracy, ACCURACY_TIERS);

    // ── Calculate streak ──
    const streakValue = await calculateStreak(userId, session.started_at, tx);

    // ── Apply formula ──
    const setCoins = Math.round(
      setsCompleted * COINS_PER_SET * accuracyMultiplier
    );
    const completionBonus = COMPLETION_BONUS;
    const durationBonus = resolveDurationBonus(
      sessionDurationMin,
      DURATION_BONUSES
    );
    const streakBonus = Math.min(
      streakValue * STREAK_BONUS_PER_DAY,
      STREAK_BONUS_CAP
    );
    const total = setCoins + completionBonus + durationBonus + streakBonus;

    // ── Lock the user row and read current balance ──
    const [userRow] = await tx.$queryRaw<Array<{ coin_balance: number }>>`
      SELECT coin_balance FROM "user" WHERE supabase_auth_id = ${userId} FOR UPDATE
    `;
    if (!userRow) {
      logger.warn('User not found for coin calculation', { userId });
      return null;
    }

    // ── Overspend guard (application-level) ──
    if (total < 0 && userRow.coin_balance + total < 0) {
      logger.warn('Coin spend would result in negative balance, rejecting', {
        userId,
        total,
      });
      return null;
    }

    const newBalance = userRow.coin_balance + total;

    // ── Create transaction record first (with computed balance_after) ──
    const transaction = await tx.coin_transactions.create({
      data: {
        user_id: userId,
        transaction_type: 'SESSION_REWARD',
        value: total,
        balance_after: newBalance,
        set_coins: setCoins,
        accuracy_multiplier: accuracyMultiplier,
        completion_bonus: completionBonus,
        duration_bonus: durationBonus,
        streak_bonus: streakBonus,
        streak_value: streakValue,
        sets_completed: setsCompleted,
        avg_accuracy: avgAccuracy,
        session_duration_min: sessionDurationMin,
        workout_session_id: workoutSessionId,
      },
    });

    // ── Update user balance atomically ──
    await tx.user.update({
      where: { supabase_auth_id: userId },
      data: { coin_balance: newBalance },
    });

    logger.info('Coins awarded for session', {
      userId,
      workoutSessionId,
      total,
      transactionId: transaction.id,
    });

    return {
      transactionId: transaction.id,
      total,
      breakdown: {
        setCoins,
        accuracyMultiplier,
        accuracyLabel,
        completionBonus,
        durationBonus,
        streakBonus,
        streakValue,
        setsCompleted,
        avgAccuracy,
        sessionDurationMin,
      },
      newBalance,
    };
  });
}
