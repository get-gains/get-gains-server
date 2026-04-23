import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '../lib/errors';
import { GetClassQuery, RemoveClientParams } from '../schemas/class.schema';

/**
 * Get coach's class (client roster)
 */
export const getClass = async (req: Request, res: Response): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
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
            active_subscription_tier: true,
            user_subscription: {
              select: { current_period_end: true },
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
      cr.user.user_subscription?.current_period_end ?? null,
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
};

/**
 * Remove client from coach's class
 */
export const removeClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { userId } = res.locals.validated?.params as RemoveClientParams;

  const subscription = await prisma.subscribed_coach.findFirst({
    where: {
      user_id: userId,
      coach_id: coach.user_id,
    },
  });

  if (!subscription) {
    throw new NotFoundException(
      'COACH_CLIENT_NOT_FOUND',
      'Client not in class'
    );
  }

  if (subscription.ended_at) {
    throw new ConflictException(
      'CLASS_CLIENT_ALREADY_REMOVED',
      'Client already removed from class'
    );
  }

  await prisma.subscribed_coach.update({
    where: { id: subscription.id },
    data: { ended_at: new Date() },
  });

  sendSuccess(res, { message: 'Client removed from class' });
};
