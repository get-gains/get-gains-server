import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
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
  try {
    const userId = req.appUser!.id;

    const balance = await prisma.coinBalance.findUnique({
      where: { userId },
    });

    sendSuccess(res, {
      currentBalance: balance?.currentBalance ?? 0,
      lifetimeEarned: balance?.lifetimeEarned ?? 0,
      lifetimeSpent: balance?.lifetimeSpent ?? 0,
      updatedAt: balance?.updatedAt ?? null,
    });
  } catch (error) {
    logger.error('Error fetching coin balance', error);
    sendSingleError(res, 'Failed to fetch coin balance', 500);
  }
};

/**
 * GET /api/coins/history
 * Get the current user's coin transaction history (paginated).
 */
export const getHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { page, limit, type } = res.locals.validated
      ?.query as CoinHistoryQuery;

    const where: Record<string, unknown> = { userId };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.coinTransaction.count({ where }),
    ]);

    sendSuccess(res, {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        setCoins: t.setCoins,
        accuracyMultiplier: t.accuracyMultiplier,
        completionBonus: t.completionBonus,
        durationBonus: t.durationBonus,
        streakBonus: t.streakBonus,
        streakValue: t.streakValue,
        setsCompleted: t.setsCompleted,
        avgAccuracy: t.avgAccuracy,
        sessionDurationMin: t.sessionDurationMin,
        workoutSessionId: t.workoutSessionId,
        userCosmeticId: t.userCosmeticId,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching coin history', error);
    sendSingleError(res, 'Failed to fetch coin history', 500);
  }
};
