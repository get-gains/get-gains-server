import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  GetExercisesQuery,
  CreateExerciseInput,
  UpdateExerciseParams,
  UpdateExerciseInput,
  DeleteExerciseParams,
  GetRoutinesQuery,
  GetRoutineByIdParams,
  StartWorkoutSessionInput,
  GetTodayWorkoutQuery,
  CompleteWorkoutSessionParams,
  CompleteWorkoutSessionInput,
  GetWorkoutSessionsQuery,
  GetWorkoutSessionByIdParams,
  LogSetInput,
  UpdateSetParams,
  UpdateSetInput,
  DeleteSetParams,
  BatchSyncSetsInput,
  GetWeeklyStatsQuery,
} from '../schemas/workout.schema';
import { calculateStreak } from '../utils/streak';
import { resolveToday } from '../utils/days';
import { calculateSessionCoins } from '../services/coin-calculation.service';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

const getSupabaseId = (req: Request): string | undefined => {
  const user = req.user;
  if (!user) return undefined;
  return 'supabase_auth_id' in user
    ? user.supabase_auth_id
    : (user as AuthenticatedUser).id;
};

// ============== Exercise Controllers ==============

/**
 * Get all exercises with optional filtering.
 * Returns public exercises + exercises owned by the authenticated user.
 */
export const getExercises = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { search, limit, offset } = res.locals.validated
      ?.query as GetExercisesQuery;

    logger.debug('Fetching exercises', { search, limit, offset, supabaseId });

    const where: Record<string, unknown> = {
      OR: [{ is_public: true }, { user_id: supabaseId }],
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [exercises, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
      }),
      prisma.exercise.count({ where }),
    ]);

    logger.info(`Fetched ${exercises.length} exercises`);

    sendSuccess(res, {
      exercises: exercises.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        target_muscles: e.target_muscles,
        is_public: e.is_public,
        user_id: e.user_id,
        created_at: e.created_at,
        updated_at: e.updated_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + exercises.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching exercises', error);
    sendSingleError(res, 'Failed to fetch exercises', 500);
  }
};

/**
 * Create a new exercise. Any authenticated user can create exercises.
 */
export const createExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { name, description, target_muscles, is_public } = res.locals
      .validated?.body as CreateExerciseInput;

    logger.debug('Creating exercise', { name, supabaseId, is_public });

    // Check for duplicate name within scope: global public OR this user's exercises
    const existing = await prisma.exercise.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ is_public: true }, { user_id: supabaseId }],
      },
    });

    if (existing) {
      sendSingleError(
        res,
        'An exercise with this name already exists',
        409,
        'name'
      );
      return;
    }

    const exercise = await prisma.exercise.create({
      data: {
        name,
        description,
        target_muscles: target_muscles ?? [],
        is_public: is_public ?? false,
        user_id: supabaseId,
      },
    });

    logger.info('Exercise created', {
      exerciseId: exercise.id,
      name,
      supabaseId,
    });

    sendSuccess(
      res,
      {
        exercise: {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description,
          target_muscles: exercise.target_muscles,
          is_public: exercise.is_public,
          user_id: exercise.user_id,
          created_at: exercise.created_at,
          updated_at: exercise.updated_at,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error creating exercise', error);
    sendSingleError(res, 'Failed to create exercise', 500);
  }
};

/**
 * Update an exercise. Any authenticated user can update exercises they own.
 */
export const updateExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { exerciseId } = res.locals.validated?.params as UpdateExerciseParams;
    const updates = res.locals.validated?.body as UpdateExerciseInput;

    logger.debug('Updating exercise', { exerciseId, supabaseId, updates });

    // Find exercise and verify ownership
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    if (exercise.user_id !== supabaseId) {
      sendSingleError(
        res,
        'You do not have permission to update this exercise',
        403
      );
      return;
    }

    // Check for duplicate name if name is being changed
    if (
      updates.name &&
      updates.name.toLowerCase() !== exercise.name.toLowerCase()
    ) {
      const duplicate = await prisma.exercise.findFirst({
        where: {
          name: { equals: updates.name, mode: 'insensitive' },
          id: { not: exerciseId },
          OR: [{ is_public: true }, { user_id: supabaseId }],
        },
      });

      if (duplicate) {
        sendSingleError(
          res,
          'An exercise with this name already exists',
          409,
          'name'
        );
        return;
      }
    }

    const updated = await prisma.exercise.update({
      where: { id: exerciseId },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && {
          description: updates.description,
        }),
        ...(updates.target_muscles !== undefined && {
          target_muscles: updates.target_muscles,
        }),
        ...(updates.is_public !== undefined && {
          is_public: updates.is_public,
        }),
      },
    });

    logger.info('Exercise updated', { exerciseId: updated.id, supabaseId });

    sendSuccess(res, {
      exercise: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        target_muscles: updated.target_muscles,
        is_public: updated.is_public,
        user_id: updated.user_id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error updating exercise', error);
    sendSingleError(res, 'Failed to update exercise', 500);
  }
};

/**
 * Delete an exercise. Any authenticated user can delete exercises they own.
 */
export const deleteExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { exerciseId } = res.locals.validated?.params as DeleteExerciseParams;

    logger.debug('Deleting exercise', { exerciseId, supabaseId });

    // Find exercise and verify ownership
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    if (exercise.user_id !== supabaseId) {
      sendSingleError(
        res,
        'You do not have permission to delete this exercise',
        403
      );
      return;
    }

    await prisma.exercise.delete({ where: { id: exerciseId } });

    logger.info('Exercise deleted', { exerciseId, supabaseId });

    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting exercise', error);
    sendSingleError(res, 'Failed to delete exercise', 500);
  }
};

// ============== Routine Controllers ==============

/**
 * Get all routines for the user (from their assigned programs).
 */
export const getRoutines = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { programId, limit, offset } = res.locals.validated
      ?.query as GetRoutinesQuery;

    logger.debug('Fetching routines for user', { supabaseId, programId });

    const assignedPrograms = await prisma.assigned_program.findMany({
      where: {
        user_id: supabaseId,
        OR: [{ end_date: null }, { end_date: { gt: new Date() } }],
        ...(programId && { program_id: programId }),
      },
      include: {
        program: true,
        assigned_program_routines: {
          include: {
            routine: { select: { name: true, description: true } },
            assigned_program_routine_exercises: {
              include: { exercise: true },
              orderBy: { order_in_routine: 'asc' },
            },
          },
        },
      },
      take: limit,
      skip: offset,
    });

    const routines = assignedPrograms.flatMap((ap) =>
      ap.assigned_program_routines.map((apr) => ({
        id: apr.id,
        routineId: apr.routine_id,
        routineName: apr.routine.name,
        routineDescription: apr.routine.description,
        daysOfWeek: apr.days_of_week,
        programId: ap.program_id,
        programName: ap.program.name,
        exercises: apr.assigned_program_routine_exercises.map((apre) => ({
          id: apre.id,
          exerciseId: apre.exercise_id,
          sets: apre.sets,
          repsMin: apre.reps_min,
          repsMax: apre.reps_max,
          restSeconds: apre.rest_seconds,
          orderInRoutine: apre.order_in_routine,
          exercise: {
            id: apre.exercise.id,
            name: apre.exercise.name,
            description: apre.exercise.description,
          },
        })),
      }))
    );

    logger.info(`Fetched ${routines.length} routines for user ${supabaseId}`);

    sendSuccess(res, {
      routines,
      total: routines.length,
    });
  } catch (error) {
    logger.error('Error fetching routines', error);
    sendSingleError(res, 'Failed to fetch routines', 500);
  }
};

/**
 * Get a single assigned program routine by ID.
 */
export const getRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { assignedProgramRoutineId } = res.locals.validated
      ?.params as GetRoutineByIdParams;

    logger.debug('Fetching routine', { assignedProgramRoutineId, supabaseId });

    const apr = await prisma.assigned_program_routine.findFirst({
      where: {
        id: assignedProgramRoutineId,
        assigned_program: { user_id: supabaseId },
      },
      include: {
        routine: { select: { name: true, description: true } },
        assigned_program_routine_exercises: {
          include: { exercise: true },
          orderBy: { order_in_routine: 'asc' },
        },
      },
    });

    if (!apr) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    sendSuccess(res, {
      routine: {
        id: apr.id,
        routineId: apr.routine_id,
        routineName: apr.routine.name,
        daysOfWeek: apr.days_of_week,
        exercises: apr.assigned_program_routine_exercises.map((apre) => ({
          id: apre.id,
          exerciseId: apre.exercise_id,
          sets: apre.sets,
          repsMin: apre.reps_min,
          repsMax: apre.reps_max,
          restSeconds: apre.rest_seconds,
          orderInRoutine: apre.order_in_routine,
          exercise: {
            id: apre.exercise.id,
            name: apre.exercise.name,
            description: apre.exercise.description,
            target_muscles: apre.exercise.target_muscles,
          },
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching routine', error);
    sendSingleError(res, 'Failed to fetch routine', 500);
  }
};

// ============== Workout Session Controllers ==============

/**
 * Start a new workout session tied to an assigned program routine.
 */
export const startWorkoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { assignedProgramRoutineId } = res.locals.validated
      ?.body as StartWorkoutSessionInput;

    logger.info('Starting workout session', {
      supabaseId,
      assignedProgramRoutineId,
    });

    // Verify the routine belongs to this user
    const routine = await prisma.assigned_program_routine.findFirst({
      where: {
        id: assignedProgramRoutineId,
        assigned_program: { user_id: supabaseId },
      },
    });

    if (!routine) {
      sendSingleError(res, 'Assigned program routine not found', 404);
      return;
    }

    // Check if user already has an active session
    const activeSession = await prisma.workout_session.findFirst({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: null,
        deleted_at: null,
      },
    });

    if (activeSession) {
      sendSingleError(
        res,
        'You already have an active workout session. Please complete or cancel it first.',
        409
      );
      return;
    }

    const session = await prisma.workout_session.create({
      data: {
        assigned_program_routine_id: assignedProgramRoutineId,
        started_at: new Date(),
      },
    });

    logger.info('Workout session started', {
      sessionId: session.id,
      supabaseId,
    });

    sendSuccess(
      res,
      {
        session: {
          id: session.id,
          assignedProgramRoutineId: session.assigned_program_routine_id,
          startedAt: session.started_at,
          completedAt: session.completed_at,
          feedback: session.feedback,
          performedSets: [],
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error starting workout session', error);
    sendSingleError(res, 'Failed to start workout session', 500);
  }
};

/**
 * Get the user's active (incomplete) workout session.
 */
export const getActiveSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    const session = await prisma.workout_session.findFirst({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: null,
        deleted_at: null,
      },
      include: {
        performed_sets: {
          include: {
            assigned_program_routine_exercise: { include: { exercise: true } },
          },
          orderBy: [
            { assigned_program_routine_exercise_id: 'asc' },
            { set_number: 'asc' },
          ],
        },
      },
    });

    if (!session) {
      sendSuccess(res, { session: null });
      return;
    }

    sendSuccess(res, {
      session: {
        id: session.id,
        assignedProgramRoutineId: session.assigned_program_routine_id,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        feedback: session.feedback,
        performedSets: session.performed_sets.map((ps) => ({
          id: ps.id,
          workoutSessionId: ps.workout_session_id,
          assignedProgramRoutineExerciseId:
            ps.assigned_program_routine_exercise_id,
          setNumber: ps.set_number,
          reps: ps.reps,
          weight: ps.weight,
          overallScore: ps.overall_score,
          recordedFramesKey: ps.recorded_frames_key,
          completedAt: ps.completed_at,
          exercise: {
            id: ps.assigned_program_routine_exercise.exercise.id,
            name: ps.assigned_program_routine_exercise.exercise.name,
          },
          createdAt: ps.created_at,
          updatedAt: ps.updated_at,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching active session', error);
    sendSingleError(res, 'Failed to fetch active session', 500);
  }
};

/**
 * Complete a workout session and award coins.
 */
export const completeWorkoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { sessionId } = res.locals.validated
      ?.params as CompleteWorkoutSessionParams;
    const { feedback } = res.locals.validated
      ?.body as CompleteWorkoutSessionInput;

    logger.info('Completing workout session', { sessionId, supabaseId });

    // Verify session belongs to user via relational path
    const session = await prisma.workout_session.findFirst({
      where: {
        id: sessionId,
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
      },
    });

    if (!session) {
      sendSingleError(res, 'Workout session not found', 404);
      return;
    }

    if (session.completed_at) {
      sendSingleError(res, 'Workout session is already completed', 400);
      return;
    }

    const updatedSession = await prisma.workout_session.update({
      where: { id: sessionId },
      data: {
        completed_at: new Date(),
        feedback,
      },
      include: {
        performed_sets: {
          orderBy: [
            { assigned_program_routine_exercise_id: 'asc' },
            { set_number: 'asc' },
          ],
        },
      },
    });

    const duration = updatedSession.started_at
      ? updatedSession.completed_at!.getTime() -
        updatedSession.started_at.getTime()
      : 0;

    logger.info('Workout session completed', {
      sessionId,
      supabaseId,
      duration,
    });

    // Award coins for the completed session
    let coinReward = null;
    try {
      coinReward = await calculateSessionCoins(supabaseId, sessionId, prisma);
    } catch (coinError) {
      logger.error('Failed to award coins for session', {
        sessionId,
        supabaseId,
        error: coinError,
      });
    }

    sendSuccess(res, {
      session: {
        id: updatedSession.id,
        assignedProgramRoutineId: updatedSession.assigned_program_routine_id,
        startedAt: updatedSession.started_at,
        completedAt: updatedSession.completed_at,
        feedback: updatedSession.feedback,
        performedSets: updatedSession.performed_sets.map((ps) => ({
          id: ps.id,
          workoutSessionId: ps.workout_session_id,
          assignedProgramRoutineExerciseId:
            ps.assigned_program_routine_exercise_id,
          setNumber: ps.set_number,
          reps: ps.reps,
          weight: ps.weight,
          overallScore: ps.overall_score,
          recordedFramesKey: ps.recorded_frames_key,
          completedAt: ps.completed_at,
          createdAt: ps.created_at,
          updatedAt: ps.updated_at,
        })),
        createdAt: updatedSession.created_at,
        updatedAt: updatedSession.updated_at,
      },
      ...(coinReward ? { coinReward } : {}),
    });
  } catch (error) {
    logger.error('Error completing workout session', error);
    sendSingleError(res, 'Failed to complete workout session', 500);
  }
};

/**
 * Get workout session history (completed sessions).
 */
export const getWorkoutSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { limit, offset, startDate, endDate } = res.locals.validated
      ?.query as GetWorkoutSessionsQuery;

    const where: Record<string, unknown> = {
      assigned_program_routine: { assigned_program: { user_id: supabaseId } },
      completed_at: { not: null },
      deleted_at: null,
    };

    // started_at can be null, so only apply date filter if both provided
    if (startDate && endDate) {
      where.started_at = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [sessions, total] = await Promise.all([
      prisma.workout_session.findMany({
        where,
        include: {
          performed_sets: true,
        },
        orderBy: { completed_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.workout_session.count({ where }),
    ]);

    sendSuccess(res, {
      sessions: sessions.map((s) => ({
        id: s.id,
        assignedProgramRoutineId: s.assigned_program_routine_id,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        feedback: s.feedback,
        totalSets: s.performed_sets.length,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + sessions.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching workout sessions', error);
    sendSingleError(res, 'Failed to fetch workout sessions', 500);
  }
};

/**
 * Get a single workout session by ID.
 */
export const getWorkoutSessionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { sessionId } = res.locals.validated
      ?.params as GetWorkoutSessionByIdParams;

    const session = await prisma.workout_session.findFirst({
      where: {
        id: sessionId,
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
      },
      include: {
        performed_sets: {
          include: {
            assigned_program_routine_exercise: { include: { exercise: true } },
          },
          orderBy: [
            { assigned_program_routine_exercise_id: 'asc' },
            { set_number: 'asc' },
          ],
        },
      },
    });

    if (!session) {
      sendSingleError(res, 'Workout session not found', 404);
      return;
    }

    sendSuccess(res, {
      session: {
        id: session.id,
        assignedProgramRoutineId: session.assigned_program_routine_id,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        feedback: session.feedback,
        performedSets: session.performed_sets.map((ps) => ({
          id: ps.id,
          workoutSessionId: ps.workout_session_id,
          assignedProgramRoutineExerciseId:
            ps.assigned_program_routine_exercise_id,
          setNumber: ps.set_number,
          reps: ps.reps,
          weight: ps.weight,
          overallScore: ps.overall_score,
          recordedFramesKey: ps.recorded_frames_key,
          completedAt: ps.completed_at,
          exercise: {
            id: ps.assigned_program_routine_exercise.exercise.id,
            name: ps.assigned_program_routine_exercise.exercise.name,
          },
          createdAt: ps.created_at,
          updatedAt: ps.updated_at,
        })),
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching workout session', error);
    sendSingleError(res, 'Failed to fetch workout session', 500);
  }
};

// ============== Performed Set Controllers ==============

/**
 * Log a performed set. Creates or updates based on (sessionId, exerciseId, setNumber).
 */
export const logSet = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const {
      workoutSessionId,
      assignedProgramRoutineExerciseId,
      set_number,
      reps,
      weight,
      overallScore,
      recordedFramesKey,
      completedAt,
    } = res.locals.validated?.body as LogSetInput;

    logger.debug('Logging set', {
      supabaseId,
      workoutSessionId,
      assignedProgramRoutineExerciseId,
      set_number,
    });

    // Verify session belongs to user and is active (not completed)
    const session = await prisma.workout_session.findFirst({
      where: {
        id: workoutSessionId,
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: null,
      },
    });

    if (!session) {
      sendSingleError(
        res,
        'Active workout session not found or does not belong to you',
        404
      );
      return;
    }

    // Check if set already exists (update instead of create)
    const existingSet = await prisma.performed_set.findFirst({
      where: {
        workout_session_id: workoutSessionId,
        assigned_program_routine_exercise_id: assignedProgramRoutineExerciseId,
        set_number,
      },
    });

    let performedSet;

    if (existingSet) {
      performedSet = await prisma.performed_set.update({
        where: { id: existingSet.id },
        data: {
          reps,
          weight,
          overall_score: overallScore,
          recorded_frames_key: recordedFramesKey,
          completed_at: new Date(completedAt),
        },
      });
      logger.debug('Updated existing set', { setId: performedSet.id });
    } else {
      performedSet = await prisma.performed_set.create({
        data: {
          workout_session_id: workoutSessionId,
          assigned_program_routine_exercise_id:
            assignedProgramRoutineExerciseId,
          set_number,
          reps,
          weight,
          overall_score: overallScore,
          recorded_frames_key: recordedFramesKey,
          completed_at: new Date(completedAt),
        },
      });
      logger.debug('Created new set', { setId: performedSet.id });
    }

    sendSuccess(
      res,
      {
        set: {
          id: performedSet.id,
          workoutSessionId: performedSet.workout_session_id,
          assignedProgramRoutineExerciseId:
            performedSet.assigned_program_routine_exercise_id,
          setNumber: performedSet.set_number,
          reps: performedSet.reps,
          weight: performedSet.weight,
          overallScore: performedSet.overall_score,
          recordedFramesKey: performedSet.recorded_frames_key,
          completedAt: performedSet.completed_at,
          createdAt: performedSet.created_at,
          updatedAt: performedSet.updated_at,
        },
      },
      existingSet ? 200 : 201
    );
  } catch (error) {
    logger.error('Error logging set', error);
    sendSingleError(res, 'Failed to log set', 500);
  }
};

/**
 * Update an existing set (weight only).
 */
export const updateSet = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { setId } = res.locals.validated?.params as UpdateSetParams;
    const { weight } = res.locals.validated?.body as UpdateSetInput;

    // Verify set belongs to user's session via relational path
    const existingSet = await prisma.performed_set.findFirst({
      where: {
        id: setId,
        workout_session: {
          assigned_program_routine: {
            assigned_program: { user_id: supabaseId },
          },
        },
      },
    });

    if (!existingSet) {
      sendSingleError(res, 'Set not found or does not belong to you', 404);
      return;
    }

    const updatedSet = await prisma.performed_set.update({
      where: { id: setId },
      data: {
        ...(weight !== undefined && { weight }),
      },
    });

    sendSuccess(res, {
      set: {
        id: updatedSet.id,
        workoutSessionId: updatedSet.workout_session_id,
        assignedProgramRoutineExerciseId:
          updatedSet.assigned_program_routine_exercise_id,
        setNumber: updatedSet.set_number,
        reps: updatedSet.reps,
        weight: updatedSet.weight,
        overallScore: updatedSet.overall_score,
        recordedFramesKey: updatedSet.recorded_frames_key,
        completedAt: updatedSet.completed_at,
        createdAt: updatedSet.created_at,
        updatedAt: updatedSet.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error updating set', error);
    sendSingleError(res, 'Failed to update set', 500);
  }
};

/**
 * Delete a set.
 */
export const deleteSet = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { setId } = res.locals.validated?.params as DeleteSetParams;

    // Verify set belongs to user's session via relational path
    const existingSet = await prisma.performed_set.findFirst({
      where: {
        id: setId,
        workout_session: {
          assigned_program_routine: {
            assigned_program: { user_id: supabaseId },
          },
        },
      },
    });

    if (!existingSet) {
      sendSingleError(res, 'Set not found or does not belong to you', 404);
      return;
    }

    await prisma.performed_set.delete({ where: { id: setId } });

    logger.info('Set deleted', { setId, supabaseId });

    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting set', error);
    sendSingleError(res, 'Failed to delete set', 500);
  }
};

/**
 * Batch sync sets from offline storage.
 */
export const batchSyncSets = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { sets } = res.locals.validated?.body as BatchSyncSetsInput;

    logger.info('Batch syncing sets', { supabaseId, count: sets.length });

    const results: { localId?: string; serverId: string; success: boolean }[] =
      [];

    for (const set of sets) {
      try {
        // Verify session belongs to user via relational path
        const session = await prisma.workout_session.findFirst({
          where: {
            id: set.workoutSessionId,
            assigned_program_routine: {
              assigned_program: { user_id: supabaseId },
            },
          },
        });

        if (!session) {
          results.push({ localId: set.localId, serverId: '', success: false });
          continue;
        }

        // Upsert: find by composite key, then update or create
        const existing = await prisma.performed_set.findFirst({
          where: {
            workout_session_id: set.workoutSessionId,
            assigned_program_routine_exercise_id:
              set.assignedProgramRoutineExerciseId,
            set_number: set.set_number,
          },
        });

        let performedSet;
        if (existing) {
          performedSet = await prisma.performed_set.update({
            where: { id: existing.id },
            data: {
              reps: set.reps,
              weight: set.weight,
              overall_score: set.overallScore,
              recorded_frames_key: set.recordedFramesKey,
              completed_at: new Date(set.completedAt),
            },
          });
        } else {
          performedSet = await prisma.performed_set.create({
            data: {
              workout_session_id: set.workoutSessionId,
              assigned_program_routine_exercise_id:
                set.assignedProgramRoutineExerciseId,
              set_number: set.set_number,
              reps: set.reps,
              weight: set.weight,
              overall_score: set.overallScore,
              recorded_frames_key: set.recordedFramesKey,
              completed_at: new Date(set.completedAt),
            },
          });
        }

        results.push({
          localId: set.localId,
          serverId: performedSet.id,
          success: true,
        });
      } catch {
        results.push({ localId: set.localId, serverId: '', success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info('Batch sync completed', {
      supabaseId,
      total: sets.length,
      success: successCount,
    });

    sendSuccess(res, {
      results,
      summary: {
        total: sets.length,
        success: successCount,
        failed: sets.length - successCount,
      },
    });
  } catch (error) {
    logger.error('Error batch syncing sets', error);
    sendSingleError(res, 'Failed to sync sets', 500);
  }
};

// ============== Today's Workout Controller ==============

/**
 * Resolve which routine(s) the user should do today based on days_of_week.
 */
export const getTodayWorkout = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    // GetTodayWorkoutQuery is empty — no fields needed
    void (res.locals.validated?.query as GetTodayWorkoutQuery);

    logger.debug('Fetching today workout', { supabaseId });

    const todayName = resolveToday().dayName;

    // Find active assigned programs, most recent first
    const assignments = await prisma.assigned_program.findMany({
      where: {
        user_id: supabaseId,
        OR: [{ end_date: null }, { end_date: { gt: new Date() } }],
      },
      include: {
        program: { select: { name: true } },
        assigned_program_routines: {
          include: {
            routine: { select: { name: true, description: true } },
            assigned_program_routine_exercises: {
              include: { exercise: true },
              orderBy: { order_in_routine: 'asc' },
            },
          },
        },
      },
      orderBy: { start_date: 'desc' },
    });

    if (assignments.length === 0) {
      sendSingleError(res, 'No active program assigned', 404);
      return;
    }

    // Use the most recent active assignment
    const assignment = assignments[0];

    // Find routines scheduled for today
    const todayRoutines = assignment.assigned_program_routines.filter((apr) =>
      apr.days_of_week.includes(todayName)
    );

    if (todayRoutines.length === 0) {
      sendSuccess(res, {
        today: null,
        isRestDay: true,
        assignedProgramId: assignment.id,
        programName: assignment.program.name,
      });
      return;
    }

    // Check if user has already completed a session today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const completedSession = await prisma.workout_session.findFirst({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: { gte: todayStart },
      },
      select: { id: true },
    });
    const completedToday = completedSession !== null;

    // Return the first today routine (primary)
    const todayRoutine = todayRoutines[0];

    sendSuccess(res, {
      today: {
        assignedProgramRoutineId: todayRoutine.id,
        daysOfWeek: todayRoutine.days_of_week,
        assignedProgramId: assignment.id,
        programName: assignment.program.name,
        routine: {
          id: todayRoutine.routine_id,
          name: todayRoutine.routine.name,
          description: todayRoutine.routine.description,
          exercises: todayRoutine.assigned_program_routine_exercises.map(
            (apre) => ({
              id: apre.id,
              exerciseId: apre.exercise_id,
              sets: apre.sets,
              repsMin: apre.reps_min,
              repsMax: apre.reps_max,
              restSeconds: apre.rest_seconds,
              orderInRoutine: apre.order_in_routine,
              exercise: {
                id: apre.exercise.id,
                name: apre.exercise.name,
                description: apre.exercise.description,
                target_muscles: apre.exercise.target_muscles,
              },
            })
          ),
        },
      },
      isRestDay: false,
      completedToday,
    });
  } catch (error) {
    logger.error('Error fetching today workout', error);
    sendSingleError(res, 'Failed to fetch today workout', 500);
  }
};

// ============== Weekly Stats Controller ==============

/**
 * Get weekly workout stats for the authenticated user.
 * Returns: workoutsCompleted, totalMinutes, streakDays.
 */
export const getWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = getSupabaseId(req);
    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }
    const { weekOf } = res.locals.validated?.query as GetWeeklyStatsQuery;

    // Determine the week window (Monday–Sunday)
    const referenceDate = weekOf ? new Date(weekOf) : new Date();
    const dayOfWeek = referenceDate.getUTCDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const weekStart = new Date(referenceDate);
    weekStart.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    logger.debug('Fetching weekly stats', { supabaseId, weekStart, weekEnd });

    // Fetch completed sessions for the week via relational path
    const sessions = await prisma.workout_session.findMany({
      where: {
        assigned_program_routine: { assigned_program: { user_id: supabaseId } },
        completed_at: { not: null },
        started_at: { gte: weekStart, lt: weekEnd },
      },
      select: { started_at: true, completed_at: true },
      orderBy: { started_at: 'asc' },
    });

    const workoutsCompleted = sessions.length;

    // Guard started_at nullable when computing totalMinutes
    const totalMinutes = sessions.reduce((sum, s) => {
      if (s.started_at && s.completed_at) {
        return (
          sum +
          Math.round(
            (s.completed_at.getTime() - s.started_at.getTime()) / 60000
          )
        );
      }
      return sum;
    }, 0);

    // Streak uses supabaseId (= user_id in assigned_program)
    const streakDays = await calculateStreak(supabaseId, new Date(), prisma);

    sendSuccess(res, {
      stats: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        workoutsCompleted,
        totalMinutes,
        streakDays,
      },
    });
  } catch (error) {
    logger.error('Error fetching weekly stats', error);
    sendSingleError(res, 'Failed to fetch weekly stats', 500);
  }
};
