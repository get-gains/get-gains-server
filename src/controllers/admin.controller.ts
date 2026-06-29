import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import supabase from '../config/supabase';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { mapSupabaseError } from '../lib/errors/supabase-error-mapper';
import {
  createCoachInvitation,
  verifyCoachInviteCode,
} from '../services/coach-invite.service';
import {
  AdminLoginInput,
  CreateInvitationInput,
  ListInvitationsQuery,
  RevokeInvitationParams,
  ListCoachesQuery,
  DeactivateCoachParams,
  ActivateCoachParams,
  AnalyticsQuery,
} from '../schemas/admin.schema';
import type { VerifyCoachInviteInput } from '../schemas/coach.schema';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnexpectedException,
} from '../lib/errors';

const INVITE_LIST_INCLUDE = {
  creator: {
    select: { email: true, full_name: true },
  },
  redeemer: {
    select: { email: true, full_name: true },
  },
  revoker: {
    select: { email: true, full_name: true },
  },
};

/**
 * Admin login. Verifies Supabase credentials and ensures the user is an admin.
 */
export const adminLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password } = res.locals.validated?.body as AdminLoginInput;

  logger.debug('Admin login attempt', { email });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (error || !data.user) {
    logger.debug('Admin login failed', {
      email,
      message: error?.message,
    });
    if (error) {
      throw mapSupabaseError(error, 'login', 'Invalid email or password.');
    }
    throw new UnauthorizedException(
      'AUTH_INVALID_CREDENTIALS',
      'Invalid email or password.'
    );
  }

  const appUser = await prisma.user.findUnique({
    where: { supabase_auth_id: data.user.id },
    include: {
      admin_scopes: { select: { scope: true } },
    },
  });

  if (!appUser) {
    throw new NotFoundException('AUTH_APP_USER_NOT_FOUND', 'User not found');
  }

  if (!appUser.is_admin) {
    const pendingInvite = await prisma.admin_invitation.findFirst({
      where: {
        email: appUser.email,
        status: 'PENDING',
        expires_at: { gt: new Date() },
      },
    });

    if (!pendingInvite) {
      throw new ForbiddenException(
        'AUTH_ADMIN_REQUIRED',
        'Admin access required'
      );
    }
  }

  const accessToken = data.session?.access_token;
  const refreshToken = data.session?.refresh_token;

  if (!accessToken || !refreshToken) {
    logger.error('Admin login token generation failed', { email });
    throw new UnexpectedException(
      'AUTH_TOKEN_GENERATION_FAILED',
      'Failed to generate session'
    );
  }

  sendSuccess(res, {
    accessToken,
    refreshToken,
    user: {
      supabase_auth_id: appUser.supabase_auth_id,
      email: appUser.email,
      full_name: appUser.full_name,
      scopes: appUser.admin_scopes.map((s) => s.scope),
    },
  });
};

/**
 * List coach invitations with optional status filter and pagination.
 */
export const listInvitations = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { status, limit, offset } = res.locals.validated
    ?.query as ListInvitationsQuery;

  const where: Prisma.coach_invitationWhereInput = {};
  if (status) {
    where.status = status;
  }

  const [invitations, total] = await Promise.all([
    prisma.coach_invitation.findMany({
      where,
      include: INVITE_LIST_INCLUDE,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.coach_invitation.count({ where }),
  ]);

  sendSuccess(res, {
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      status: inv.status,
      attempts: inv.attempts,
      maxAttempts: inv.max_attempts,
      expiresAt: inv.expires_at,
      createdBy: inv.creator
        ? { email: inv.creator.email, fullName: inv.creator.full_name }
        : null,
      redeemedBy: inv.redeemer
        ? { email: inv.redeemer.email, fullName: inv.redeemer.full_name }
        : null,
      redeemedAt: inv.redeemed_at,
      revokedBy: inv.revoker
        ? { email: inv.revoker.email, fullName: inv.revoker.full_name }
        : null,
      revokedAt: inv.revoked_at,
      createdAt: inv.created_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + invitations.length < total,
    },
  });
};

/**
 * Create a coach invitation for an email.
 */
export const createInvitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = res.locals.validated?.body as CreateInvitationInput;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const invitation = await createCoachInvitation(email, admin.supabase_auth_id);

  sendSuccess(
    res,
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      },
    },
    201
  );
};

/**
 * Revoke a pending coach invitation.
 */
export const revokeInvitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as RevokeInvitationParams;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const invitation = await prisma.coach_invitation.findUnique({
    where: { id },
  });

  if (!invitation) {
    throw new NotFoundException(
      'COACH_INVITE_NOT_FOUND',
      'Invitation not found'
    );
  }

  if (invitation.status !== 'PENDING') {
    throw new BadRequestException(
      'COACH_INVITE_INVALID',
      `Cannot revoke invitation with status ${invitation.status.toLowerCase()}`
    );
  }

  const updated = await prisma.coach_invitation.update({
    where: { id },
    data: {
      status: 'REVOKED',
      revoked_by: admin.supabase_auth_id,
      revoked_at: new Date(),
    },
  });

  logger.info('Coach invitation revoked', {
    invitationId: id,
    revokedBy: admin.supabase_auth_id,
  });

  sendSuccess(res, {
    invitation: {
      id: updated.id,
      status: updated.status,
      revokedAt: updated.revoked_at,
    },
  });
};

/**
 * List coaches for admin management.
 */
export const listCoaches = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { status, search, limit, offset } = res.locals.validated
    ?.query as ListCoachesQuery;

  const where: Prisma.coachWhereInput = {};

  if (status === 'active') {
    where.deactivated_at = null;
  } else if (status === 'deactivated') {
    where.deactivated_at = { not: null };
  }

  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { full_name: { contains: search, mode: 'insensitive' as const } },
      ],
    };
  }

  const [coaches, total] = await Promise.all([
    prisma.coach.findMany({
      where,
      include: {
        user: {
          select: {
            supabase_auth_id: true,
            email: true,
            full_name: true,
            avatar_key: true,
            is_coach: true,
          },
        },
        _count: {
          select: {
            client_relations: {
              where: { ended_at: null },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.coach.count({ where }),
  ]);

  sendSuccess(res, {
    coaches: coaches.map((coach) => ({
      userId: coach.user_id,
      email: coach.user.email,
      fullName: coach.user.full_name,
      avatarKey: coach.user.avatar_key,
      isCoach: coach.user.is_coach,
      yearsExperience: coach.years_experience,
      activeClients: coach._count.client_relations,
      maxClients: coach.max_clients,
      acceptingClients: coach.accepting_clients,
      isDiscoverable: coach.is_discoverable,
      deactivatedAt: coach.deactivated_at,
      status: coach.deactivated_at ? 'deactivated' : 'active',
      createdAt: coach.created_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + coaches.length < total,
    },
  });
};

/**
 * Deactivate a coach.
 */
export const deactivateCoach = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = res.locals.validated?.params as DeactivateCoachParams;

  const coach = await prisma.coach.findUnique({
    where: { user_id: userId },
    include: { user: { select: { email: true, full_name: true } } },
  });

  if (!coach) {
    throw new NotFoundException('COACH_NOT_FOUND', 'Coach not found');
  }

  if (coach.deactivated_at) {
    throw new ConflictException(
      'COACH_ALREADY_DEACTIVATED',
      'Coach is already deactivated'
    );
  }

  const [updatedCoach] = await prisma.$transaction([
    prisma.coach.update({
      where: { user_id: userId },
      data: { deactivated_at: new Date() },
    }),
    prisma.user.update({
      where: { supabase_auth_id: userId },
      data: { is_coach: false },
    }),
  ]);

  logger.info('Coach deactivated', { coachId: userId });

  sendSuccess(res, {
    coach: {
      userId,
      email: coach.user.email,
      fullName: coach.user.full_name,
      deactivatedAt: updatedCoach.deactivated_at,
      status: 'deactivated',
    },
  });
};

/**
 * Reactivate a previously deactivated coach.
 */
export const activateCoach = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = res.locals.validated?.params as ActivateCoachParams;

  const coach = await prisma.coach.findUnique({
    where: { user_id: userId },
    include: { user: { select: { email: true, full_name: true } } },
  });

  if (!coach) {
    throw new NotFoundException('COACH_NOT_FOUND', 'Coach not found');
  }

  if (!coach.deactivated_at) {
    throw new ConflictException(
      'COACH_NOT_DEACTIVATED',
      'Coach is already active'
    );
  }

  const [updatedCoach] = await prisma.$transaction([
    prisma.coach.update({
      where: { user_id: userId },
      data: { deactivated_at: null },
    }),
    prisma.user.update({
      where: { supabase_auth_id: userId },
      data: { is_coach: true },
    }),
  ]);

  logger.info('Coach reactivated', { coachId: userId });

  sendSuccess(res, {
    coach: {
      userId,
      email: coach.user.email,
      fullName: coach.user.full_name,
      deactivatedAt: updatedCoach.deactivated_at,
      status: 'active',
    },
  });
};

interface DateCountRow {
  date: Date;
  count: bigint;
}

/**
 * Build a daily series of counts for a given table/column using a PostgreSQL
 * generate_series CTE so every day in the period is present (with 0 counts).
 */
const fetchDailyCounts = async (
  tableName: 'user' | 'coach' | 'workout_session' | 'coach_invitation',
  dateColumn: 'created_at' | 'completed_at' | 'redeemed_at',
  periodStart: Date,
  now: Date,
  extraWhere?: Prisma.Sql
): Promise<DateCountRow[]> => {
  return prisma.$queryRaw<DateCountRow[]>`
    WITH dates AS (
      SELECT generate_series(
        DATE_TRUNC('day', ${periodStart}::timestamptz),
        DATE_TRUNC('day', ${now}::timestamptz),
        INTERVAL '1 day'
      )::date AS date
    )
    SELECT d.date, COUNT(*) AS count
    FROM dates d
    LEFT JOIN ${Prisma.raw(`"${tableName}"`)} t
      ON DATE_TRUNC('day', t.${Prisma.raw(dateColumn)})::date = d.date
      AND t.${Prisma.raw(dateColumn)} >= ${periodStart}
      ${extraWhere ? extraWhere : Prisma.empty}
    GROUP BY d.date
    ORDER BY d.date ASC
  `;
};

/**
 * Get aggregate admin analytics for the last N days.
 */
export const getAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { days } = res.locals.validated?.query as AnalyticsQuery;

  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsers,
    userBaseline,
    totalCoaches,
    activeCoaches,
    deactivatedCoaches,
    coachBaseline,
    onboardedCoaches,
    pendingInvites,
    revokedInvites,
    redeemedInvites,
    totalRedeemedInvites,
    completedWorkouts,
    subscribedUsersResult,
    usersWithCoachResult,
    usersWithProgramResult,
    avgClientsResult,
    topCoachesResult,
    dailyWorkouts,
    dailyNewUsers,
    dailyNewCoaches,
    dailyRedeemedInvites,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { created_at: { gte: periodStart } } }),
    prisma.user.count({ where: { created_at: { lt: periodStart } } }),
    prisma.coach.count(),
    prisma.coach.count({ where: { deactivated_at: null } }),
    prisma.coach.count({ where: { deactivated_at: { not: null } } }),
    prisma.coach.count({ where: { created_at: { lt: periodStart } } }),
    prisma.coach.count({ where: { created_at: { gte: periodStart } } }),
    prisma.coach_invitation.count({ where: { status: 'PENDING' } }),
    prisma.coach_invitation.count({ where: { status: 'REVOKED' } }),
    prisma.coach_invitation.count({
      where: {
        status: 'REDEEMED',
        redeemed_at: { gte: periodStart },
      },
    }),
    prisma.coach_invitation.count({ where: { status: 'REDEEMED' } }),
    prisma.workout_session.count({
      where: {
        completed_at: { gte: periodStart },
      },
    }),
    prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT COUNT(*) FROM "user" WHERE active_subscription_tier != 'FREE'`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT sc.user_id)
      FROM subscribed_coach sc
      JOIN "user" u ON u.supabase_auth_id = sc.user_id
      WHERE sc.ended_at IS NULL AND u.active_subscription_tier != 'FREE'
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT ap.user_id)
      FROM assigned_program ap
      JOIN "user" u ON u.supabase_auth_id = ap.user_id
      WHERE ap.deleted_at IS NULL AND ap.is_active = true AND u.active_subscription_tier != 'FREE'
    `,
    prisma.$queryRaw<Array<{ average: number | null }>>`
      SELECT AVG(client_count)::float AS average
      FROM (
        SELECT coach_id, COUNT(*) AS client_count
        FROM subscribed_coach
        WHERE ended_at IS NULL
        GROUP BY coach_id
      ) sub
    `,
    prisma.$queryRaw<
      Array<{
        coach_id: string;
        workouts: bigint;
        full_name: string;
        email: string;
      }>
    >`
      SELECT ap.coach_id, COUNT(ws.id) AS workouts, u.full_name, u.email
      FROM assigned_program ap
      JOIN assigned_program_routine apr ON apr.assigned_program_id = ap.id
      JOIN workout_session ws ON ws.assigned_program_routine_id = apr.id
      JOIN "user" u ON u.supabase_auth_id = ap.coach_id
      WHERE ws.completed_at IS NOT NULL AND ws.completed_at >= ${periodStart}
      GROUP BY ap.coach_id, u.full_name, u.email
      ORDER BY workouts DESC
      LIMIT 5
    `,
    fetchDailyCounts('workout_session', 'completed_at', periodStart, now),
    fetchDailyCounts('user', 'created_at', periodStart, now),
    fetchDailyCounts('coach', 'created_at', periodStart, now),
    fetchDailyCounts(
      'coach_invitation',
      'redeemed_at',
      periodStart,
      now,
      Prisma.sql`AND t.status = 'REDEEMED'`
    ),
  ]);

  const subscribedUsers = Number(subscribedUsersResult[0]?.count ?? 0);
  const usersWithCoach = Number(usersWithCoachResult[0]?.count ?? 0);
  const usersWithProgram = Number(usersWithProgramResult[0]?.count ?? 0);
  const avgClients = avgClientsResult[0]?.average ?? 0;

  let runningUsers = Number(userBaseline);
  const userSeries = dailyNewUsers.map((row) => {
    runningUsers += Number(row.count);
    return {
      date: row.date.toISOString(),
      newUsers: Number(row.count),
      cumulativeUsers: runningUsers,
    };
  });

  let runningCoaches = Number(coachBaseline);
  const coachSeries = dailyNewCoaches.map((row) => {
    runningCoaches += Number(row.count);
    return {
      date: row.date.toISOString(),
      newCoaches: Number(row.count),
      cumulativeCoaches: runningCoaches,
    };
  });

  const engagementSeries = dailyWorkouts.map((row) => ({
    date: row.date.toISOString(),
    workoutsCompleted: Number(row.count),
    avgWorkoutsPerUser:
      totalUsers > 0
        ? Math.round((Number(row.count) / totalUsers) * 100) / 100
        : 0,
  }));

  const invitationSeries = dailyRedeemedInvites.map((row) => ({
    date: row.date.toISOString(),
    redeemedInvites: Number(row.count),
  }));

  sendSuccess(res, {
    period: {
      days,
      start: periodStart.toISOString(),
      end: now.toISOString(),
    },
    coaches: {
      total: totalCoaches,
      active: activeCoaches,
      deactivated: deactivatedCoaches,
      onboardedThisPeriod: onboardedCoaches,
      avgClientsPerCoach: Math.round(avgClients * 10) / 10,
      top5ByClientWorkouts: topCoachesResult.map((c) => ({
        coachId: c.coach_id,
        fullName: c.full_name,
        email: c.email,
        workouts: Number(c.workouts),
      })),
    },
    users: {
      total: totalUsers,
      newThisPeriod: newUsers,
      subscribed: subscribedUsers,
      free: totalUsers - subscribedUsers,
      subscribedWithCoach: usersWithCoach,
      subscribedWithoutCoach: subscribedUsers - usersWithCoach,
      subscribedWithProgram: usersWithProgram,
      subscribedWithoutProgram: subscribedUsers - usersWithProgram,
    },
    invitations: {
      pending: pendingInvites,
      revoked: revokedInvites,
      redeemedThisPeriod: redeemedInvites,
      totalRedeemed: totalRedeemedInvites,
    },
    engagement: {
      workoutsCompletedThisPeriod: completedWorkouts,
      avgWorkoutsPerUserThisPeriod:
        totalUsers > 0
          ? Math.round((completedWorkouts / totalUsers) * 10) / 10
          : 0,
    },
    engagementSeries,
    userSeries,
    coachSeries,
    invitationSeries,
  });
};

/**
 * Verify a coach invitation code for the currently authenticated app user.
 * Used by the mobile app before presenting the coach profile setup screen.
 */
export const verifyCoachInviteForUser = async (
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

  const { code } = res.locals.validated?.body as VerifyCoachInviteInput;

  const invitation = await verifyCoachInviteCode(code, appUser.email);

  sendSuccess(res, {
    valid: true,
    email: invitation.email,
  });
};
