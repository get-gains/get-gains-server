import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { RemoveClientParams } from '../schemas/class.schema';
import { SubscriptionStatus } from '@prisma/client';

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

    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const take = Math.min(Math.max(1, limit), 100);
    const skip = Math.max(0, offset);

    logger.debug('Fetching coach class', {
      coachId: coach.id,
      limit: take,
      offset: skip,
    });

    const [clientRelations, total] = await Promise.all([
      prisma.subscribedCoach.findMany({
        where: {
          coachId: coach.id,
          endedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
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
                select: { currentPeriodEnd: true },
                orderBy: { currentPeriodEnd: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
      }),
      prisma.subscribedCoach.count({
        where: {
          coachId: coach.id,
          endedAt: null,
        },
      }),
    ]);

    const clients = clientRelations.map((cr) => ({
      id: cr.user.id,
      email: cr.user.email,
      name: cr.user.name,
      nickname: cr.user.nickname,
      subscribedAt: cr.startedAt,
      subscriptionExpiresAt: cr.user.subscriptions[0]?.currentPeriodEnd ?? null,
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

    const { userId } = req.params as unknown as RemoveClientParams;

    const subscription = await prisma.subscribedCoach.findUnique({
      where: {
        userId_coachId: { userId, coachId: coach.id },
      },
    });

    if (!subscription) {
      sendSingleError(res, 'Client not in class', 404, 'userId');
      return;
    }

    if (subscription.endedAt) {
      sendSingleError(res, 'Client already removed from class', 409, 'userId');
      return;
    }

    await prisma.subscribedCoach.update({
      where: { id: subscription.id },
      data: { endedAt: new Date() },
    });

    sendSuccess(res, { message: 'Client removed from class' });
  } catch (error) {
    logger.error('Error removing client from class', error);
    sendSingleError(res, 'Failed to remove client', 500);
  }
};
