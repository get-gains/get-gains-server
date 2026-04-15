import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { SubscriptionStatus } from '@prisma/client';
import { GetClassQuery, RemoveClientParams } from '../schemas/class.schema';

/**
 * Get coach's class (client roster)
 */
export const getClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { limit, offset } = res.locals.validated?.query as GetClassQuery;
    const take = Math.min(Math.max(1, limit), 100);
    const skip = Math.max(0, offset);

    logger.debug('Fetching coach class', {
      coachId: coach.user_id,
      limit: take,
      offset: skip,
    });

    const [clientRelations, total] = await Promise.all([
      prisma.subscribed_coach.findMany({
        where: {
          coach_id: coach.user_id,
          ended_at: null,
        },
        include: {
          user: {
            select: {
              supabase_auth_id: true,
              email: true,
              full_name: true,
              nickname: true,
              subscriptions: {
                where: {
                  status: {
                    in: [
                      SubscriptionStatus.ACTIVE,
                      SubscriptionStatus.PAST_DUE,
                    ],
                  },
                },
                select: { current_period_end: true },
                orderBy: { current_period_end: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { started_at: 'desc' },
        take,
        skip,
      }),
      prisma.subscribed_coach.count({
        where: {
          coach_id: coach.user_id,
          ended_at: null,
        },
      }),
    ]);

    const clients = clientRelations.map((cr) => ({
      id: cr.user.supabase_auth_id,
      email: cr.user.email,
      name: cr.user.full_name,
      nickname: cr.user.nickname,
      subscribedAt: cr.started_at,
      subscriptionExpiresAt:
        cr.user.subscriptions[0]?.current_period_end ?? null,
    }));

    sendSuccess(res, {
      clients,
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + clients.length < total,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching coach class', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch class', 500);
  }
};

/**
 * Remove client from coach's class
 */
export const removeClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId } = res.locals.validated?.params as RemoveClientParams;

    const subscription = await prisma.subscribed_coach.findFirst({
      where: {
        user_id: userId,
        coach_id: coach.user_id,
      },
    });

    if (!subscription) {
      sendSingleError(res, 'Client not in class', 404, 'userId');
      return;
    }

    if (subscription.ended_at) {
      sendSingleError(res, 'Client already removed from class', 409, 'userId');
      return;
    }

    await prisma.subscribed_coach.update({
      where: { id: subscription.id },
      data: { ended_at: new Date() },
    });

    sendSuccess(res, { message: 'Client removed from class' });
  } catch (error) {
    logger.error('Error removing client from class', error);
    sendSingleError(res, 'Failed to remove client', 500);
  }
};
