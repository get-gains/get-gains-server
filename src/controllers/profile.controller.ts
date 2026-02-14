import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import type {
  CreateUserProfileInput,
  UpdateUserProfileInput,
  GetClientProfileParams,
} from '../schemas/profile.schema';

// ─── Shared select for consistent response shape ────────────────────
const profileSelect = {
  id: true,
  userId: true,
  bio: true,
  avatarUrl: true,
  heightCm: true,
  weightKg: true,
  unitPreference: true,
  sex: true,
  dateOfBirth: true,
  equipment: true,
  injuryHistory: true,
  experienceLevel: true,
  daysAvailable: true,
  sessionDurationMinutes: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── GET  /profile — Get own user profile ───────────────────────────
export const getUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: appUser.id },
      select: profileSelect,
    });

    // Return null data so the frontend knows onboarding is needed
    sendSuccess(res, { profile: profile ?? null });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching user profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch user profile', 500);
  }
};

// ─── POST /profile — Create profile (onboarding) ───────────────────
export const createUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    // Prevent duplicate profiles
    const existing = await prisma.userProfile.findUnique({
      where: { userId: appUser.id },
    });
    if (existing) {
      sendSingleError(res, 'Profile already exists. Use PATCH to update.', 409);
      return;
    }

    const body = req.body as CreateUserProfileInput;

    const profile = await prisma.userProfile.create({
      data: {
        userId: appUser.id,
        bio: body.bio ?? null,
        avatarUrl: body.avatarUrl ?? null,
        heightCm: body.heightCm ?? null,
        weightKg: body.weightKg ?? null,
        unitPreference: body.unitPreference ?? null,
        sex: body.sex ?? null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        equipment: body.equipment ?? [],
        injuryHistory: body.injuryHistory ?? null,
        experienceLevel: body.experienceLevel ?? null,
        daysAvailable: body.daysAvailable,
        sessionDurationMinutes: body.sessionDurationMinutes,
      },
      select: profileSelect,
    });

    logger.info('User profile created (onboarding)', {
      userId: appUser.id,
      profileId: profile.id,
    });

    sendSuccess(res, { profile }, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('Error creating user profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to create user profile', 500);
  }
};

// ─── PATCH /profile — Update profile ────────────────────────────────
export const updateUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const existing = await prisma.userProfile.findUnique({
      where: { userId: appUser.id },
    });
    if (!existing) {
      sendSingleError(
        res,
        'Profile not found. Complete onboarding first.',
        404
      );
      return;
    }

    const body = req.body as UpdateUserProfileInput;

    // Build update data only from provided fields
    const data: Record<string, unknown> = {};

    if (body.bio !== undefined) data.bio = body.bio;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl ?? null;
    if (body.heightCm !== undefined) data.heightCm = body.heightCm;
    if (body.weightKg !== undefined) data.weightKg = body.weightKg;
    if (body.unitPreference !== undefined)
      data.unitPreference = body.unitPreference;
    if (body.sex !== undefined) data.sex = body.sex;
    if (body.dateOfBirth !== undefined)
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (body.equipment !== undefined) data.equipment = body.equipment;
    if (body.injuryHistory !== undefined)
      data.injuryHistory = body.injuryHistory ?? null;
    if (body.experienceLevel !== undefined)
      data.experienceLevel = body.experienceLevel;
    if (body.daysAvailable !== undefined)
      data.daysAvailable = body.daysAvailable;
    if (body.sessionDurationMinutes !== undefined)
      data.sessionDurationMinutes = body.sessionDurationMinutes;

    // If nothing to update, return the existing profile
    if (Object.keys(data).length === 0) {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: appUser.id },
        select: profileSelect,
      });
      sendSuccess(res, { profile });
      return;
    }

    const profile = await prisma.userProfile.update({
      where: { userId: appUser.id },
      data,
      select: profileSelect,
    });

    logger.info('User profile updated', {
      userId: appUser.id,
      profileId: profile.id,
      fields: Object.keys(data),
    });

    sendSuccess(res, { profile });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating user profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to update user profile', 500);
  }
};

// ─── Coach: GET /clients/:userId/profile ────────────────────────────
export const getClientProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach access required', 403);
      return;
    }

    const { userId } = req.params as unknown as GetClientProfileParams;

    // Verify the user is actively subscribed to this coach
    const subscription = await prisma.subscribedCoach.findUnique({
      where: {
        userId_coachId: { userId, coachId: coach.id },
      },
    });

    if (!subscription || subscription.endedAt !== null) {
      sendSingleError(res, 'User is not subscribed to you', 403, 'userId');
      return;
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        ...profileSelect,
        user: {
          select: {
            id: true,
            name: true,
            nickname: true,
            email: true,
          },
        },
      },
    });

    if (!profile) {
      sendSingleError(res, 'Client has not completed their profile', 404);
      return;
    }

    sendSuccess(res, { profile });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching client profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch client profile', 500);
  }
};
