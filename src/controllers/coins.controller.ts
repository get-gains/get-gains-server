import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { CoinHistoryQuery } from '../schemas/coins.schema';
import {
  calculateSessionCoins,
  CoinBreakdown,
} from '../services/coin-calculation.service';

/**
 * Award coins for a completed workout session.
 * Called internally from workout/standalone session completion — not a public endpoint.
 *
 * Returns the CoinBreakdown or null if already awarded (idempotent).
 */
export async function awardSessionCoins(
  userId: string,
  workoutSessionId: string
): Promise<CoinBreakdown | null> {
  try {
    return await calculateSessionCoins(userId, workoutSessionId, prisma);
  } catch (error) {
    logger.error('Error awarding session coins', {
      userId,
      workoutSessionId,
      error,
    });
    return null;
  }
}

/**
 * GET /api/coins/balance
 * Get the current user's coin balance.
 */
export const getBalance = async (
  req: Request,
  res: Response
): Promise<void> => {
  sendSuccess(res, {
    currentBalance: req.appUser!.coin_balance,
  });
};

/**
 * GET /api/coins/history
 * Get the current user's coin transaction history (paginated).
 */
export const getHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const { page, limit, type } = res.locals.validated?.query as CoinHistoryQuery;

  const where: Record<string, unknown> = { user_id: userId };
  if (type) {
    where.transaction_type = type;
  }

  const [transactions, total] = await Promise.all([
    prisma.coin_transactions.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.coin_transactions.count({ where }),
  ]);

  sendSuccess(res, {
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.transaction_type,
      amount: t.value,
      balanceAfter: t.balance_after,
      setCoins: t.set_coins,
      accuracyMultiplier: t.accuracy_multiplier,
      completionBonus: t.completion_bonus,
      durationBonus: t.duration_bonus,
      streakBonus: t.streak_bonus,
      streakValue: t.streak_value,
      setsCompleted: t.sets_completed,
      avgAccuracy: t.avg_accuracy,
      sessionDurationMin: t.session_duration_min,
      workoutSessionId: t.workout_session_id,
      createdAt: t.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};
