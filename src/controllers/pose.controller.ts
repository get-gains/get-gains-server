import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import type {
  UploadFormInput,
  UpdateFormInput,
  UpdateFormParams,
  GetExerciseFormsParams,
  FormIdParams,
  DownloadProgramFormsParams,
  DownloadProgramFormsQuery,
  DownloadExerciseFormParams,
  FramesUploadUrlInput,
} from '../schemas/pose.schema';
import { NotFoundException, ForbiddenException } from '../lib/errors';
import {
  getPresignedPutUrl,
  getPresignedUrl,
  buildPoseFramesKey,
} from '../services/upload.service';

// ============== Coach Form Controllers ==============

/**
 * Upload a new reference form for an exercise.
 * Ownership verified via exercise.user_id === req.coach!.user_id.
 */
export const uploadCoachForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coachUserId = req.coach!.user_id;
  const { exerciseId, cameraAngle, recorded_frames_key } = res.locals.validated
    ?.body as UploadFormInput;

  logger.debug('Uploading coach form', {
    coachUserId,
    exerciseId,
    cameraAngle,
  });

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
  });

  if (!exercise) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }

  if (exercise.user_id !== coachUserId) {
    throw new ForbiddenException(
      'WORKOUT_EXERCISE_FORBIDDEN',
      'Unauthorized: exercise belongs to another coach'
    );
  }

  const form = await prisma.exercise_form.create({
    data: {
      exercise_id: exerciseId,
      camera_angle: cameraAngle,
      recorded_frames_key,
    },
  });

  logger.info('Coach form uploaded', {
    formId: form.id,
    exerciseId,
    coachUserId,
  });

  sendSuccess(
    res,
    {
      form: {
        id: form.id,
        exercise_id: form.exercise_id,
        camera_angle: form.camera_angle,
        recorded_frames_key: form.recorded_frames_key,
        created_at: form.created_at,
      },
    },
    201
  );
};

/**
 * Get a specific form by ID (coach only).
 * Ownership verified via form.exercise.user_id === req.coach!.user_id.
 */
export const getFormById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { formId } = res.locals.validated?.params as FormIdParams;
  const coachUserId = req.coach!.user_id;

  logger.debug('Fetching form by ID', { formId, coachUserId });

  const form = await prisma.exercise_form.findUnique({
    where: { id: formId },
    include: {
      exercise: {
        select: { id: true, name: true, user_id: true },
      },
    },
  });

  if (!form) {
    throw new NotFoundException('POSE_FORM_NOT_FOUND', 'Form not found');
  }

  if (form.exercise.user_id !== coachUserId) {
    throw new ForbiddenException(
      'WORKOUT_EXERCISE_FORBIDDEN',
      'Unauthorized: form belongs to another coach'
    );
  }

  sendSuccess(res, {
    form: {
      id: form.id,
      exercise_id: form.exercise_id,
      camera_angle: form.camera_angle,
      recorded_frames_key: form.recorded_frames_key,
      created_at: form.created_at,
      updated_at: form.updated_at,
      exercise: {
        id: form.exercise.id,
        name: form.exercise.name,
      },
    },
  });
};

/**
 * Get all forms for a specific exercise (coach only).
 * Ownership verified via exercise.user_id === req.coach!.user_id.
 */
export const getExerciseForms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { exerciseId } = res.locals.validated?.params as GetExerciseFormsParams;
  const coachUserId = req.coach!.user_id;

  logger.debug('Fetching exercise forms', { exerciseId, coachUserId });

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
  });

  if (!exercise) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }

  if (exercise.user_id !== coachUserId) {
    throw new ForbiddenException(
      'WORKOUT_EXERCISE_FORBIDDEN',
      'Unauthorized: exercise belongs to another coach'
    );
  }

  const forms = await prisma.exercise_form.findMany({
    where: { exercise_id: exerciseId },
    select: {
      id: true,
      exercise_id: true,
      camera_angle: true,
      recorded_frames_key: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { camera_angle: 'asc' },
  });

  sendSuccess(res, {
    exerciseId,
    exerciseName: exercise.name,
    forms,
    total: forms.length,
  });
};

/**
 * Update camera_angle and/or recorded_frames_key on a form.
 * Ownership verified via exercise.user_id === req.coach!.user_id.
 */
export const updateForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { formId } = res.locals.validated?.params as UpdateFormParams;
  const coachUserId = req.coach!.user_id;
  const updateData = res.locals.validated?.body as UpdateFormInput;

  logger.debug('Updating form', { formId, coachUserId });

  const existingForm = await prisma.exercise_form.findUnique({
    where: { id: formId },
    include: {
      exercise: { select: { user_id: true } },
    },
  });

  if (!existingForm) {
    throw new NotFoundException('POSE_FORM_NOT_FOUND', 'Form not found');
  }

  if (existingForm.exercise.user_id !== coachUserId) {
    throw new ForbiddenException(
      'WORKOUT_EXERCISE_FORBIDDEN',
      'Unauthorized: form belongs to another coach'
    );
  }

  const updatedForm = await prisma.exercise_form.update({
    where: { id: formId },
    data: {
      ...(updateData.cameraAngle !== undefined && {
        camera_angle: updateData.cameraAngle,
      }),
      ...(updateData.recorded_frames_key !== undefined && {
        recorded_frames_key: updateData.recorded_frames_key,
      }),
    },
  });

  logger.info('Form updated', { formId, coachUserId });

  sendSuccess(res, {
    form: {
      id: updatedForm.id,
      exercise_id: updatedForm.exercise_id,
      camera_angle: updatedForm.camera_angle,
      recorded_frames_key: updatedForm.recorded_frames_key,
      updated_at: updatedForm.updated_at,
    },
  });
};

/**
 * Delete a form. Ownership verified via exercise.user_id === req.coach!.user_id.
 */
export const deleteForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { formId } = res.locals.validated?.params as FormIdParams;
  const coachUserId = req.coach!.user_id;

  logger.debug('Deleting form', { formId, coachUserId });

  const existingForm = await prisma.exercise_form.findUnique({
    where: { id: formId },
    include: {
      exercise: { select: { user_id: true } },
    },
  });

  if (!existingForm) {
    throw new NotFoundException('POSE_FORM_NOT_FOUND', 'Form not found');
  }

  if (existingForm.exercise.user_id !== coachUserId) {
    throw new ForbiddenException(
      'WORKOUT_EXERCISE_FORBIDDEN',
      'Unauthorized: form belongs to another coach'
    );
  }

  await prisma.exercise_form.delete({
    where: { id: formId },
  });

  logger.info('Form deleted', { formId, coachUserId });

  sendSuccess(res, { message: 'Form deleted successfully' });
};

// ============== Download Controllers ==============

/**
 * Bulk download all forms for every exercise in an assigned program.
 * Relational path: assigned_program → assigned_program_routines
 *   → assigned_program_routine_exercises → exercise (with exercise_forms).
 * Returns exercise.active_segments instead of ExercisePoseConfig.
 */
export const bulkDownloadProgramForms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const { programId } = res.locals.validated
    ?.params as DownloadProgramFormsParams;
  const { since } = res.locals.validated?.query as DownloadProgramFormsQuery;

  logger.debug('Bulk download program forms', { userId, programId, since });

  const assignedProgram = await prisma.assigned_program.findFirst({
    where: { id: programId, user_id: userId, deleted_at: null },
    include: {
      assigned_program_routines: {
        include: {
          assigned_program_routine_exercises: {
            include: {
              exercise: {
                select: {
                  id: true,
                  name: true,
                  active_segments: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!assignedProgram) {
    throw new NotFoundException(
      'ASSIGNMENT_NOT_FOUND',
      'No assigned program found'
    );
  }

  // Collect all unique exercise IDs from the assigned program
  const exerciseIds = new Set<string>();
  for (const routine of assignedProgram.assigned_program_routines) {
    for (const routineExercise of routine.assigned_program_routine_exercises) {
      exerciseIds.add(routineExercise.exercise_id);
    }
  }

  const exerciseIdArray = Array.from(exerciseIds);

  // Build exercise lookup from the nested include
  const exerciseMap = new Map<
    string,
    { id: string; name: string; active_segments: string[] }
  >();
  for (const routine of assignedProgram.assigned_program_routines) {
    for (const routineExercise of routine.assigned_program_routine_exercises) {
      const ex = routineExercise.exercise;
      if (!exerciseMap.has(ex.id)) {
        exerciseMap.set(ex.id, ex);
      }
    }
  }

  // Fetch forms for all exercises
  const formsWhere: Record<string, unknown> = {
    exercise_id: { in: exerciseIdArray },
  };
  if (since) {
    formsWhere.updated_at = { gte: since };
  }

  const forms = await prisma.exercise_form.findMany({
    where: formsWhere,
    select: {
      id: true,
      exercise_id: true,
      camera_angle: true,
      recorded_frames_key: true,
      updated_at: true,
    },
  });

  // Group forms by exercise
  const formsByExercise = new Map<string, typeof forms>();
  for (const form of forms) {
    const existing = formsByExercise.get(form.exercise_id) ?? [];
    existing.push(form);
    formsByExercise.set(form.exercise_id, existing);
  }

  const exercises = exerciseIdArray.map((exId) => {
    const ex = exerciseMap.get(exId);
    const exerciseForms = formsByExercise.get(exId) ?? [];

    return {
      exerciseId: exId,
      exerciseName: ex?.name ?? 'Unknown',
      activeSegments: ex?.active_segments ?? [],
      forms: exerciseForms.map((f) => ({
        id: f.id,
        camera_angle: f.camera_angle,
        recorded_frames_key: f.recorded_frames_key,
      })),
    };
  });

  // Determine the last updated timestamp across all returned forms
  const allTimestamps = forms.map((f) => f.updated_at);
  const lastUpdatedAt =
    allTimestamps.length > 0
      ? new Date(Math.max(...allTimestamps.map((t) => t.getTime())))
      : null;

  sendSuccess(res, {
    programId,
    programName: assignedProgram.name,
    exercises,
    lastUpdatedAt,
  });
};

/**
 * Download forms for a single exercise.
 * Returns exercise.active_segments instead of ExercisePoseConfig.
 */
export const downloadExerciseForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { exerciseId } = res.locals.validated
    ?.params as DownloadExerciseFormParams;

  logger.debug('Downloading exercise form', { exerciseId });

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      exercise_forms: {
        select: {
          id: true,
          camera_angle: true,
          recorded_frames_key: true,
        },
      },
    },
  });

  if (!exercise) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }

  sendSuccess(res, {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    activeSegments: exercise.active_segments,
    forms: exercise.exercise_forms.map((f) => ({
      id: f.id,
      camera_angle: f.camera_angle,
      recorded_frames_key: f.recorded_frames_key,
    })),
  });
};

// ============== Presigned URL Controllers ==============

const PRESIGNED_PUT_TTL = 900;

/**
 * Generate a presigned PUT URL for uploading a pose-frames JSON blob to S3.
 * Discriminated on `kind`: `coach_form` (exercise ownership) or `client_set`
 * (workout session ownership via assigned_program chain).
 * @param req - Express request with validated body
 * @param res - Express response
 */
export const createFramesUploadUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const input = res.locals.validated?.body as FramesUploadUrlInput;

  if (input.kind === 'coach_form') {
    const exercise = await prisma.exercise.findUnique({
      where: { id: input.exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(
        'WORKOUT_EXERCISE_NOT_FOUND',
        'Exercise not found'
      );
    }

    if (exercise.user_id !== userId) {
      throw new ForbiddenException(
        'WORKOUT_EXERCISE_FORBIDDEN',
        'Unauthorized: exercise belongs to another user'
      );
    }

    const key = buildPoseFramesKey({ kind: 'coach_form', userId });
    const url = await getPresignedPutUrl(
      key,
      'application/json',
      PRESIGNED_PUT_TTL
    );

    logger.info('Presigned PUT URL generated (coach_form)', {
      userId,
      exerciseId: input.exerciseId,
      key,
    });

    sendSuccess(res, { key, url, expiresInSeconds: PRESIGNED_PUT_TTL });
    return;
  }

  // client_set branch
  const session = await prisma.workout_session.findUnique({
    where: { id: input.workoutSessionId },
    include: {
      assigned_program_routine: {
        select: {
          assigned_program: {
            select: { user_id: true },
          },
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundException(
      'WORKOUT_SESSION_NOT_FOUND',
      'Workout session not found'
    );
  }

  if (session.assigned_program_routine.assigned_program.user_id !== userId) {
    throw new ForbiddenException(
      'WORKOUT_SESSION_FORBIDDEN',
      'Unauthorized: workout session belongs to another user'
    );
  }

  const key = buildPoseFramesKey({
    kind: 'client_set',
    userId,
    workoutSessionId: input.workoutSessionId,
    setNumber: input.setNumber,
  });
  const url = await getPresignedPutUrl(
    key,
    'application/json',
    PRESIGNED_PUT_TTL
  );

  logger.info('Presigned PUT URL generated (client_set)', {
    userId,
    workoutSessionId: input.workoutSessionId,
    setNumber: input.setNumber,
    key,
  });

  sendSuccess(res, { key, url, expiresInSeconds: PRESIGNED_PUT_TTL });
};

/**
 * Generate a presigned GET URL for downloading an exercise form's frames blob.
 * Auth: requireAppUser only — no ownership check (keys are UUID-based;
 * presigned URL is short-lived). Clients legitimately need access to forms
 * for any program they're enrolled in.
 * @param req - Express request with validated params (formId)
 * @param res - Express response
 */
export const getFormDownloadUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { formId } = res.locals.validated?.params as FormIdParams;

  const form = await prisma.exercise_form.findUnique({
    where: { id: formId },
    select: { id: true, recorded_frames_key: true },
  });

  if (!form) {
    throw new NotFoundException('POSE_FORM_NOT_FOUND', 'Form not found');
  }

  const url = await getPresignedUrl(form.recorded_frames_key);

  logger.debug('Form download URL generated', {
    formId,
    key: form.recorded_frames_key,
  });

  sendSuccess(res, {
    formId: form.id,
    recorded_frames_key: form.recorded_frames_key,
    url,
    expiresInSeconds: 3600,
  });
};
