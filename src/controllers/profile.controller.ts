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
} from '../schemas/profile.schema';
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
  created_at: true,
  updated_at: true,
} as const;

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

  // Return null data so the frontend knows onboarding is needed
  const profile = await withSignedAvatar(raw);
  sendSuccess(res, { profile: profile ?? null });
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
  const profile = await prisma.user.update({
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
    },
    select: profileSelect,
  });

  logger.info('User profile created (onboarding)', {
    userId: appUser.supabase_auth_id,
  });

  const resolved = await withSignedAvatar(profile);
  sendSuccess(res, { profile: resolved }, 201);
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

  // If nothing to update, return the existing profile
  if (Object.keys(data).length === 0) {
    const raw = await prisma.user.findUnique({
      where: { supabase_auth_id: appUser.supabase_auth_id },
      select: profileSelect,
    });
    const resolved = await withSignedAvatar(raw);
    sendSuccess(res, { profile: resolved });
    return;
  }

  const profile = await prisma.user.update({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    data,
    select: profileSelect,
  });

  logger.info('User profile updated', {
    userId: appUser.supabase_auth_id,
    fields: Object.keys(data),
  });

  const resolved = await withSignedAvatar(profile);
  sendSuccess(res, { profile: resolved });
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
  sendSuccess(res, { profile: resolved });
};
