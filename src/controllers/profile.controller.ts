import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import {
  buildAvatarKey,
  uploadFile,
  deleteFile,
  resolveAvatarUrl,
} from '../services/upload.service';
import type {
  CreateUserProfileInput,
  UpdateUserProfileInput,
  GetClientProfileParams,
  ProfileStatsQuery,
} from '../schemas/profile.schema';
import { calculateStreaksBySource } from '../utils/streak';
import type { AuthenticatedUser } from '../middleware/auth.middleware';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnexpectedException,
} from '../lib/errors';

// ─── Shared select for consistent response shape ────────────────────
const profileSelect = {
  supabase_auth_id: true,
  bio: true,
  avatar_key: true,
  height_cm: true,
  weight_kg: true,
  sex: true,
  date_of_birth: true,
  equipment_available: true,
  experience_level: true,
  injury_history: true,
  active_weekdays: true,
  created_at: true,
  updated_at: true,
} as const;

/** Shape returned by profileSelect. */
type ProfileSelectResult = {
  supabase_auth_id: string;
  bio: string | null;
  avatar_key: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  sex: string | null;
  date_of_birth: Date | null;
  equipment_available: string[];
  experience_level: string | null;
  injury_history: string | null;
  active_weekdays: string[];
  created_at: Date;
  updated_at: Date;
};

/**
 * Transforms a Prisma profile row (snake_case) into the camelCase DTO
 * the Flutter client expects.
 *
 * @param raw - The Prisma select result with `avatar_key` already
 *              resolved to a presigned URL by [withSignedAvatar].
 * @returns The client-facing profile object.
 */
function toProfileDto(
  raw: ProfileSelectResult & { avatar_key: string | null }
) {
  return {
    id: raw.supabase_auth_id,
    userId: raw.supabase_auth_id,
    bio: raw.bio,
    avatarUrl: raw.avatar_key,
    heightCm: raw.height_cm,
    weightKg: raw.weight_kg,
    sex: raw.sex,
    dateOfBirth: raw.date_of_birth?.toISOString() ?? null,
    equipment: raw.equipment_available,
    injuryHistory: raw.injury_history,
    experienceLevel: raw.experience_level,
    activeWeekdays: raw.active_weekdays,
    isOnboarded:
      raw.bio != null ||
      raw.height_cm != null ||
      raw.weight_kg != null ||
      raw.sex != null ||
      raw.experience_level != null ||
      raw.injury_history != null ||
      raw.active_weekdays.length > 0,
    createdAt: raw.created_at?.toISOString() ?? null,
    updatedAt: raw.updated_at?.toISOString() ?? null,
  };
}

/**
 * Takes a raw profile from Prisma (with avatar_key storing an S3 key)
 * and resolves it to a response object with a presigned avatar URL.
 */
async function withSignedAvatar<T extends { avatar_key: string | null }>(
  profile: T | null
): Promise<(Omit<T, 'avatar_key'> & { avatar_key: string | null }) | null> {
  if (!profile) return null;
  const avatarUrl = await resolveAvatarUrl(profile.avatar_key);
  return { ...profile, avatar_key: avatarUrl };
}

// ─── GET  /profile — Get own user profile ───────────────────────────
export const getUserProfile = async (
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

  const raw = await prisma.user.findUnique({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    select: profileSelect,
  });

  if (!raw) {
    // Should not happen (requireAppUser already confirmed existence)
    // but return null so the frontend triggers onboarding.
    sendSuccess(res, { profile: null });
    return;
  }

  const resolved = await withSignedAvatar(raw);
  const profile = toProfileDto(
    resolved as ProfileSelectResult & { avatar_key: string | null }
  );
  sendSuccess(res, { profile });
};

// ─── POST /profile — Create profile (onboarding) ───────────────────
export const createUserProfile = async (
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

  // Use res.locals.validated.body — the validateRequest middleware stores
  // the Zod-parsed (and coerced) result here. Multipart text fields arrive as
  // strings; the schema's z.preprocess(toNumber, …) converts them to numbers
  // before Prisma receives them. Reading req.body directly would bypass that
  // coercion and hand raw strings to Prisma, causing a type-mismatch error.
  const body = res.locals.validated?.body as CreateUserProfileInput;

  // Handle avatar file upload if provided
  let avatarKey: string | null = null;
  const file = req.file;
  if (file) {
    try {
      avatarKey = buildAvatarKey(appUser.supabase_auth_id, file.originalname);
      await uploadFile(avatarKey, file.buffer, file.mimetype);
    } catch (uploadError) {
      logger.error('Failed to upload avatar during onboarding', uploadError);
      throw new UnexpectedException(
        'PROFILE_AVATAR_UPLOAD_FAILED',
        'Failed to upload avatar image'
      );
    }
  }

  // The user already exists (created at registration). Update profile fields.
  const raw = await prisma.user.update({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    data: {
      bio: body.bio ?? null,
      avatar_key: avatarKey,
      height_cm: body.heightCm ?? null,
      weight_kg: body.weightKg ?? null,
      sex: body.sex ?? null,
      date_of_birth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      equipment_available: body.equipment ?? [],
      experience_level: body.experienceLevel ?? null,
      injury_history: body.injuryHistory ?? null,
      active_weekdays: body.activeWeekdays ?? [],
    },
    select: profileSelect,
  });

  logger.info('User profile created (onboarding)', {
    userId: appUser.supabase_auth_id,
  });

  const resolved = await withSignedAvatar(raw);
  const profile = toProfileDto(
    resolved as ProfileSelectResult & { avatar_key: string | null }
  );
  sendSuccess(res, { profile }, 201);
};

// ─── PATCH /profile — Update profile ────────────────────────────────
export const updateUserProfile = async (
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

  const existing = await prisma.user.findUnique({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    select: { avatar_key: true },
  });
  if (!existing) {
    throw new NotFoundException('USER_NOT_FOUND', 'User not found');
  }

  // Use res.locals.validated.body — see createUserProfile for rationale.
  const body = res.locals.validated?.body as UpdateUserProfileInput;

  // Build update data only from provided fields
  const data: Record<string, unknown> = {};

  // Handle avatar upload or removal
  const file = req.file;
  if (file) {
    try {
      // Delete old avatar from S3 if it exists
      if (existing.avatar_key) {
        await deleteFile(existing.avatar_key).catch((err) =>
          logger.warn('Failed to delete old avatar from S3', {
            key: existing.avatar_key,
            err,
          })
        );
      }
      const newKey = buildAvatarKey(
        appUser.supabase_auth_id,
        file.originalname
      );
      await uploadFile(newKey, file.buffer, file.mimetype);
      data.avatar_key = newKey;
    } catch (uploadError) {
      logger.error(
        'Failed to upload avatar during profile update',
        uploadError
      );
      throw new UnexpectedException(
        'PROFILE_AVATAR_UPLOAD_FAILED',
        'Failed to upload avatar image'
      );
    }
  } else if (body.removeAvatar) {
    // Explicitly remove avatar
    if (existing.avatar_key) {
      await deleteFile(existing.avatar_key).catch((err) =>
        logger.warn('Failed to delete avatar from S3', {
          key: existing.avatar_key,
          err,
        })
      );
    }
    data.avatar_key = null;
  }

  if (body.bio !== undefined) data.bio = body.bio;
  if (body.heightCm !== undefined) data.height_cm = body.heightCm;
  if (body.weightKg !== undefined) data.weight_kg = body.weightKg;
  if (body.sex !== undefined) data.sex = body.sex;
  if (body.dateOfBirth !== undefined)
    data.date_of_birth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  if (body.equipment !== undefined) data.equipment_available = body.equipment;
  if (body.experienceLevel !== undefined)
    data.experience_level = body.experienceLevel;
  if (body.injuryHistory !== undefined)
    data.injury_history = body.injuryHistory;
  if (body.activeWeekdays !== undefined)
    data.active_weekdays = body.activeWeekdays;

  // If nothing to update, return the existing profile
  if (Object.keys(data).length === 0) {
    const raw = await prisma.user.findUnique({
      where: { supabase_auth_id: appUser.supabase_auth_id },
      select: profileSelect,
    });
    if (!raw) {
      throw new NotFoundException('USER_NOT_FOUND', 'User not found');
    }
    const resolved = await withSignedAvatar(raw);
    const profile = toProfileDto(
      resolved as ProfileSelectResult & { avatar_key: string | null }
    );
    sendSuccess(res, { profile });
    return;
  }

  const updated = await prisma.user.update({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    data,
    select: profileSelect,
  });

  logger.info('User profile updated', {
    userId: appUser.supabase_auth_id,
    fields: Object.keys(data),
  });

  const resolved = await withSignedAvatar(updated);
  const profile = toProfileDto(
    resolved as ProfileSelectResult & { avatar_key: string | null }
  );
  sendSuccess(res, { profile });
};

// ─── Coach: GET /clients/:userId/profile ────────────────────────────
export const getClientProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException(
      'AUTH_COACH_REQUIRED',
      'Coach access required'
    );
  }

  const { userId } = res.locals.validated?.params as GetClientProfileParams;

  // Verify the user is actively subscribed to this coach
  // No unique constraint on (user_id, coach_id) — use findFirst
  const subscription = await prisma.subscribed_coach.findFirst({
    where: {
      user_id: userId,
      coach_id: coach.user_id,
      ended_at: null,
    },
  });

  if (!subscription) {
    throw new ForbiddenException(
      'PROFILE_CLIENT_NOT_SUBSCRIBED',
      'User is not subscribed to you',
      [
        {
          code: 'PROFILE_CLIENT_NOT_SUBSCRIBED',
          message: 'User is not subscribed to you',
          field: 'userId',
        },
      ]
    );
  }

  const profile = await prisma.user.findUnique({
    where: { supabase_auth_id: userId },
    select: {
      ...profileSelect,
      full_name: true,
      nickname: true,
      email: true,
    },
  });

  if (!profile) {
    throw new NotFoundException(
      'PROFILE_CLIENT_NOT_FOUND',
      'Client profile not found'
    );
  }

  const resolved = await withSignedAvatar(profile);
  const dto = toProfileDto(
    resolved as ProfileSelectResult & { avatar_key: string | null }
  );
  sendSuccess(res, {
    profile: {
      ...dto,
      fullName: profile.full_name,
      nickname: profile.nickname,
      email: profile.email,
    },
  });
};

// ─── GET /profile/stats — Aggregated profile statistics ──────────────

/**
 * Returns aggregated profile stats for the authenticated user.
 *
 * Aggregates today's sets, this week's workouts/minutes/streak,
 * and all-time totals in a single response for the profile screen
 * and shareable stat cards.
 *
 * @route GET /api/profile/stats
 */
export const getProfileStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : (rawUser as AuthenticatedUser).id
    : undefined;

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const { weekOf } = (res.locals.validated?.query as ProfileStatsQuery) || {};

  // ── Week window (Monday–Sunday) ──
  const referenceDate = weekOf ? new Date(weekOf) : new Date();
  const dayOfWeek = referenceDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(referenceDate);
  weekStart.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  // ── Today window ──
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayStart.getUTCDate() + 1);

  // ── Fetch sessions for the week from both systems ──
  const [weeklyCoach, weeklyStandalone] = await Promise.all([
    prisma.workout_session.findMany({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: { not: null },
        started_at: { gte: weekStart, lt: weekEnd },
      },
      select: {
        started_at: true,
        completed_at: true,
      },
      orderBy: { started_at: 'asc' },
    }),
    prisma.standalone_session.findMany({
      where: {
        user_id: supabaseId,
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: weekStart, lt: weekEnd },
      },
      select: {
        started_at: true,
        completed_at: true,
      },
      orderBy: { started_at: 'asc' },
    }),
  ]);

  const weeklySessions = [...weeklyCoach, ...weeklyStandalone];
  const workoutsThisWeek = weeklySessions.length;
  const totalMinutesWeek = weeklySessions.reduce((sum, s) => {
    if (s.started_at && s.completed_at) {
      return (
        sum +
        Math.round((s.completed_at.getTime() - s.started_at.getTime()) / 60000)
      );
    }
    return sum;
  }, 0);

  // ── Sets completed today from both systems ──
  const [sessionsTodayCoach, sessionsTodayStandalone] = await Promise.all([
    prisma.workout_session.findMany({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: { not: null },
        started_at: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true },
    }),
    prisma.standalone_session.findMany({
      where: {
        user_id: supabaseId,
        completed_at: { not: null },
        deleted_at: null,
        started_at: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true },
    }),
  ]);

  const coachSessionIdsToday = sessionsTodayCoach.map((s) => s.id);
  const standaloneSessionIdsToday = sessionsTodayStandalone.map((s) => s.id);

  let setsToday = 0;

  const [coachSetCountsToday, standaloneSetCountsToday] = await Promise.all([
    coachSessionIdsToday.length > 0
      ? prisma.performed_set.groupBy({
          by: ['workout_session_id'],
          where: {
            workout_session_id: { in: coachSessionIdsToday },
          },
          _count: { id: true },
        })
      : ([] as { _count: { id: number } }[]),

    standaloneSessionIdsToday.length > 0
      ? prisma.standalone_performed_set.groupBy({
          by: ['session_id'],
          where: {
            session_id: { in: standaloneSessionIdsToday },
          },
          _count: { id: true },
        })
      : ([] as { _count: { id: number } }[]),
  ]);

  setsToday =
    coachSetCountsToday.reduce((sum, g) => sum + g._count.id, 0) +
    standaloneSetCountsToday.reduce((sum, g) => sum + g._count.id, 0);

  const completedToday =
    coachSessionIdsToday.length > 0 || standaloneSessionIdsToday.length > 0;

  // ── Streak ──
  const { combinedStreak } = await calculateStreaksBySource(
    supabaseId,
    new Date(),
    prisma
  );

  // ── All-time totals (both systems) ──
  const [
    allTimeCoach,
    allTimeStandalone,
    allTimeCoachSets,
    allTimeStandaloneSets,
  ] = await Promise.all([
    prisma.workout_session.count({
      where: {
        assigned_program_routine: {
          assigned_program: { user_id: supabaseId },
        },
        completed_at: { not: null },
      },
    }),
    prisma.standalone_session.count({
      where: {
        user_id: supabaseId,
        completed_at: { not: null },
        deleted_at: null,
      },
    }),
    prisma.performed_set.count({
      where: {
        workout_session: {
          assigned_program_routine: {
            assigned_program: { user_id: supabaseId },
          },
        },
      },
    }),
    prisma.standalone_performed_set.count({
      where: {
        session: {
          user_id: supabaseId,
          deleted_at: null,
        },
      },
    }),
  ]);

  const allTimeSessions = allTimeCoach + allTimeStandalone;
  const allTimeSets = allTimeCoachSets + allTimeStandaloneSets;

  // ── Session dates for the week (for calendar display) ──
  const sessionDates = weeklySessions
    .map((s) => s.started_at?.toISOString() ?? null)
    .filter((d): d is string => d !== null);

  sendSuccess(res, {
    workoutsThisWeek,
    setsToday,
    streakDays: combinedStreak,
    allTimeWorkouts: allTimeSessions,
    allTimeSets,
    totalMinutesWeek,
    completedToday,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10),
    sessionDates,
  });
};
