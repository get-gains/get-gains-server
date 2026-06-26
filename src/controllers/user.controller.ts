import { Request, Response } from 'express';
import prisma from '../config/database';
import { resolveAvatarUrl } from '../services/upload.service';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { createNotification } from '../services/notification.service';
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
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '../lib/errors';

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
  const { user_id, user, social_links, created_at, years_experience, ...rest } =
    coach;
  return {
    id: user_id,
    name: user.full_name,
    email: user.email,
    avatarUrl: await resolveAvatarUrl(user.avatar_key),
    bio: user.bio,
    yearsExperience: years_experience ?? 0,
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
    throw new ConflictException('USER_ALREADY_EXISTS', 'User already exists', [
      {
        code: 'USER_EMAIL_TAKEN',
        message: 'User already exists',
        field: 'email',
      },
    ]);
  }

  // Also check by supabase_auth_id
  const existingBySupabase = await prisma.user.findUnique({
    where: { supabase_auth_id },
  });

  if (existingBySupabase) {
    logger.debug('User already exists with this Supabase ID', {
      supabase_auth_id,
    });
    throw new ConflictException('USER_ALREADY_EXISTS', 'User already exists');
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
};

/**
 * Discover/search coaches (public listing)
 */
export const discoverCoaches = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { search, specialty, limit, offset } = res.locals.validated
    ?.query as DiscoverCoachesQuery;
  const take = Math.min(Math.max(1, limit || 50), 100);
  const skip = Math.max(0, offset || 0);

  // Only show coaches that are discoverable (is_discoverable defaults to true)
  const where: {
    is_discoverable: boolean;
    AND?: Record<string, unknown>[];
    user_id?: { in: string[] };
  } = {
    is_discoverable: true,
  };

  // Case-insensitive specialty filter via raw SQL
  // (Prisma's hasSome/has do case-sensitive exact matching on PostgreSQL arrays)
  if (specialty) {
    const specialtyLower = specialty.toLowerCase();
    const matching = await prisma.$queryRaw<{ user_id: string }[]>`
      SELECT "user_id" FROM "coach"
      WHERE "is_discoverable" = true
      AND EXISTS (
        SELECT 1 FROM unnest("specialties") AS s WHERE LOWER(s) = ${specialtyLower}
      )
    `;

    if (matching.length === 0) {
      sendSuccess(res, {
        coaches: [],
        pagination: { total: 0, limit: take, offset: skip, hasMore: false },
      });
      return;
    }

    where.user_id = { in: matching.map((r) => r.user_id) };
  }

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
        years_experience: true,
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
};

/**
 * Get a single coach's public profile
 */
export const getCoachProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { coachId } = res.locals.validated?.params as GetCoachProfileParams;

  const coach = await prisma.coach.findUnique({
    where: { user_id: coachId },
    select: {
      user_id: true,
      certifications: true,
      specialties: true,
      years_experience: true,
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
    throw new NotFoundException('USER_COACH_NOT_FOUND', 'Coach not found', [
      {
        code: 'USER_COACH_NOT_FOUND',
        message: 'Coach not found',
        field: 'coachId',
      },
    ]);
  }

  sendSuccess(res, { coach: await flattenCoach(coach) });
};

/**
 * Get user's subscribed coaches
 */
export const getSubscribedCoaches = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
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
            years_experience: true,
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
};

/**
 * Subscribe to a coach
 */
export const subscribeToCoach = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
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
    throw new NotFoundException('USER_COACH_NOT_FOUND', 'Coach not found', [
      {
        code: 'USER_COACH_NOT_FOUND',
        message: 'Coach not found',
        field: 'coachId',
      },
    ]);
  }

  // Guard 1: cannot subscribe to self
  if (appUser.supabase_auth_id === coachId) {
    throw new ConflictException(
      'USER_COACH_SELF_SUBSCRIBE',
      'You cannot subscribe to yourself'
    );
  }

  // Guard 2: manual intake toggle
  if (!coach.accepting_clients) {
    throw new ConflictException(
      'USER_COACH_NOT_ACCEPTING',
      'This coach is not accepting new clients at this time'
    );
  }

  // Guard 2: capacity cap
  const activeClientCount = await prisma.subscribed_coach.count({
    where: { coach_id: coachId, ended_at: null },
  });
  if (activeClientCount >= coach.max_clients) {
    throw new ConflictException(
      'USER_COACH_AT_CAPACITY',
      'This coach has reached their maximum client capacity'
    );
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
      throw new ConflictException(
        'USER_COACH_ALREADY_SUBSCRIBED',
        'Already subscribed to this coach',
        [
          {
            code: 'USER_COACH_ALREADY_SUBSCRIBED',
            message: 'Already subscribed to this coach',
            field: 'coachId',
          },
        ]
      );
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

  // Notify coach
  try {
    await createNotification({
      userId: coachId,
      type: 'coach_subscribed',
      title: 'New Client',
      body: `${appUser.full_name} subscribed to you as a client.`,
      data: { clientId: appUser.supabase_auth_id },
    });
  } catch (err) {
    logger.error('Failed to create coach_subscribed notification', err);
  }

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
};

/**
 * Unsubscribe from a coach
 */
export const unsubscribeFromCoach = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const { coachId } = res.locals.validated?.params as UnsubscribeCoachParams;

  const subscription = await prisma.subscribed_coach.findFirst({
    where: {
      user_id: appUser.supabase_auth_id,
      coach_id: coachId,
    },
  });

  if (!subscription) {
    throw new NotFoundException(
      'USER_COACH_NOT_SUBSCRIBED',
      'Not subscribed to this coach',
      [
        {
          code: 'USER_COACH_NOT_SUBSCRIBED',
          message: 'Not subscribed to this coach',
          field: 'coachId',
        },
      ]
    );
  }

  if (subscription.ended_at) {
    throw new ConflictException(
      'USER_COACH_ALREADY_UNSUBSCRIBED',
      'Already unsubscribed from this coach',
      [
        {
          code: 'USER_COACH_ALREADY_UNSUBSCRIBED',
          message: 'Already unsubscribed from this coach',
          field: 'coachId',
        },
      ]
    );
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
};

/**
 * Get current user profile (Flutter app contract: GET /users/profile).
 * Returns { data: { user: { supabase_auth_id, email, full_name, nickname, created_at, updated_at } }, errors: [] }
 */
export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const user = await prisma.user.findUnique({
    where: { supabase_auth_id: appUser.supabase_auth_id },
  });

  if (!user) {
    throw new NotFoundException('USER_NOT_FOUND', 'User not found');
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
};

/**
 * Update current user profile (Flutter app contract: PATCH /users/profile).
 */
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
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
      throw new NotFoundException('USER_NOT_FOUND', 'User not found');
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
};
