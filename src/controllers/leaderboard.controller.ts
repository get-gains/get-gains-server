import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { ClassLeaderboardParams } from '../schemas/leaderboard.schema';
import { ClassLeaderboardQuery } from '../schemas/leaderboard.schema';
import {
  computeClassLeaderboard,
  LeaderboardError,
} from '../services/leaderboard.service';

/**
 * GET /api/leaderboard/class/:coachId
 *
 * Get the class leaderboard for a specific coach.
 * Requires the requesting user to have an active subscription to the coach.
 */
export const getClassLeaderboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;
    const { coachId } = res.locals.validated?.params as ClassLeaderboardParams;
    const { limit } = res.locals.validated?.query as ClassLeaderboardQuery;

    const result = await computeClassLeaderboard(
      userId,
      coachId,
      limit,
      prisma
    );

    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof LeaderboardError) {
      sendSingleError(res, error.message, error.statusCode);
      return;
    }
    logger.error('Error fetching class leaderboard', error);
    sendSingleError(res, 'Failed to fetch class leaderboard', 500);
  }
};

/**
 * GET /api/leaderboard/my-coaches
 *
 * Get a list of coaches the current user is subscribed to.
 * Used for the leaderboard coach picker.
 */
export const getMyCoaches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;

    // Get all active coach subscriptions for this user
    const subscriptions = await prisma.subscribed_coach.findMany({
      where: {
        user_id: userId,
        ended_at: null,
      },
      select: {
        coach_id: true,
        coach: {
          select: {
            user_id: true,
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    });

    // For each coach, count active clients
    const coaches = await Promise.all(
      subscriptions.map(async (sub) => {
        const clientCount = await prisma.subscribed_coach.count({
          where: {
            coach_id: sub.coach_id,
            ended_at: null,
          },
        });

        return {
          coachId: sub.coach_id,
          coachName: sub.coach.user.full_name,
          clientCount,
        };
      })
    );

    sendSuccess(res, { coaches });
  } catch (error) {
    logger.error('Error fetching user coaches for leaderboard', error);
    sendSingleError(res, 'Failed to fetch coaches', 500);
  }
};
