import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { calculateStreak } from '../utils/streak';

/** Any Prisma-like client (base, extended, or transaction). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

// ── Config types ──

interface DurationBonusTier {
  minMinutes: number;
  bonus: number;
}

interface AccuracyTier {
  min: number;
  label: string;
  multiplier: number;
}

interface EconomyConfig {
  coinsPerSet: number;
  completionBonus: number;
  durationBonuses: DurationBonusTier[];
  streakBonusPerDay: number;
  streakBonusCap: number;
  accuracyTiers: AccuracyTier[];
}

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
 * Load all economy config values from the EconomyConfig table.
 * Falls back to sensible defaults if a key is missing.
 */
export async function loadEconomyConfig(
  prisma: PrismaLike
): Promise<EconomyConfig> {
  const rows = await (prisma as PrismaClient).economyConfig.findMany();
  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  return {
    coinsPerSet: (configMap.get('COINS_PER_SET') as number) ?? 3,
    completionBonus: (configMap.get('COMPLETION_BONUS') as number) ?? 10,
    durationBonuses: (configMap.get(
      'DURATION_BONUSES'
    ) as unknown as DurationBonusTier[]) ?? [
      { minMinutes: 60, bonus: 15 },
      { minMinutes: 45, bonus: 8 },
      { minMinutes: 30, bonus: 3 },
    ],
    streakBonusPerDay: (configMap.get('STREAK_BONUS_PER_DAY') as number) ?? 2,
    streakBonusCap: (configMap.get('STREAK_BONUS_CAP') as number) ?? 20,
    accuracyTiers: (configMap.get(
      'ACCURACY_TIERS'
    ) as unknown as AccuracyTier[]) ?? [
      { min: 0.95, label: 'Perfect', multiplier: 1.7 },
      { min: 0.85, label: 'Great', multiplier: 1.3 },
      { min: 0.7, label: 'Good', multiplier: 1.0 },
      { min: 0.5, label: 'Fair', multiplier: 0.8 },
      { min: 0.0, label: 'Low', multiplier: 0.5 },
    ],
  };
}

/**
 * Resolve the accuracy tier (multiplier + label) from an average overallScore.
 * Tiers are matched top-down (first qualifying tier wins).
 */
function resolveAccuracyTier(
  avgAccuracy: number,
  tiers: AccuracyTier[]
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
  tiers: DurationBonusTier[]
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
  prisma: PrismaLike
): Promise<CoinBreakdown | null> {
  return prisma.$transaction(async (tx: PrismaLike) => {
    // ── Idempotency check ──
    const existing = await tx.coinTransaction.findFirst({
      where: {
        workoutSessionId,
        type: 'SESSION_REWARD',
      },
    });
    if (existing) {
      logger.info('Coin award already exists for session, skipping', {
        workoutSessionId,
      });
      return null;
    }

    // ── Load session ──
    const session = await tx.workoutSession.findUnique({
      where: { id: workoutSessionId },
      select: { startedAt: true, completedAt: true },
    });
    if (!session || !session.completedAt) {
      logger.warn('Session not found or not completed for coin calculation', {
        workoutSessionId,
      });
      return null;
    }

    // ── Load economy config ──
    const config = await loadEconomyConfig(tx);

    // ── Count performed sets ──
    const setsCompleted = await tx.performedSet.count({
      where: { workoutSessionId },
    });

    // ── Calculate session duration ──
    const durationMs =
      session.completedAt.getTime() - session.startedAt.getTime();
    const sessionDurationMin = Math.floor(durationMs / 60_000);

    // ── Average accuracy (overallScore from FormComparisonResult) ──
    const comparisonResults = await tx.formComparisonResult.findMany({
      where: { workoutSessionId },
      select: { overallScore: true },
    });

    let avgAccuracy = 0;
    if (comparisonResults.length > 0) {
      avgAccuracy =
        comparisonResults.reduce(
          (sum: number, r: { overallScore: number }) => sum + r.overallScore,
          0
        ) / comparisonResults.length;
    }

    // ── Resolve accuracy tier ──
    const { multiplier: accuracyMultiplier, label: accuracyLabel } =
      resolveAccuracyTier(avgAccuracy, config.accuracyTiers);

    // ── Calculate streak ──
    const streakValue = await calculateStreak(userId, session.startedAt, tx);

    // ── Apply formula ──
    const setCoins = Math.round(
      setsCompleted * config.coinsPerSet * accuracyMultiplier
    );
    const completionBonus = config.completionBonus;
    const durationBonus = resolveDurationBonus(
      sessionDurationMin,
      config.durationBonuses
    );
    const streakBonus = Math.min(
      streakValue * config.streakBonusPerDay,
      config.streakBonusCap
    );
    const total = setCoins + completionBonus + durationBonus + streakBonus;

    // ── Upsert CoinBalance ──
    const balance = await tx.coinBalance.upsert({
      where: { userId },
      create: {
        userId,
        currentBalance: total,
        lifetimeEarned: total,
        lifetimeSpent: 0,
      },
      update: {
        currentBalance: { increment: total },
        lifetimeEarned: { increment: total },
      },
    });

    // ── Create CoinTransaction ──
    const transaction = await tx.coinTransaction.create({
      data: {
        userId,
        type: 'SESSION_REWARD',
        amount: total,
        balanceAfter: balance.currentBalance,
        setCoins,
        accuracyMultiplier,
        completionBonus,
        durationBonus,
        streakBonus,
        streakValue,
        setsCompleted,
        avgAccuracy,
        sessionDurationMin,
        workoutSessionId,
      },
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
      newBalance: balance.currentBalance,
    };
  });
}
