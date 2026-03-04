import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  GetExercisesQuery,
  GetRoutinesQuery,
  GetRoutineByIdParams,
  StartWorkoutSessionInput,
  CompleteWorkoutSessionParams,
  CompleteWorkoutSessionInput,
  GetWorkoutSessionsQuery,
  GetWorkoutSessionByIdParams,
  LogSetInput,
  UpdateSetParams,
  UpdateSetInput,
  DeleteSetParams,
  BatchSyncSetsInput,
  GetTodayWorkoutQuery,
  UpdateExerciseParams,
  UpdateExerciseInput,
  DeleteExerciseParams,
  GetWeeklyStatsQuery,
} from '../schemas/workout.schema';
import { MuscleGroup } from '@prisma/client';

// ============== Exercise Controllers ==============

/**
 * Get all exercises with optional filtering.
 * Returns public exercises + the requesting coach's private exercises (if applicable).
 */
export const getExercises = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit, offset, muscleGroup, search } = res.locals.validated
      ?.query as GetExercisesQuery;

    logger.debug('Fetching exercises', { muscleGroup, search, limit, offset });

    // Resolve coach ID if the requester is a coach (for private exercise visibility)
    const coachId = req.coach?.id;

    // Resolve app user ID for user-owned exercise visibility
    const appUserId = req.appUser?.id;

    // Build visibility filter: public exercises OR exercises owned by this coach OR user-owned
    const orFilters: Record<string, unknown>[] = [{ isPublic: true }];
    if (coachId) orFilters.push({ coachId });
    if (appUserId) orFilters.push({ userId: appUserId });
    const visibilityFilter = { OR: orFilters };

    const where: Record<string, unknown> = {
      ...visibilityFilter,
    };

    if (muscleGroup) {
      where.primaryMuscleGroup = muscleGroup.toUpperCase() as MuscleGroup;
    }

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
        primaryMuscleGroup: e.primaryMuscleGroup,
        targetMuscles: e.targetMuscles,
        equipmentNeeded: e.equipmentNeeded,
        coachId: e.coachId,
        isPublic: e.isPublic,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
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
 * Create a new exercise (coach only).
 * Sets coachId to the creating coach and supports isPublic flag.
 */
export const createExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      description,
      primaryMuscleGroup,
      targetMuscles,
      equipmentNeeded,
      isPublic,
    } = res.locals.validated
      ?.body as import('../schemas/workout.schema').CreateExerciseInput;

    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    logger.debug('Creating exercise', {
      name,
      primaryMuscleGroup,
      coachId: coach.id,
      isPublic,
    });

    // Check for duplicate name (within scope: global public OR this coach's exercises)
    const existing = await prisma.exercise.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ isPublic: true }, { coachId: coach.id }],
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
        primaryMuscleGroup: primaryMuscleGroup as MuscleGroup,
        targetMuscles: targetMuscles as import('@prisma/client').TargetMuscle[],
        equipmentNeeded,
        coachId: coach.id,
        isPublic: isPublic ?? true,
      },
    });

    logger.info('Exercise created', {
      exerciseId: exercise.id,
      name,
      coachId: coach.id,
    });

    sendSuccess(
      res,
      {
        exercise: {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description,
          primaryMuscleGroup: exercise.primaryMuscleGroup,
          targetMuscles: exercise.targetMuscles,
          equipmentNeeded: exercise.equipmentNeeded,
          coachId: exercise.coachId,
          isPublic: exercise.isPublic,
          createdAt: exercise.createdAt,
          updatedAt: exercise.updatedAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error creating exercise', error);
    sendSingleError(res, 'Failed to create exercise', 500);
  }
};

// ============== Routine Controllers ==============

/**
 * Get all routines for the user (from their assigned programs)
 */
export const getRoutines = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = req.user?.id; // This is the Supabase ID from JWT
    const { programId, limit, offset } = res.locals.validated
      ?.query as GetRoutinesQuery;

    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    // Find the User record by Supabase ID to get the database user ID
    const user = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    const userId = user.id; // This is the cuid used in AssignedProgram

    logger.debug('Fetching routines for user', {
      userId,
      supabaseId,
      programId,
    });

    // Get routines from user's assigned programs
    const assignedPrograms = await prisma.assignedProgram.findMany({
      where: {
        userId,
        isActive: true,
        ...(programId && { programId }),
      },
      include: {
        program: {
          include: {
            programRoutines: {
              include: {
                routine: {
                  include: {
                    routineExercises: {
                      include: {
                        exercise: true,
                      },
                      orderBy: { orderInRoutine: 'asc' },
                    },
                  },
                },
              },
              orderBy: { dayNumber: 'asc' },
            },
          },
        },
      },
      take: limit,
      skip: offset,
    });

    const routines = assignedPrograms.flatMap((ap) =>
      ap.program.programRoutines.map((pr) => ({
        id: pr.routine.id,
        name: pr.routine.name,
        description: pr.routine.description,
        estimatedDurationMinutes: pr.routine.estimatedDurationMinutes,
        muscleGroupsTargeted: pr.routine.muscleGroupsTargeted,
        dayNumber: pr.dayNumber,
        programId: ap.programId,
        programName: ap.program.name,
        exercises: pr.routine.routineExercises.map((re) => ({
          id: re.id,
          routineId: re.routineId,
          exerciseId: re.exerciseId,
          sets: re.sets,
          repsMin: re.repsMin,
          repsMax: re.repsMax,
          restSeconds: re.restSeconds,
          orderInRoutine: re.orderInRoutine,
          notes: re.notes,
          exercise: {
            id: re.exercise.id,
            name: re.exercise.name,
            description: re.exercise.description,
            primaryMuscleGroup: re.exercise.primaryMuscleGroup,
            equipmentNeeded: re.exercise.equipmentNeeded,
          },
        })),
        createdAt: pr.routine.createdAt,
        updatedAt: pr.routine.updatedAt,
      }))
    );

    logger.info(`Fetched ${routines.length} routines for user ${userId}`);

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
 * Get a single routine by ID
 */
export const getRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { routineId } = res.locals.validated?.params as GetRoutineByIdParams;
    const userId = req.user?.id;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    logger.debug('Fetching routine', { routineId, userId });

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
      include: {
        routineExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderInRoutine: 'asc' },
        },
      },
    });

    if (!routine) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    sendSuccess(res, {
      routine: {
        id: routine.id,
        name: routine.name,
        description: routine.description,
        estimatedDurationMinutes: routine.estimatedDurationMinutes,
        muscleGroupsTargeted: routine.muscleGroupsTargeted,
        exercises: routine.routineExercises.map((re) => ({
          id: re.id,
          exerciseId: re.exerciseId,
          sets: re.sets,
          repsMin: re.repsMin,
          repsMax: re.repsMax,
          restSeconds: re.restSeconds,
          orderInRoutine: re.orderInRoutine,
          notes: re.notes,
          exercise: {
            id: re.exercise.id,
            name: re.exercise.name,
            description: re.exercise.description,
            primaryMuscleGroup: re.exercise.primaryMuscleGroup,
            equipmentNeeded: re.exercise.equipmentNeeded,
          },
        })),
        createdAt: routine.createdAt,
        updatedAt: routine.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching routine', error);
    sendSingleError(res, 'Failed to fetch routine', 500);
  }
};

// ============== Workout Session Controllers ==============

/**
 * Start a new workout session
 */
export const startWorkoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { assignedProgramId } = req.body as StartWorkoutSessionInput;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    logger.info('Starting workout session', {
      userId,
      assignedProgramId,
    });

    // Check if user has an active session
    const activeSession = await prisma.workoutSession.findFirst({
      where: {
        userId,
        completedAt: null,
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

    const session = await prisma.workoutSession.create({
      data: {
        userId,
        assignedProgramId,
        startedAt: new Date(),
      },
      include: {
        performedSets: true,
      },
    });

    logger.info('Workout session started', { sessionId: session.id, userId });

    sendSuccess(
      res,
      {
        session: {
          id: session.id,
          userId: session.userId,
          assignedProgramId: session.assignedProgramId,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          notes: session.notes,
          performedSets: [],
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
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
 * Get the user's active workout session
 */
export const getActiveSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    const session = await prisma.workoutSession.findFirst({
      where: {
        userId,
        completedAt: null,
      },
      include: {
        performedSets: {
          include: {
            routineExercise: {
              include: {
                exercise: true,
              },
            },
          },
          orderBy: [{ routineExerciseId: 'asc' }, { setNumber: 'asc' }],
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
        userId: session.userId,
        assignedProgramId: session.assignedProgramId,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        notes: session.notes,
        performedSets: session.performedSets.map((ps) => ({
          id: ps.id,
          workoutSessionId: ps.workoutSessionId,
          routineExerciseId: ps.routineExerciseId,
          setNumber: ps.setNumber,
          repsCompleted: ps.repsCompleted,
          weightKg: ps.weightKg,
          rpe: ps.rpe,
          notes: ps.notes,
          createdAt: ps.createdAt,
          updatedAt: ps.updatedAt,
        })),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching active session', error);
    sendSingleError(res, 'Failed to fetch active session', 500);
  }
};

/**
 * Complete a workout session
 */
export const completeWorkoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { sessionId } = res.locals.validated
      ?.params as CompleteWorkoutSessionParams;
    const { notes } = res.locals.validated?.body as CompleteWorkoutSessionInput;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    logger.info('Completing workout session', { sessionId, userId });

    // Verify session belongs to user
    const session = await prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      sendSingleError(res, 'Workout session not found', 404);
      return;
    }

    if (session.completedAt) {
      sendSingleError(res, 'Workout session is already completed', 400);
      return;
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        completedAt: new Date(),
        notes,
      },
      include: {
        performedSets: {
          orderBy: [{ routineExerciseId: 'asc' }, { setNumber: 'asc' }],
        },
      },
    });

    logger.info('Workout session completed', {
      sessionId,
      userId,
      duration:
        updatedSession.completedAt!.getTime() -
        updatedSession.startedAt.getTime(),
    });

    sendSuccess(res, {
      session: {
        id: updatedSession.id,
        userId: updatedSession.userId,
        assignedProgramId: updatedSession.assignedProgramId,
        startedAt: updatedSession.startedAt,
        completedAt: updatedSession.completedAt,
        notes: updatedSession.notes,
        performedSets: updatedSession.performedSets.map((ps) => ({
          id: ps.id,
          workoutSessionId: ps.workoutSessionId,
          routineExerciseId: ps.routineExerciseId,
          setNumber: ps.setNumber,
          repsCompleted: ps.repsCompleted,
          weightKg: ps.weightKg,
          rpe: ps.rpe,
          notes: ps.notes,
          createdAt: ps.createdAt,
          updatedAt: ps.updatedAt,
        })),
        createdAt: updatedSession.createdAt,
        updatedAt: updatedSession.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error completing workout session', error);
    sendSingleError(res, 'Failed to complete workout session', 500);
  }
};

/**
 * Get workout session history
 */
export const getWorkoutSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { limit, offset, startDate, endDate } = res.locals.validated
      ?.query as GetWorkoutSessionsQuery;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    const where: Record<string, unknown> = {
      userId,
      completedAt: { not: null },
    };

    if (startDate || endDate) {
      where.startedAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const [sessions, total] = await Promise.all([
      prisma.workoutSession.findMany({
        where,
        include: {
          performedSets: {
            orderBy: [{ routineExerciseId: 'asc' }, { setNumber: 'asc' }],
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.workoutSession.count({ where }),
    ]);

    sendSuccess(res, {
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        assignedProgramId: s.assignedProgramId,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        notes: s.notes,
        totalSets: s.performedSets.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
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
 * Get a single workout session by ID
 */
export const getWorkoutSessionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { sessionId } = res.locals.validated
      ?.params as GetWorkoutSessionByIdParams;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    const session = await prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        performedSets: {
          include: {
            routineExercise: {
              include: {
                exercise: true,
              },
            },
          },
          orderBy: [{ routineExerciseId: 'asc' }, { setNumber: 'asc' }],
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
        userId: session.userId,
        assignedProgramId: session.assignedProgramId,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        notes: session.notes,
        performedSets: session.performedSets.map((ps) => ({
          id: ps.id,
          workoutSessionId: ps.workoutSessionId,
          routineExerciseId: ps.routineExerciseId,
          setNumber: ps.setNumber,
          repsCompleted: ps.repsCompleted,
          weightKg: ps.weightKg,
          rpe: ps.rpe,
          notes: ps.notes,
          exercise: {
            id: ps.routineExercise.exercise.id,
            name: ps.routineExercise.exercise.name,
          },
          createdAt: ps.createdAt,
          updatedAt: ps.updatedAt,
        })),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching workout session', error);
    sendSingleError(res, 'Failed to fetch workout session', 500);
  }
};

// ============== Performed Set Controllers ==============

/**
 * Log a new set
 */
export const logSet = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      workoutSessionId,
      routineExerciseId,
      setNumber,
      repsCompleted,
      weightKg,
      rpe,
      notes,
    } = res.locals.validated?.body as LogSetInput;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    logger.debug('Logging set', {
      userId,
      workoutSessionId,
      routineExerciseId,
      setNumber,
    });

    // Verify session belongs to user and is active
    const session = await prisma.workoutSession.findFirst({
      where: {
        id: workoutSessionId,
        userId,
        completedAt: null,
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

    // Check if set already exists (update instead)
    const existingSet = await prisma.performedSet.findFirst({
      where: {
        workoutSessionId,
        routineExerciseId,
        setNumber,
      },
    });

    let performedSet;

    if (existingSet) {
      // Update existing set
      performedSet = await prisma.performedSet.update({
        where: { id: existingSet.id },
        data: {
          repsCompleted,
          weightKg,
          rpe,
          notes,
        },
      });
      logger.debug('Updated existing set', { setId: performedSet.id });
    } else {
      // Create new set
      performedSet = await prisma.performedSet.create({
        data: {
          workoutSessionId,
          routineExerciseId,
          setNumber,
          repsCompleted,
          weightKg,
          rpe,
          notes,
        },
      });
      logger.debug('Created new set', { setId: performedSet.id });
    }

    sendSuccess(
      res,
      {
        set: {
          id: performedSet.id,
          workoutSessionId: performedSet.workoutSessionId,
          routineExerciseId: performedSet.routineExerciseId,
          setNumber: performedSet.setNumber,
          repsCompleted: performedSet.repsCompleted,
          weightKg: performedSet.weightKg,
          rpe: performedSet.rpe,
          notes: performedSet.notes,
          createdAt: performedSet.createdAt,
          updatedAt: performedSet.updatedAt,
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
 * Update an existing set
 */
export const updateSet = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { setId } = res.locals.validated?.params as UpdateSetParams;
    const { repsCompleted, weightKg, rpe, notes } = res.locals.validated
      ?.body as UpdateSetInput;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    // Verify set belongs to user's session
    const existingSet = await prisma.performedSet.findFirst({
      where: {
        id: setId,
        workoutSession: {
          userId,
        },
      },
    });

    if (!existingSet) {
      sendSingleError(res, 'Set not found or does not belong to you', 404);
      return;
    }

    const updatedSet = await prisma.performedSet.update({
      where: { id: setId },
      data: {
        ...(repsCompleted !== undefined && { repsCompleted }),
        ...(weightKg !== undefined && { weightKg }),
        ...(rpe !== undefined && { rpe }),
        ...(notes !== undefined && { notes }),
      },
    });

    sendSuccess(res, {
      set: {
        id: updatedSet.id,
        workoutSessionId: updatedSet.workoutSessionId,
        routineExerciseId: updatedSet.routineExerciseId,
        setNumber: updatedSet.setNumber,
        repsCompleted: updatedSet.repsCompleted,
        weightKg: updatedSet.weightKg,
        rpe: updatedSet.rpe,
        notes: updatedSet.notes,
        createdAt: updatedSet.createdAt,
        updatedAt: updatedSet.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating set', error);
    sendSingleError(res, 'Failed to update set', 500);
  }
};

/**
 * Delete a set
 */
export const deleteSet = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { setId } = res.locals.validated?.params as DeleteSetParams;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    // Verify set belongs to user's session
    const existingSet = await prisma.performedSet.findFirst({
      where: {
        id: setId,
        workoutSession: {
          userId,
        },
      },
    });

    if (!existingSet) {
      sendSingleError(res, 'Set not found or does not belong to you', 404);
      return;
    }

    await prisma.performedSet.delete({
      where: { id: setId },
    });

    sendSuccess(res, { message: 'Set deleted successfully' });
  } catch (error) {
    logger.error('Error deleting set', error);
    sendSingleError(res, 'Failed to delete set', 500);
  }
};

/**
 * Batch sync sets from offline storage
 */
export const batchSyncSets = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { sets } = res.locals.validated?.body as BatchSyncSetsInput;

    if (!userId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    logger.info('Batch syncing sets', { userId, count: sets.length });

    const results: { localId?: string; serverId: string; success: boolean }[] =
      [];

    for (const set of sets) {
      try {
        // Verify session belongs to user
        const session = await prisma.workoutSession.findFirst({
          where: {
            id: set.workoutSessionId,
            userId,
          },
        });

        if (!session) {
          results.push({
            localId: set.localId,
            serverId: '',
            success: false,
          });
          continue;
        }

        // Upsert the set
        const performedSet = await prisma.performedSet.upsert({
          where: {
            id: set.localId || 'non-existent-id',
          },
          update: {
            repsCompleted: set.repsCompleted,
            weightKg: set.weightKg,
            rpe: set.rpe,
            notes: set.notes,
          },
          create: {
            workoutSessionId: set.workoutSessionId,
            routineExerciseId: set.routineExerciseId,
            setNumber: set.setNumber,
            repsCompleted: set.repsCompleted,
            weightKg: set.weightKg,
            rpe: set.rpe,
            notes: set.notes,
          },
        });

        results.push({
          localId: set.localId,
          serverId: performedSet.id,
          success: true,
        });
      } catch {
        results.push({
          localId: set.localId,
          serverId: '',
          success: false,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info('Batch sync completed', {
      userId,
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
 * Resolve which routine the user should do today based on their assigned program
 * and the program's day cycle.
 */
export const getTodayWorkout = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = req.user?.id;
    const { assignedProgramId: queryProgramId } =
      req.query as unknown as GetTodayWorkoutQuery;

    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    const user = await prisma.user.findUnique({ where: { supabaseId } });
    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    const assignment = await prisma.assignedProgram.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        ...(queryProgramId && { id: queryProgramId }),
      },
      include: {
        program: {
          include: {
            programRoutines: {
              include: {
                routine: {
                  include: {
                    routineExercises: {
                      include: { exercise: true },
                      orderBy: { orderInRoutine: 'asc' },
                    },
                  },
                },
              },
              orderBy: { dayNumber: 'asc' },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!assignment) {
      sendSingleError(res, 'No active program assigned', 404);
      return;
    }

    const programRoutines = assignment.program.programRoutines;
    if (programRoutines.length === 0) {
      sendSuccess(res, {
        today: null,
        isRestDay: true,
        message: 'Program has no routines scheduled',
        assignedProgramId: assignment.id,
        programName: assignment.program.name,
      });
      return;
    }

    const today = new Date();
    const startDate = assignment.startDate;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / msPerDay
    );

    // Program hasn't started yet
    if (daysSinceStart < 0) {
      sendSuccess(res, {
        today: null,
        isRestDay: false,
        message: 'Program has not started yet',
        startDate: assignment.startDate,
        assignedProgramId: assignment.id,
        programName: assignment.program.name,
      });
      return;
    }

    const totalCycleDays = Math.max(
      ...programRoutines.map((pr) => pr.dayNumber)
    );
    const cycleDayNumber = (daysSinceStart % totalCycleDays) + 1;

    logger.debug('Today workout calculation', {
      userId: user.id,
      daysSinceStart,
      totalCycleDays,
      cycleDayNumber,
    });

    const todayProgramRoutine = programRoutines.find(
      (pr) => pr.dayNumber === cycleDayNumber
    );

    if (!todayProgramRoutine) {
      sendSuccess(res, {
        today: null,
        isRestDay: true,
        dayNumber: cycleDayNumber,
        assignedProgramId: assignment.id,
        programName: assignment.program.name,
      });
      return;
    }

    const { routine } = todayProgramRoutine;

    sendSuccess(res, {
      today: {
        programRoutineId: todayProgramRoutine.id,
        dayNumber: todayProgramRoutine.dayNumber,
        assignedProgramId: assignment.id,
        programName: assignment.program.name,
        routine: {
          id: routine.id,
          name: routine.name,
          description: routine.description,
          estimatedDurationMinutes: routine.estimatedDurationMinutes,
          muscleGroupsTargeted: routine.muscleGroupsTargeted,
          exercises: routine.routineExercises.map((re) => ({
            id: re.id,
            exerciseId: re.exerciseId,
            sets: re.sets,
            repsMin: re.repsMin,
            repsMax: re.repsMax,
            restSeconds: re.restSeconds,
            orderInRoutine: re.orderInRoutine,
            notes: re.notes,
            exercise: {
              id: re.exercise.id,
              name: re.exercise.name,
              description: re.exercise.description,
              primaryMuscleGroup: re.exercise.primaryMuscleGroup,
              equipmentNeeded: re.exercise.equipmentNeeded,
            },
          })),
        },
      },
      isRestDay: false,
    });
  } catch (error) {
    logger.error('Error fetching today workout', error);
    sendSingleError(res, 'Failed to fetch today workout', 500);
  }
};

// ============== Exercise Update / Delete Controllers ==============

/**
 * Update an exercise (coach only, must own the exercise).
 */
export const updateExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { exerciseId } = res.locals.validated?.params as UpdateExerciseParams;
    const updates = res.locals.validated?.body as UpdateExerciseInput;

    logger.debug('Updating exercise', {
      exerciseId,
      coachId: coach.id,
      updates,
    });

    // Find exercise and verify ownership
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    // Only the owning coach can update (global exercises with no coachId cannot be edited)
    if (!exercise.coachId || exercise.coachId !== coach.id) {
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
          OR: [{ isPublic: true }, { coachId: coach.id }],
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
        ...(updates.primaryMuscleGroup !== undefined && {
          primaryMuscleGroup: updates.primaryMuscleGroup as MuscleGroup,
        }),
        ...(updates.targetMuscles !== undefined && {
          targetMuscles:
            updates.targetMuscles as import('@prisma/client').TargetMuscle[],
        }),
        ...(updates.equipmentNeeded !== undefined && {
          equipmentNeeded: updates.equipmentNeeded,
        }),
        ...(updates.isPublic !== undefined && { isPublic: updates.isPublic }),
      },
    });

    logger.info('Exercise updated', {
      exerciseId: updated.id,
      coachId: coach.id,
    });

    sendSuccess(res, {
      exercise: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        primaryMuscleGroup: updated.primaryMuscleGroup,
        targetMuscles: updated.targetMuscles,
        equipmentNeeded: updated.equipmentNeeded,
        coachId: updated.coachId,
        isPublic: updated.isPublic,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating exercise', error);
    sendSingleError(res, 'Failed to update exercise', 500);
  }
};

/**
 * Delete an exercise (coach only, must own the exercise).
 * Cascades to RoutineExercise junctions.
 */
export const deleteExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { exerciseId } = res.locals.validated?.params as DeleteExerciseParams;

    logger.debug('Deleting exercise', { exerciseId, coachId: coach.id });

    // Find exercise and verify ownership
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        routineExercises: { select: { id: true } },
      },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    // Only the owning coach can delete
    if (!exercise.coachId || exercise.coachId !== coach.id) {
      sendSingleError(
        res,
        'You do not have permission to delete this exercise',
        403
      );
      return;
    }

    await prisma.exercise.delete({ where: { id: exerciseId } });

    logger.info('Exercise deleted', {
      exerciseId,
      coachId: coach.id,
      affectedRoutines: exercise.routineExercises.length,
    });

    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting exercise', error);
    sendSingleError(res, 'Failed to delete exercise', 500);
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
    const supabaseId = req.user?.id;
    const { weekOf } = res.locals.validated?.query as GetWeeklyStatsQuery;

    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    // Resolve app user
    const user = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    // Determine the week window (Monday–Sunday)
    const referenceDate = weekOf ? new Date(weekOf) : new Date();
    const dayOfWeek = referenceDate.getUTCDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const weekStart = new Date(referenceDate);
    weekStart.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    logger.debug('Fetching weekly stats', {
      userId: user.id,
      weekStart,
      weekEnd,
    });

    // Fetch completed sessions for the week
    const sessions = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        completedAt: { not: null },
        startedAt: { gte: weekStart, lt: weekEnd },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    const workoutsCompleted = sessions.length;

    // Total minutes: sum of (completedAt - startedAt) for each session
    const totalMinutes = sessions.reduce((sum, s) => {
      if (s.completedAt) {
        const durationMs =
          new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
        return sum + Math.round(durationMs / 60000);
      }
      return sum;
    }, 0);

    // Streak: count consecutive days (up to today) that have at least one completed session
    // Look back up to 90 days to find the streak
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const lookbackStart = new Date(today);
    lookbackStart.setUTCDate(today.getUTCDate() - 90);
    lookbackStart.setUTCHours(0, 0, 0, 0);

    const recentSessions = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        completedAt: { not: null },
        startedAt: { gte: lookbackStart, lte: today },
      },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
    });

    // Build a set of unique workout dates (YYYY-MM-DD in UTC)
    const workoutDates = new Set(
      recentSessions.map((s) => s.startedAt.toISOString().slice(0, 10))
    );

    // Count streak backwards from today
    let streakDays = 0;
    const checkDate = new Date(today);
    checkDate.setUTCHours(0, 0, 0, 0);

    while (workoutDates.has(checkDate.toISOString().slice(0, 10))) {
      streakDays++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

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
