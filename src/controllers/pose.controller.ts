import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import type {
  UploadFormInput,
  UpdateFormInput,
  UpdateFormParams,
  GetExerciseFormsParams,
  GetExerciseFormsQuery,
  FormIdParams,
  UpsertPoseConfigParams,
  UpsertPoseConfigInput,
  GetPoseConfigParams,
  SubmitResultInput,
  ResultHistoryQuery,
  ResultIdParams,
  ResultsByExerciseParams,
  ResultsByExerciseQuery,
  ResultsBySessionParams,
  DownloadProgramFormsParams,
  DownloadProgramFormsQuery,
  DownloadExerciseFormParams,
} from '../schemas/pose.schema';
import { CameraAngle, Prisma } from '@prisma/client';

// ============== Coach Form Controllers ==============

/**
 * Upload a new reference form for an exercise.
 * Auto-deactivates any existing active form for the same exercise + cameraAngle.
 * Auto-increments version based on existing forms for the exercise.
 */
export const uploadCoachForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coachId = req.coach!.id;
    const {
      exerciseId,
      cameraAngle,
      durationMs,
      frameRate,
      totalFrames,
      landmarkFrames,
      featureFrames,
      normalizedFrames,
      avgLandmarkConfidence,
      recordingQuality,
    } = req.body as UploadFormInput;

    logger.debug('Uploading coach form', { coachId, exerciseId, cameraAngle });

    // Verify exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404, 'exerciseId');
      return;
    }

    // Determine next version number for this exercise
    const maxVersion = await prisma.exerciseForm.aggregate({
      where: { exerciseId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // Deactivate existing active form for same exercise + angle
    await prisma.exerciseForm.updateMany({
      where: {
        exerciseId,
        cameraAngle: cameraAngle as CameraAngle,
        isActive: true,
      },
      data: { isActive: false },
    });

    // Create the new form
    const form = await prisma.exerciseForm.create({
      data: {
        exerciseId,
        coachId,
        cameraAngle: cameraAngle as CameraAngle,
        durationMs,
        frameRate,
        totalFrames,
        landmarkFrames,
        featureFrames,
        normalizedFrames: normalizedFrames ?? undefined,
        version: nextVersion,
        isActive: true,
        avgLandmarkConfidence,
        recordingQuality,
      },
    });

    logger.info('Coach form uploaded', {
      formId: form.id,
      exerciseId,
      coachId,
      version: nextVersion,
    });

    // Return form without heavy JSON payloads
    sendSuccess(
      res,
      {
        form: {
          id: form.id,
          exerciseId: form.exerciseId,
          coachId: form.coachId,
          cameraAngle: form.cameraAngle,
          version: form.version,
          isActive: form.isActive,
          totalFrames: form.totalFrames,
          durationMs: form.durationMs,
          frameRate: form.frameRate,
          avgLandmarkConfidence: form.avgLandmarkConfidence,
          recordingQuality: form.recordingQuality,
          createdAt: form.createdAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error uploading coach form', error);
    sendSingleError(res, 'Failed to upload form', 500);
  }
};

/**
 * Get a specific form by ID (coach only).
 * Returns the full form including landmark and feature frame payloads.
 */
export const getFormById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { formId } = req.params as unknown as FormIdParams;
    const coachId = req.coach!.id;

    logger.debug('Fetching form by ID', { formId, coachId });

    const form = await prisma.exerciseForm.findUnique({
      where: { id: formId },
      include: {
        exercise: {
          select: { id: true, name: true, primaryMuscleGroup: true },
        },
      },
    });

    if (!form) {
      sendSingleError(res, 'Form not found', 404);
      return;
    }

    // Only the owning coach can access their forms
    if (form.coachId !== coachId) {
      sendSingleError(res, 'Unauthorized: form belongs to another coach', 403);
      return;
    }

    sendSuccess(res, { form });
  } catch (error) {
    logger.error('Error fetching form', error);
    sendSingleError(res, 'Failed to fetch form', 500);
  }
};

/**
 * Get all forms for a specific exercise (coach only).
 * Optionally filter to active-only forms.
 */
export const getExerciseForms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { exerciseId } = req.params as unknown as GetExerciseFormsParams;
    const { activeOnly } = res.locals.validated?.query as GetExerciseFormsQuery;
    const coachId = req.coach!.id;

    logger.debug('Fetching exercise forms', {
      exerciseId,
      coachId,
      activeOnly,
    });

    // Verify exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404, 'exerciseId');
      return;
    }

    const where: Record<string, unknown> = {
      exerciseId,
      coachId,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    const forms = await prisma.exerciseForm.findMany({
      where,
      select: {
        id: true,
        exerciseId: true,
        coachId: true,
        cameraAngle: true,
        durationMs: true,
        frameRate: true,
        totalFrames: true,
        version: true,
        isActive: true,
        avgLandmarkConfidence: true,
        recordingQuality: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ cameraAngle: 'asc' }, { version: 'desc' }],
    });

    sendSuccess(res, {
      exerciseId,
      exerciseName: exercise.name,
      forms,
      total: forms.length,
    });
  } catch (error) {
    logger.error('Error fetching exercise forms', error);
    sendSingleError(res, 'Failed to fetch exercise forms', 500);
  }
};

/**
 * Update/replace an existing form's data.
 * Only the owning coach can update their forms.
 */
export const updateForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { formId } = req.params as unknown as UpdateFormParams;
    const coachId = req.coach!.id;
    const updateData = req.body as UpdateFormInput;

    logger.debug('Updating form', { formId, coachId });

    const existingForm = await prisma.exerciseForm.findUnique({
      where: { id: formId },
    });

    if (!existingForm) {
      sendSingleError(res, 'Form not found', 404);
      return;
    }

    if (existingForm.coachId !== coachId) {
      sendSingleError(res, 'Unauthorized: form belongs to another coach', 403);
      return;
    }

    // If camera angle is changing and form is active, deactivate other active forms for new angle
    if (
      updateData.cameraAngle &&
      updateData.cameraAngle !== existingForm.cameraAngle &&
      existingForm.isActive
    ) {
      await prisma.exerciseForm.updateMany({
        where: {
          exerciseId: existingForm.exerciseId,
          cameraAngle: updateData.cameraAngle as CameraAngle,
          isActive: true,
          id: { not: formId },
        },
        data: { isActive: false },
      });
    }

    const updatedForm = await prisma.exerciseForm.update({
      where: { id: formId },
      data: {
        ...(updateData.cameraAngle && {
          cameraAngle: updateData.cameraAngle as CameraAngle,
        }),
        ...(updateData.durationMs !== undefined && {
          durationMs: updateData.durationMs,
        }),
        ...(updateData.frameRate !== undefined && {
          frameRate: updateData.frameRate,
        }),
        ...(updateData.totalFrames !== undefined && {
          totalFrames: updateData.totalFrames,
        }),
        ...(updateData.landmarkFrames && {
          landmarkFrames: updateData.landmarkFrames,
        }),
        ...(updateData.featureFrames && {
          featureFrames: updateData.featureFrames,
        }),
        ...(updateData.normalizedFrames !== undefined && {
          normalizedFrames:
            updateData.normalizedFrames === null
              ? Prisma.JsonNull
              : updateData.normalizedFrames,
        }),
        ...(updateData.avgLandmarkConfidence !== undefined && {
          avgLandmarkConfidence: updateData.avgLandmarkConfidence,
        }),
        ...(updateData.recordingQuality !== undefined && {
          recordingQuality: updateData.recordingQuality,
        }),
      },
    });

    logger.info('Form updated', { formId, coachId });

    sendSuccess(res, {
      form: {
        id: updatedForm.id,
        exerciseId: updatedForm.exerciseId,
        coachId: updatedForm.coachId,
        cameraAngle: updatedForm.cameraAngle,
        version: updatedForm.version,
        isActive: updatedForm.isActive,
        totalFrames: updatedForm.totalFrames,
        durationMs: updatedForm.durationMs,
        frameRate: updatedForm.frameRate,
        avgLandmarkConfidence: updatedForm.avgLandmarkConfidence,
        recordingQuality: updatedForm.recordingQuality,
        updatedAt: updatedForm.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating form', error);
    sendSingleError(res, 'Failed to update form', 500);
  }
};

/**
 * Delete a form. Only the owning coach can delete their forms.
 */
export const deleteForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { formId } = req.params as unknown as FormIdParams;
    const coachId = req.coach!.id;

    logger.debug('Deleting form', { formId, coachId });

    const existingForm = await prisma.exerciseForm.findUnique({
      where: { id: formId },
    });

    if (!existingForm) {
      sendSingleError(res, 'Form not found', 404);
      return;
    }

    if (existingForm.coachId !== coachId) {
      sendSingleError(res, 'Unauthorized: form belongs to another coach', 403);
      return;
    }

    await prisma.exerciseForm.delete({
      where: { id: formId },
    });

    logger.info('Form deleted', { formId, coachId });

    sendSuccess(res, { message: 'Form deleted successfully' });
  } catch (error) {
    logger.error('Error deleting form', error);
    sendSingleError(res, 'Failed to delete form', 500);
  }
};

/**
 * Activate a specific form version.
 * Deactivates all other forms for the same exercise + camera angle.
 */
export const activateForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { formId } = req.params as unknown as FormIdParams;
    const coachId = req.coach!.id;

    logger.debug('Activating form', { formId, coachId });

    const form = await prisma.exerciseForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      sendSingleError(res, 'Form not found', 404);
      return;
    }

    if (form.coachId !== coachId) {
      sendSingleError(res, 'Unauthorized: form belongs to another coach', 403);
      return;
    }

    if (form.isActive) {
      sendSingleError(res, 'Form is already active', 409);
      return;
    }

    // Deactivate all other active forms for the same exercise + angle
    await prisma.$transaction([
      prisma.exerciseForm.updateMany({
        where: {
          exerciseId: form.exerciseId,
          cameraAngle: form.cameraAngle,
          isActive: true,
        },
        data: { isActive: false },
      }),
      prisma.exerciseForm.update({
        where: { id: formId },
        data: { isActive: true },
      }),
    ]);

    logger.info('Form activated', {
      formId,
      exerciseId: form.exerciseId,
      cameraAngle: form.cameraAngle,
    });

    sendSuccess(res, {
      form: {
        id: form.id,
        exerciseId: form.exerciseId,
        cameraAngle: form.cameraAngle,
        version: form.version,
        isActive: true,
      },
    });
  } catch (error) {
    logger.error('Error activating form', error);
    sendSingleError(res, 'Failed to activate form', 500);
  }
};

// ============== Pose Config Controllers ==============

/**
 * Create or update the pose configuration for an exercise.
 * Defines which body segments to analyze, recommended angles, and tracked joint angles.
 */
export const upsertPoseConfig = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { exerciseId } = req.params as unknown as UpsertPoseConfigParams;
    const {
      activeSegments,
      recommendedAngles,
      trackedAngles,
      minLandmarkConfidence,
      setupInstructions,
    } = req.body as UpsertPoseConfigInput;

    logger.debug('Upserting pose config', { exerciseId });

    // Verify exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404, 'exerciseId');
      return;
    }

    const config = await prisma.exercisePoseConfig.upsert({
      where: { exerciseId },
      create: {
        exerciseId,
        activeSegments,
        recommendedAngles,
        trackedAngles,
        minLandmarkConfidence: minLandmarkConfidence ?? 0.5,
        setupInstructions,
      },
      update: {
        activeSegments,
        recommendedAngles,
        trackedAngles,
        minLandmarkConfidence: minLandmarkConfidence ?? 0.5,
        setupInstructions,
      },
    });

    logger.info('Pose config upserted', { configId: config.id, exerciseId });

    sendSuccess(res, { config });
  } catch (error) {
    logger.error('Error upserting pose config', error);
    sendSingleError(res, 'Failed to save pose config', 500);
  }
};

/**
 * Get the pose configuration for an exercise.
 * Available to any authenticated user (clients need this for comparison).
 */
export const getPoseConfig = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { exerciseId } = req.params as unknown as GetPoseConfigParams;

    logger.debug('Fetching pose config', { exerciseId });

    const config = await prisma.exercisePoseConfig.findUnique({
      where: { exerciseId },
      include: {
        exercise: {
          select: { id: true, name: true, primaryMuscleGroup: true },
        },
      },
    });

    if (!config) {
      sendSingleError(res, 'Pose config not found for this exercise', 404);
      return;
    }

    sendSuccess(res, { config });
  } catch (error) {
    logger.error('Error fetching pose config', error);
    sendSingleError(res, 'Failed to fetch pose config', 500);
  }
};

// ============== Client Result Controllers (Stubs — Phase 3) ==============

/**
 * Submit a form comparison result from on-device DTW analysis.
 */
export const submitClientResult = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const body = req.body as SubmitResultInput;

    logger.debug('Submitting client result', {
      userId,
      exerciseFormId: body.exerciseFormId,
    });

    // Validate exerciseForm exists and is active
    const exerciseForm = await prisma.exerciseForm.findUnique({
      where: { id: body.exerciseFormId },
    });

    if (!exerciseForm) {
      sendSingleError(res, 'Exercise form not found', 404, 'exerciseFormId');
      return;
    }

    if (!exerciseForm.isActive) {
      sendSingleError(
        res,
        'Exercise form is no longer active',
        400,
        'exerciseFormId'
      );
      return;
    }

    // Validate optional workoutSessionId belongs to user
    if (body.workoutSessionId) {
      const session = await prisma.workoutSession.findFirst({
        where: { id: body.workoutSessionId, userId },
      });
      if (!session) {
        sendSingleError(
          res,
          'Workout session not found or does not belong to user',
          404,
          'workoutSessionId'
        );
        return;
      }
    }

    // Validate optional routineExerciseId exists
    if (body.routineExerciseId) {
      const routineExercise = await prisma.routineExercise.findUnique({
        where: { id: body.routineExerciseId },
      });
      if (!routineExercise) {
        sendSingleError(
          res,
          'Routine exercise not found',
          404,
          'routineExerciseId'
        );
        return;
      }
    }

    const result = await prisma.formComparisonResult.create({
      data: {
        userId,
        exerciseFormId: body.exerciseFormId,
        workoutSessionId: body.workoutSessionId,
        routineExerciseId: body.routineExerciseId,
        overallScore: body.overallScore,
        segmentScores: body.segmentScores,
        corrections: body.corrections,
        cameraAngle: body.cameraAngle as CameraAngle,
        durationMs: body.durationMs,
        frameRate: body.frameRate,
        totalFrames: body.totalFrames,
        avgLandmarkConfidence: body.avgLandmarkConfidence,
        clientLandmarkFrames: body.clientLandmarkFrames ?? undefined,
        clientFeatureFrames: body.clientFeatureFrames ?? undefined,
      },
    });

    logger.info('Client result submitted', {
      resultId: result.id,
      userId,
      overallScore: result.overallScore,
    });

    sendSuccess(
      res,
      {
        result: {
          id: result.id,
          overallScore: result.overallScore,
          segmentScores: result.segmentScores,
          corrections: result.corrections,
          createdAt: result.createdAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error submitting client result', error);
    sendSingleError(res, 'Failed to submit result', 500);
  }
};

/**
 * Get paginated history of the user's form comparison results.
 */
export const getClientHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { exerciseId, limit, offset, from, to } = res.locals.validated
      ?.query as ResultHistoryQuery;

    logger.debug('Fetching client history', {
      userId,
      exerciseId,
      limit,
      offset,
    });

    const where: Record<string, unknown> = { userId };

    if (exerciseId) {
      where.exerciseForm = { exerciseId };
    }

    if (from || to) {
      where.createdAt = {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      };
    }

    const [results, total] = await Promise.all([
      prisma.formComparisonResult.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          exerciseForm: {
            select: {
              id: true,
              cameraAngle: true,
              exercise: { select: { id: true, name: true } },
              coach: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.formComparisonResult.count({ where }),
    ]);

    sendSuccess(res, {
      results: results.map((r) => ({
        id: r.id,
        overallScore: r.overallScore,
        segmentScores: r.segmentScores,
        corrections: r.corrections,
        cameraAngle: r.cameraAngle,
        createdAt: r.createdAt,
        exerciseForm: r.exerciseForm,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching client history', error);
    sendSingleError(res, 'Failed to fetch history', 500);
  }
};

/**
 * Get a specific comparison result by ID.
 */
export const getResultById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { resultId } = req.params as unknown as ResultIdParams;

    const result = await prisma.formComparisonResult.findFirst({
      where: { id: resultId, userId },
      include: {
        exerciseForm: {
          select: {
            id: true,
            cameraAngle: true,
            exercise: { select: { id: true, name: true } },
            coach: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!result) {
      sendSingleError(res, 'Result not found', 404);
      return;
    }

    sendSuccess(res, { result });
  } catch (error) {
    logger.error('Error fetching result', error);
    sendSingleError(res, 'Failed to fetch result', 500);
  }
};

/**
 * Get all comparison results for a specific exercise.
 */
export const getResultsByExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { exerciseId } = req.params as unknown as ResultsByExerciseParams;
    const { limit, offset } = res.locals.validated
      ?.query as ResultsByExerciseQuery;

    const where = {
      userId,
      exerciseForm: { exerciseId },
    };

    const [results, total] = await Promise.all([
      prisma.formComparisonResult.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          overallScore: true,
          segmentScores: true,
          corrections: true,
          cameraAngle: true,
          createdAt: true,
          exerciseForm: {
            select: {
              id: true,
              cameraAngle: true,
              coach: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.formComparisonResult.count({ where }),
    ]);

    sendSuccess(res, { results, total, limit, offset });
  } catch (error) {
    logger.error('Error fetching results by exercise', error);
    sendSingleError(res, 'Failed to fetch results', 500);
  }
};

/**
 * Get all comparison results from a specific workout session.
 */
export const getResultsBySession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { sessionId } = req.params as unknown as ResultsBySessionParams;

    // Verify session belongs to user
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      sendSingleError(res, 'Workout session not found', 404);
      return;
    }

    const results = await prisma.formComparisonResult.findMany({
      where: { workoutSessionId: sessionId, userId },
      orderBy: { createdAt: 'asc' },
      include: {
        exerciseForm: {
          select: {
            id: true,
            cameraAngle: true,
            exercise: { select: { id: true, name: true } },
            coach: { select: { id: true, name: true } },
          },
        },
      },
    });

    sendSuccess(res, { sessionId, results, total: results.length });
  } catch (error) {
    logger.error('Error fetching results by session', error);
    sendSingleError(res, 'Failed to fetch session results', 500);
  }
};

// ============== Download Controllers (Stubs — Phase 4) ==============

/**
 * Bulk download all active forms + pose configs for every exercise in a program.
 * Primary endpoint for offline caching on the client.
 */
export const bulkDownloadProgramForms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { programId } = req.params as unknown as DownloadProgramFormsParams;
    const { since } = res.locals.validated?.query as DownloadProgramFormsQuery;

    logger.debug('Bulk download program forms', { userId, programId, since });

    // Verify user has an active assigned program
    const assignedProgram = await prisma.assignedProgram.findFirst({
      where: { userId, programId, isActive: true },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            programRoutines: {
              include: {
                routine: {
                  include: {
                    routineExercises: {
                      include: {
                        exercise: {
                          select: { id: true, name: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignedProgram) {
      sendSingleError(
        res,
        'No active assigned program found',
        404,
        'programId'
      );
      return;
    }

    // Collect all unique exercise IDs in the program
    const exerciseIds = new Set<string>();
    for (const pr of assignedProgram.program.programRoutines) {
      for (const re of pr.routine.routineExercises) {
        exerciseIds.add(re.exerciseId);
      }
    }

    const exerciseIdArray = Array.from(exerciseIds);

    // Fetch active forms and configs for all exercises
    const formsWhere: Record<string, unknown> = {
      exerciseId: { in: exerciseIdArray },
      isActive: true,
    };
    if (since) {
      formsWhere.updatedAt = { gte: since };
    }

    const [forms, configs] = await Promise.all([
      prisma.exerciseForm.findMany({
        where: formsWhere,
        include: {
          coach: { select: { name: true } },
          exercise: { select: { id: true, name: true } },
        },
      }),
      prisma.exercisePoseConfig.findMany({
        where: { exerciseId: { in: exerciseIdArray } },
      }),
    ]);

    // Group by exercise
    const configMap = new Map(configs.map((c) => [c.exerciseId, c]));
    const formsByExercise = new Map<string, typeof forms>();
    for (const form of forms) {
      const existing = formsByExercise.get(form.exerciseId) ?? [];
      existing.push(form);
      formsByExercise.set(form.exerciseId, existing);
    }

    const exercises = exerciseIdArray.map((exId) => {
      const exerciseForms = formsByExercise.get(exId) ?? [];
      const config = configMap.get(exId);
      const exerciseName =
        exerciseForms[0]?.exercise?.name ??
        assignedProgram.program.programRoutines
          .flatMap((pr) => pr.routine.routineExercises)
          .find((re) => re.exerciseId === exId)?.exercise?.name ??
        'Unknown';

      return {
        exerciseId: exId,
        exerciseName,
        poseConfig: config
          ? {
              activeSegments: config.activeSegments,
              recommendedAngles: config.recommendedAngles,
              trackedAngles: config.trackedAngles,
              minLandmarkConfidence: config.minLandmarkConfidence,
              setupInstructions: config.setupInstructions,
            }
          : null,
        forms: exerciseForms.map((f) => ({
          id: f.id,
          cameraAngle: f.cameraAngle,
          durationMs: f.durationMs,
          frameRate: f.frameRate,
          totalFrames: f.totalFrames,
          landmarkFrames: f.landmarkFrames,
          featureFrames: f.featureFrames,
          normalizedFrames: f.normalizedFrames,
          version: f.version,
          coachName: f.coach?.name,
        })),
      };
    });

    // Determine the last updated timestamp across all returned data
    const allTimestamps = [
      ...forms.map((f) => f.updatedAt),
      ...configs.map((c) => c.updatedAt),
    ];
    const lastUpdatedAt =
      allTimestamps.length > 0
        ? new Date(Math.max(...allTimestamps.map((t) => t.getTime())))
        : null;

    sendSuccess(res, {
      programId,
      programName: assignedProgram.program.name,
      exercises,
      lastUpdatedAt,
    });
  } catch (error) {
    logger.error('Error downloading program forms', error);
    sendSingleError(res, 'Failed to download program forms', 500);
  }
};

/**
 * Download form data for a single exercise (active forms + config).
 */
export const downloadExerciseForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { exerciseId } = req.params as unknown as DownloadExerciseFormParams;

    logger.debug('Downloading exercise form', { exerciseId });

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404, 'exerciseId');
      return;
    }

    const [forms, config] = await Promise.all([
      prisma.exerciseForm.findMany({
        where: { exerciseId, isActive: true },
        include: {
          coach: { select: { name: true } },
        },
      }),
      prisma.exercisePoseConfig.findUnique({
        where: { exerciseId },
      }),
    ]);

    sendSuccess(res, {
      exerciseId,
      exerciseName: exercise.name,
      poseConfig: config
        ? {
            activeSegments: config.activeSegments,
            recommendedAngles: config.recommendedAngles,
            trackedAngles: config.trackedAngles,
            minLandmarkConfidence: config.minLandmarkConfidence,
            setupInstructions: config.setupInstructions,
          }
        : null,
      forms: forms.map((f) => ({
        id: f.id,
        cameraAngle: f.cameraAngle,
        durationMs: f.durationMs,
        frameRate: f.frameRate,
        totalFrames: f.totalFrames,
        landmarkFrames: f.landmarkFrames,
        featureFrames: f.featureFrames,
        normalizedFrames: f.normalizedFrames,
        version: f.version,
        coachName: f.coach?.name,
      })),
    });
  } catch (error) {
    logger.error('Error downloading exercise form', error);
    sendSingleError(res, 'Failed to download exercise form', 500);
  }
};
