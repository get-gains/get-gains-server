import { Request, Response } from 'express';
import prisma from '../config/database';
import { resolveAvatarUrl } from '../services/upload.service';
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

/**
 * Flatten the nested Prisma coach+user shape into the flat DTO
 * the Flutter client expects.
 */
async function flattenCoach(coach: {
  user_id: string;
  certifications: string[];
  specialties: string[];
  social_links?: string[];
  created_at: Date;
  user: {
    full_name: string;
    email: string;
    avatar_key: string | null;
    bio: string | null;
  };
  [key: string]: unknown;
}): Promise<Record<string, unknown>> {
  const { user_id, user, social_links, created_at, ...rest } = coach;
  return {
    id: user_id,
    name: user.full_name,
    email: user.email,
    avatarUrl: await resolveAvatarUrl(user.avatar_key),
    bio: user.bio,
    ...rest,
    ...(social_links !== undefined ? { socialLinks: social_links } : {}),
    createdAt: created_at,
  };
}

export const createUser = async (data: CreateUserData) => {
  const { email, full_name, nickname, supabase_auth_id } = data;
  // Create user in database
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      full_name,
      nickname,
      supabase_auth_id,
    },
  });

  return user;
};

export const getUserBySupabaseId = async (supabaseId: string) => {
  return await prisma.user.findUnique({
    where: { supabase_auth_id: supabaseId },
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
    const {
      email,
      full_name,
      nickname,
      supabase_auth_id,
    }: CreateUserFromGoogleData = res.locals.validated
      ?.body as CreateUserFromGoogleData;

    logger.debug('Creating user from Google OAuth', {
      email,
      supabase_auth_id,
    });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      logger.debug('User already exists', { email });
      sendSingleError(res, 'User already exists', 409, 'email');
      return;
    }

    // Also check by supabase_auth_id
    const existingBySupabase = await prisma.user.findUnique({
      where: { supabase_auth_id },
    });

    if (existingBySupabase) {
      logger.debug('User already exists with this Supabase ID', {
        supabase_auth_id,
      });
      sendSingleError(res, 'User already exists', 409);
      return;
    }

    // Create user
    const user = await createUser({
      email,
      full_name,
      nickname,
      supabase_auth_id,
    });

    logger.info('User created from Google OAuth', {
      userId: user.supabase_auth_id,
      email: user.email,
    });

    sendSuccess(
      res,
      {
        user: {
          supabase_auth_id: user.supabase_auth_id,
          email: user.email,
          full_name: user.full_name,
          nickname: user.nickname,
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

    // Only show coaches that are discoverable (is_discoverable defaults to true)
    const where: {
      is_discoverable: boolean;
      AND?: {
        OR: (
          | { user: { full_name: { contains: string; mode: 'insensitive' } } }
          | { user: { bio: { contains: string; mode: 'insensitive' } } }
          | { specialties: { hasSome: string[] } }
        )[];
      }[];
    } = {
      is_discoverable: true,
    };

    if (search) {
      const searchLower = search.toLowerCase();
      where.AND = [
        {
          OR: [
            {
              user: {
                full_name: { contains: searchLower, mode: 'insensitive' },
              },
            },
            { user: { bio: { contains: searchLower, mode: 'insensitive' } } },
            { specialties: { hasSome: [searchLower] } },
          ],
        },
      ];
    }

    const [coaches, total] = await Promise.all([
      prisma.coach.findMany({
        where,
        select: {
          user_id: true,
          certifications: true,
          specialties: true,
          created_at: true,
          user: {
            select: {
              full_name: true,
              email: true,
              avatar_key: true,
              bio: true,
            },
          },
        },
        orderBy: [{ created_at: 'desc' }],
        take,
        skip,
      }),
      prisma.coach.count({ where }),
    ]);

    const flatCoaches = await Promise.all(coaches.map(flattenCoach));

    sendSuccess(res, {
      coaches: flatCoaches,
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
    const { coachId } = res.locals.validated?.params as GetCoachProfileParams;

    const coach = await prisma.coach.findUnique({
      where: { user_id: coachId },
      select: {
        user_id: true,
        certifications: true,
        specialties: true,
        social_links: true,
        created_at: true,
        user: {
          select: {
            full_name: true,
            email: true,
            avatar_key: true,
            bio: true,
          },
        },
      },
    });

    if (!coach) {
      sendSingleError(res, 'Coach not found', 404, 'coachId');
      return;
    }

    sendSuccess(res, { coach: await flattenCoach(coach) });
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
      prisma.subscribed_coach.findMany({
        where: {
          user_id: appUser.supabase_auth_id,
          ended_at: null,
        },
        include: {
          coach: {
            select: {
              user_id: true,
              certifications: true,
              specialties: true,
              created_at: true,
              user: {
                select: {
                  full_name: true,
                  email: true,
                  avatar_key: true,
                  bio: true,
                },
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
          user_id: appUser.supabase_auth_id,
          ended_at: null,
        },
      }),
    ]);

    const coaches = await Promise.all(
      subscriptions.map(async (sub) => ({
        ...(await flattenCoach(sub.coach)),
        subscribedAt: sub.started_at,
      }))
    );

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
      where: { user_id: coachId },
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
            avatar_key: true,
            bio: true,
          },
        },
      },
    });

    if (!coach) {
      sendSingleError(res, 'Coach not found', 404, 'coachId');
      return;
    }

    // Guard 1: manual intake toggle
    if (!coach.accepting_clients) {
      sendSingleError(
        res,
        'This coach is not accepting new clients at this time',
        409
      );
      return;
    }

    // Guard 2: capacity cap
    const activeClientCount = await prisma.subscribed_coach.count({
      where: { coach_id: coachId, ended_at: null },
    });
    if (activeClientCount >= coach.max_clients) {
      sendSingleError(
        res,
        'This coach has reached their maximum client capacity',
        409
      );
      return;
    }

    // Check if already subscribed
    const existingSubscription = await prisma.subscribed_coach.findFirst({
      where: {
        user_id: appUser.supabase_auth_id,
        coach_id: coachId,
      },
    });

    if (existingSubscription) {
      if (!existingSubscription.ended_at) {
        sendSingleError(
          res,
          'Already subscribed to this coach',
          409,
          'coachId'
        );
        return;
      }
      // Re-subscribe (reactivate)
      await prisma.subscribed_coach.update({
        where: { id: existingSubscription.id },
        data: { ended_at: null },
      });
      const updated = await prisma.subscribed_coach.findUnique({
        where: { id: existingSubscription.id },
        include: {
          coach: {
            include: {
              user: {
                select: {
                  full_name: true,
                  email: true,
                  avatar_key: true,
                  bio: true,
                },
              },
            },
          },
        },
      });
      sendSuccess(
        res,
        {
          coach: {
            ...(await flattenCoach(updated!.coach)),
            subscribedAt: updated!.started_at,
          },
        },
        200
      );
      return;
    }

    // Create new subscription
    const subscription = await prisma.subscribed_coach.create({
      data: {
        user_id: appUser.supabase_auth_id,
        coach_id: coachId,
      },
      include: {
        coach: {
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
                avatar_key: true,
                bio: true,
              },
            },
          },
        },
      },
    });

    logger.info('User subscribed to coach', {
      userId: appUser.supabase_auth_id,
      coachId,
      subscriptionId: subscription.id,
    });

    sendSuccess(
      res,
      {
        coach: {
          ...(await flattenCoach(subscription.coach)),
          subscribedAt: subscription.started_at,
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

    const subscription = await prisma.subscribed_coach.findFirst({
      where: {
        user_id: appUser.supabase_auth_id,
        coach_id: coachId,
      },
    });

    if (!subscription) {
      sendSingleError(res, 'Not subscribed to this coach', 404, 'coachId');
      return;
    }

    if (subscription.ended_at) {
      sendSingleError(
        res,
        'Already unsubscribed from this coach',
        409,
        'coachId'
      );
      return;
    }

    await prisma.subscribed_coach.update({
      where: { id: subscription.id },
      data: { ended_at: new Date() },
    });

    logger.info('User unsubscribed from coach', {
      userId: appUser.supabase_auth_id,
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
 * Returns { data: { user: { supabase_auth_id, email, full_name, nickname, created_at, updated_at } }, errors: [] }
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
      where: { supabase_auth_id: appUser.supabase_auth_id },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      user: {
        supabase_auth_id: user.supabase_auth_id,
        email: user.email,
        full_name: user.full_name,
        nickname: user.nickname,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      },
      tier: user.active_subscription_tier,
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
    const data: { full_name?: string; nickname?: string } = {};
    if (body.name !== undefined) data.full_name = body.name;
    if (body.nickname !== undefined) data.nickname = body.nickname;

    if (Object.keys(data).length === 0) {
      const user = await prisma.user.findUnique({
        where: { supabase_auth_id: appUser.supabase_auth_id },
      });
      if (!user) {
        sendSingleError(res, 'User not found', 404);
        return;
      }
      sendSuccess(res, {
        user: {
          supabase_auth_id: user.supabase_auth_id,
          email: user.email,
          full_name: user.full_name,
          nickname: user.nickname,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
        },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { supabase_auth_id: appUser.supabase_auth_id },
      data,
    });

    sendSuccess(res, {
      user: {
        supabase_auth_id: updated.supabase_auth_id,
        email: updated.email,
        full_name: updated.full_name,
        nickname: updated.nickname,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
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
