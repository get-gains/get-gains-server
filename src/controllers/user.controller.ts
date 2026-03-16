import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  CreateUserData,
  CreateUserFromGoogleData,
  DiscoverCoachesQuery,
  GetCoachProfileParams,
  GetSubscribedCoachesQuery,
  SubscribeCoachParams,
  UnsubscribeCoachParams,
  UpdateProfileInput,
} from '../schemas/user.schema';

export const createUser = async (data: CreateUserData) => {
  const { email, name, nickname, supabaseId } = data;
  // Create user in database
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      nickname,
      supabaseId,
    },
  });

  return user;
};

export const getUserBySupabaseId = async (supabaseId: string) => {
  return await prisma.user.findUnique({
    where: { supabaseId },
  });
};

/**
 * Create user from Google OAuth (route handler)
 *
 * Used to complete Google sign-up by creating a user profile.
 * The user has already authenticated with Google and has tokens.
 */
export const createUserFromGoogle = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, name, nickname, supabaseId }: CreateUserFromGoogleData = res
      .locals.validated?.body as CreateUserFromGoogleData;

    logger.debug('Creating user from Google OAuth', { email, supabaseId });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      logger.debug('User already exists', { email });
      sendSingleError(res, 'User already exists', 409, 'email');
      return;
    }

    // Also check by supabaseId
    const existingBySupabase = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (existingBySupabase) {
      logger.debug('User already exists with this Supabase ID', { supabaseId });
      sendSingleError(res, 'User already exists', 409);
      return;
    }

    // Create user
    const user = await createUser({ email, name, nickname, supabaseId });

    logger.info('User created from Google OAuth', {
      userId: user.id,
      email: user.email,
    });

    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          supabaseId: user.supabaseId,
        },
      },
      201
    );
    return;
  } catch (error) {
    logger.error('Error creating user from Google', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

/**
 * Discover/search coaches (public listing)
 */
export const discoverCoaches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { search, limit, offset } = res.locals.validated
      ?.query as DiscoverCoachesQuery;
    const take = Math.min(Math.max(1, limit || 50), 100);
    const skip = Math.max(0, offset || 0);

    // Coaches with no settings row are treated as discoverable (backward-compatible).
    const where: any = {
      AND: [
        {
          OR: [{ settings: null }, { settings: { isDiscoverable: true } }],
        },
      ],
    };
    if (search) {
      const searchLower = search.toLowerCase();
      where.AND.push({
        OR: [
          { name: { contains: searchLower, mode: 'insensitive' } },
          { bio: { contains: searchLower, mode: 'insensitive' } },
          { specialties: { hasSome: [searchLower] } },
        ],
      });
    }

    const [coaches, total] = await Promise.all([
      prisma.coach.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          bio: true,
          yearsExperience: true,
          certifications: true,
          awards: true,
          specialties: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: [
          { isVerified: 'desc' },
          { yearsExperience: 'desc' },
          { createdAt: 'desc' },
        ],
        take,
        skip,
      }),
      prisma.coach.count({ where }),
    ]);

    sendSuccess(res, {
      coaches,
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + coaches.length < total,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error discovering coaches', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to discover coaches', 500);
  }
};

/**
 * Get a single coach's public profile
 */
export const getCoachProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { coachId } = req.params as unknown as GetCoachProfileParams;

    const coach = await prisma.coach.findUnique({
      where: { id: coachId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        bio: true,
        yearsExperience: true,
        certifications: true,
        awards: true,
        specialties: true,
        isVerified: true,
        socialLinks: true,
        createdAt: true,
      },
    });

    if (!coach) {
      sendSingleError(res, 'Coach not found', 404, 'coachId');
      return;
    }

    sendSuccess(res, { coach });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching coach profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch coach profile', 500);
  }
};

/**
 * Get user's subscribed coaches
 */
export const getSubscribedCoaches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const { limit, offset } = res.locals.validated
      ?.query as GetSubscribedCoachesQuery;
    const take = Math.min(Math.max(1, limit || 50), 100);
    const skip = Math.max(0, offset || 0);

    const [subscriptions, total] = await Promise.all([
      prisma.subscribedCoach.findMany({
        where: {
          userId: appUser.id,
          endedAt: null,
        },
        include: {
          coach: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              bio: true,
              yearsExperience: true,
              certifications: true,
              awards: true,
              specialties: true,
              isVerified: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
      }),
      prisma.subscribedCoach.count({
        where: {
          userId: appUser.id,
          endedAt: null,
        },
      }),
    ]);

    const coaches = subscriptions.map((sub) => ({
      ...sub.coach,
      subscribedAt: sub.startedAt,
    }));

    sendSuccess(res, {
      coaches,
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + coaches.length < total,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching subscribed coaches', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch subscribed coaches', 500);
  }
};

/**
 * Subscribe to a coach
 */
export const subscribeToCoach = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const { coachId } = res.locals.validated?.params as SubscribeCoachParams;

    const coach = await prisma.coach.findUnique({
      where: { id: coachId },
      include: { settings: true },
    });

    if (!coach) {
      sendSingleError(res, 'Coach not found', 404, 'coachId');
      return;
    }

    const settings = coach.settings;

    // Guard 1: manual intake toggle
    if (settings && !settings.acceptingClients) {
      sendSingleError(
        res,
        'This coach is not accepting new clients at this time',
        409
      );
      return;
    }

    // Guard 2: capacity cap
    if (settings) {
      const activeClientCount = await prisma.subscribedCoach.count({
        where: { coachId, endedAt: null },
      });
      if (activeClientCount >= settings.maxClients) {
        sendSingleError(
          res,
          'This coach has reached their maximum client capacity',
          409
        );
        return;
      }
    }

    // Check if already subscribed
    const existingSubscription = await prisma.subscribedCoach.findFirst({
      where: {
        userId: appUser.id,
        coachId,
      },
    });

    if (existingSubscription) {
      if (!existingSubscription.endedAt) {
        sendSingleError(
          res,
          'Already subscribed to this coach',
          409,
          'coachId'
        );
        return;
      }
      // Re-subscribe (reactivate)
      await prisma.subscribedCoach.update({
        where: { id: existingSubscription.id },
        data: { endedAt: null },
      });
      const updated = await prisma.subscribedCoach.findUnique({
        where: { id: existingSubscription.id },
        include: {
          coach: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              bio: true,
              yearsExperience: true,
              certifications: true,
              awards: true,
              specialties: true,
              isVerified: true,
            },
          },
        },
      });
      sendSuccess(
        res,
        {
          coach: {
            ...updated!.coach,
            subscribedAt: updated!.startedAt,
          },
        },
        200
      );
      return;
    }

    // Create new subscription
    const subscription = await prisma.subscribedCoach.create({
      data: {
        userId: appUser.id,
        coachId,
      },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            bio: true,
            yearsExperience: true,
            certifications: true,
            awards: true,
            specialties: true,
            isVerified: true,
          },
        },
      },
    });

    logger.info('User subscribed to coach', {
      userId: appUser.id,
      coachId,
      subscriptionId: subscription.id,
    });

    sendSuccess(
      res,
      {
        coach: {
          ...subscription.coach,
          subscribedAt: subscription.startedAt,
        },
      },
      201
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Error subscribing to coach', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to subscribe to coach', 500);
  }
};

/**
 * Unsubscribe from a coach
 */
export const unsubscribeFromCoach = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const { coachId } = res.locals.validated?.params as UnsubscribeCoachParams;

    const subscription = await prisma.subscribedCoach.findFirst({
      where: {
        userId: appUser.id,
        coachId,
      },
    });

    if (!subscription) {
      sendSingleError(res, 'Not subscribed to this coach', 404, 'coachId');
      return;
    }

    if (subscription.endedAt) {
      sendSingleError(
        res,
        'Already unsubscribed from this coach',
        409,
        'coachId'
      );
      return;
    }

    await prisma.subscribedCoach.update({
      where: { id: subscription.id },
      data: { endedAt: new Date() },
    });

    logger.info('User unsubscribed from coach', {
      userId: appUser.id,
      coachId,
      subscriptionId: subscription.id,
    });

    sendSuccess(res, { message: 'Unsubscribed from coach' });
  } catch (error) {
    const err = error as Error;
    logger.error('Error unsubscribing from coach', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to unsubscribe from coach', 500);
  }
};

/**
 * Get current user profile (Flutter app contract: GET /users/profile).
 * Returns { data: { user: { id, email, name, nickname, supabaseId, createdAt, updatedAt } }, errors: [] }
 */
export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: appUser.id },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        supabaseId: user.supabaseId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch profile', 500);
  }
};

/**
 * Update current user profile (Flutter app contract: PATCH /users/profile).
 */
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const body = res.locals.validated?.body as UpdateProfileInput;
    const data: { name?: string; nickname?: string } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.nickname !== undefined) data.nickname = body.nickname;

    if (Object.keys(data).length === 0) {
      const user = await prisma.user.findUnique({
        where: { id: appUser.id },
      });
      if (!user) {
        sendSingleError(res, 'User not found', 404);
        return;
      }
      sendSuccess(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          supabaseId: user.supabaseId,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: appUser.id },
      data,
    });

    sendSuccess(res, {
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        nickname: updated.nickname,
        supabaseId: updated.supabaseId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to update profile', 500);
  }
};
