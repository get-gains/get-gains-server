import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { AddClientInput, RemoveClientParams } from '../schemas/class.schema';

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
 * Add client to coach's class
 */
export const addClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId } = req.body as AddClientInput;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      sendSingleError(res, 'User not found', 404, 'userId');
      return;
    }

    const existingSubscription = await prisma.subscribedCoach.findUnique({
      where: {
        userId_coachId: { userId, coachId: coach.id },
      },
    });

    if (existingSubscription) {
      if (!existingSubscription.endedAt) {
        sendSingleError(res, 'Client already in class', 409, 'userId');
        return;
      }
      await prisma.subscribedCoach.update({
        where: { id: existingSubscription.id },
        data: { endedAt: null },
      });
      const updated = await prisma.subscribedCoach.findUnique({
        where: { id: existingSubscription.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              nickname: true,
            },
          },
        },
      });
      sendSuccess(
        res,
        {
          client: {
            id: updated!.user.id,
            email: updated!.user.email,
            name: updated!.user.name,
            nickname: updated!.user.nickname,
            subscribedAt: updated!.startedAt,
          },
        },
        201
      );
      return;
    }

    const subscription = await prisma.subscribedCoach.create({
      data: {
        userId,
        coachId: coach.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
          },
        },
      },
    });

    sendSuccess(
      res,
      {
        client: {
          id: subscription.user.id,
          email: subscription.user.email,
          name: subscription.user.name,
          nickname: subscription.user.nickname,
          subscribedAt: subscription.startedAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error adding client to class', error);
    sendSingleError(res, 'Failed to add client', 500);
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
