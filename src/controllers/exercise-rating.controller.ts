import type { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendSingleError } from '../utils/response';
import { logger } from '../utils/logger';
import { UnauthorizedException } from '../lib/errors/exceptions';
import type {
  CreateRatingInput,
  DeleteRatingParams,
} from '../schemas/exercise-rating.schema';

const getSupabaseId = (req: Request): string | undefined => {
  const user = req.user;
  if (!user) return undefined;
  return 'supabase_auth_id' in user
    ? ((user as Record<string, unknown>).supabase_auth_id as string)
    : user.id;
};

/**
 * Toggle on: rate an exercise with a thumbs-up.
 * Creates the rating row and increments the denormalized count in a transaction.
 * If the user already rated this exercise, returns the existing rating (idempotent).
 */
export const rateExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const supabaseId = getSupabaseId(req);
  if (!supabaseId) {
    throw new UnauthorizedException('UNAUTHENTICATED', 'Unauthorized');
  }

  const { exerciseId } = res.locals.validated?.body as CreateRatingInput;

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
  });

  if (!exercise) {
    sendSingleError(res, 'FORM_LIBRARY_NOT_FOUND', 'Exercise not found', 404);
    return;
  }

  const existing = await prisma.exercise_rating.findUnique({
    where: {
      exercise_id_user_id: {
        exercise_id: exerciseId,
        user_id: supabaseId,
      },
    },
  });

  if (existing) {
    logger.debug('Rating already exists', { exerciseId, userId: supabaseId });
    sendSuccess(res, {
      thumbs_up_count: exercise.thumbs_up_count,
      is_rated: true,
    });
    return;
  }

  const [updated] = await prisma.$transaction([
    prisma.exercise.update({
      where: { id: exerciseId },
      data: { thumbs_up_count: { increment: 1 } },
    }),
    prisma.exercise_rating.create({
      data: {
        exercise_id: exerciseId,
        user_id: supabaseId,
      },
    }),
  ]);

  logger.info('Exercise rated', { exerciseId, userId: supabaseId });

  sendSuccess(res, {
    thumbs_up_count: updated.thumbs_up_count,
    is_rated: true,
  });
};

/**
 * Toggle off: remove a thumbs-up rating from an exercise.
 * Deletes the rating row and decrements the denormalized count in a transaction.
 * Idempotent: returns success even if the rating doesn't exist.
 */
export const removeRating = async (
  req: Request,
  res: Response
): Promise<void> => {
  const supabaseId = getSupabaseId(req);
  if (!supabaseId) {
    throw new UnauthorizedException('UNAUTHENTICATED', 'Unauthorized');
  }

  const { exerciseId } = res.locals.validated?.params as DeleteRatingParams;

  const existing = await prisma.exercise_rating.findUnique({
    where: {
      exercise_id_user_id: {
        exercise_id: exerciseId,
        user_id: supabaseId,
      },
    },
  });

  if (!existing) {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { thumbs_up_count: true },
    });
    sendSuccess(res, {
      thumbs_up_count: exercise?.thumbs_up_count ?? 0,
      is_rated: false,
    });
    return;
  }

  const [updated] = await prisma.$transaction([
    prisma.exercise.update({
      where: { id: exerciseId },
      data: { thumbs_up_count: { decrement: 1 } },
    }),
    prisma.exercise_rating.delete({
      where: { id: existing.id },
    }),
  ]);

  logger.info('Exercise rating removed', { exerciseId, userId: supabaseId });

  sendSuccess(res, {
    thumbs_up_count: updated.thumbs_up_count,
    is_rated: false,
  });
};
