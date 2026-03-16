import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { notDeleted, stripDeletedAt } from '../utils/query-helpers';
import { MuscleGroup } from '@prisma/client';
import { calculateStreak } from '../utils/streak';
import { calculateSessionCoins } from '../services/coin-calculation.service';
import type {
  CreatePersonalExerciseInput,
  GetPersonalExercisesQuery,
  UpdatePersonalExerciseParams,
  UpdatePersonalExerciseInput,
  DeletePersonalExerciseParams,
  CreatePersonalRoutineInput,
  GetPersonalRoutinesQuery,
  GetPersonalRoutineByIdParams,
  UpdatePersonalRoutineParams,
  UpdatePersonalRoutineInput,
  DeletePersonalRoutineParams,
  AddExerciseToRoutineParams,
  AddExerciseToRoutineInput,
  UpdateRoutineExerciseParams,
  UpdateRoutineExerciseInput,
  RemoveRoutineExerciseParams,
  CreatePersonalProgramInput,
  GetPersonalProgramsQuery,
  GetPersonalProgramByIdParams,
  UpdatePersonalProgramParams,
  UpdatePersonalProgramInput,
  DeletePersonalProgramParams,
  AssignRoutineToProgramParams,
  AssignRoutineToProgramInput,
  UpdateProgramRoutineParams,
  UpdateProgramRoutineInput,
  RemoveProgramRoutineParams,
  ActivateProgramParams,
  ActivateProgramInput,
  DeactivateProgramParams,
  GetStandaloneTodayQuery,
  StartStandaloneSessionInput,
  CompleteStandaloneSessionParams,
  CompleteStandaloneSessionInput,
  GetStandaloneSessionsQuery,
  GetStandaloneSessionByIdParams,
  GetStandaloneWeeklyStatsQuery,
} from '../schemas/standalone.schema';

// ============== Personal Exercise Controllers ==============

/**
 * Create a personal exercise owned by the authenticated user.
 */
export const createPersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const {
      name,
      description,
      primaryMuscleGroup,
      targetMuscles,
      equipmentNeeded,
      isPublic,
    } = res.locals.validated?.body as CreatePersonalExerciseInput;

    logger.debug('Creating personal exercise', {
      name,
      primaryMuscleGroup,
      userId: appUser.id,
    });

    // Check for duplicate name within scope: public exercises OR this user's exercises
    const existing = await prisma.exercise.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ isPublic: true }, { userId: appUser.id }],
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
        userId: appUser.id,
        isPublic: isPublic ?? false,
      },
    });

    logger.info('Personal exercise created', {
      exerciseId: exercise.id,
      userId: appUser.id,
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
          userId: exercise.userId,
          isPublic: exercise.isPublic,
          createdAt: exercise.createdAt,
          updatedAt: exercise.updatedAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error creating personal exercise', error);
    sendSingleError(res, 'Failed to create exercise', 500);
  }
};

/**
 * List user's own exercises + all public exercises.
 */
export const getPersonalExercises = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { limit, offset, muscleGroup, search } = res.locals.validated
      ?.query as GetPersonalExercisesQuery;

    logger.debug('Fetching personal exercises', {
      userId: appUser.id,
      muscleGroup,
      search,
      limit,
      offset,
    });

    // Public exercises + user's own private exercises
    const visibilityFilter = {
      OR: [{ isPublic: true }, { userId: appUser.id }],
    };

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

    sendSuccess(res, {
      exercises: exercises.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        primaryMuscleGroup: e.primaryMuscleGroup,
        targetMuscles: e.targetMuscles,
        equipmentNeeded: e.equipmentNeeded,
        userId: e.userId,
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
    logger.error('Error fetching personal exercises', error);
    sendSingleError(res, 'Failed to fetch exercises', 500);
  }
};

/**
 * Update a personal exercise (user must own it).
 */
export const updatePersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { exerciseId } = res.locals.validated
      ?.params as UpdatePersonalExerciseParams;
    const updates = res.locals.validated?.body as UpdatePersonalExerciseInput;

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise || exercise.userId !== appUser.id) {
      sendSingleError(res, 'Exercise not found', 404);
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
          OR: [{ isPublic: true }, { userId: appUser.id }],
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

    logger.info('Personal exercise updated', {
      exerciseId: updated.id,
      userId: appUser.id,
    });

    sendSuccess(res, {
      exercise: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        primaryMuscleGroup: updated.primaryMuscleGroup,
        targetMuscles: updated.targetMuscles,
        equipmentNeeded: updated.equipmentNeeded,
        userId: updated.userId,
        isPublic: updated.isPublic,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating personal exercise', error);
    sendSingleError(res, 'Failed to update exercise', 500);
  }
};

/**
 * Delete a personal exercise (user must own it).
 */
export const deletePersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { exerciseId } = res.locals.validated
      ?.params as DeletePersonalExerciseParams;

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise || exercise.userId !== appUser.id) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    await prisma.exercise.delete({ where: { id: exerciseId } });

    logger.info('Personal exercise deleted', {
      exerciseId,
      userId: appUser.id,
    });

    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting personal exercise', error);
    sendSingleError(res, 'Failed to delete exercise', 500);
  }
};

// ============== Personal Routine Controllers ==============

/**
 * Create a personal routine owned by the authenticated user.
 */
export const createPersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const {
      name,
      description,
      estimatedDurationMinutes,
      muscleGroupsTargeted,
    } = res.locals.validated?.body as CreatePersonalRoutineInput;

    const routine = await prisma.routine.create({
      data: {
        userId: appUser.id,
        name,
        description,
        estimatedDurationMinutes,
        muscleGroupsTargeted: muscleGroupsTargeted as MuscleGroup[],
      },
    });

    logger.info('Personal routine created', {
      routineId: routine.id,
      userId: appUser.id,
    });

    sendSuccess(
      res,
      {
        routine: {
          id: routine.id,
          userId: routine.userId,
          name: routine.name,
          description: routine.description,
          estimatedDurationMinutes: routine.estimatedDurationMinutes,
          muscleGroupsTargeted: routine.muscleGroupsTargeted,
          createdAt: routine.createdAt,
          updatedAt: routine.updatedAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error creating personal routine', error);
    sendSingleError(res, 'Failed to create routine', 500);
  }
};

/**
 * List all routines owned by the authenticated user.
 */
export const getPersonalRoutines = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { limit, offset } = res.locals.validated
      ?.query as GetPersonalRoutinesQuery;

    const [routines, total] = await Promise.all([
      prisma.routine.findMany({
        where: { userId: appUser.id },
        include: {
          _count: {
            select: {
              routineExercises: notDeleted,
              programRoutines: notDeleted,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.routine.count({ where: { userId: appUser.id } }),
    ]);

    sendSuccess(res, {
      routines: routines.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        description: r.description,
        estimatedDurationMinutes: r.estimatedDurationMinutes,
        muscleGroupsTargeted: r.muscleGroupsTargeted,
        exerciseCount: r._count.routineExercises,
        programCount: r._count.programRoutines,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + routines.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching personal routines', error);
    sendSingleError(res, 'Failed to fetch routines', 500);
  }
};

/**
 * Get a single routine with exercises (user must own it).
 */
export const getPersonalRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = res.locals.validated
      ?.params as GetPersonalRoutineByIdParams;

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
      include: {
        routineExercises: {
          ...notDeleted,
          include: { exercise: true },
          orderBy: { orderInRoutine: 'asc' },
        },
      },
    });

    if (!routine || routine.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    sendSuccess(res, {
      routine: {
        id: routine.id,
        userId: routine.userId,
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
    logger.error('Error fetching personal routine', error);
    sendSingleError(res, 'Failed to fetch routine', 500);
  }
};

/**
 * Update a personal routine (user must own it).
 */
export const updatePersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = res.locals.validated
      ?.params as UpdatePersonalRoutineParams;
    const {
      name,
      description,
      estimatedDurationMinutes,
      muscleGroupsTargeted,
    } = res.locals.validated?.body as UpdatePersonalRoutineInput;

    if (
      name === undefined &&
      description === undefined &&
      estimatedDurationMinutes === undefined &&
      muscleGroupsTargeted === undefined
    ) {
      sendSingleError(res, 'At least one field must be provided', 400);
      return;
    }

    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    const routine = await prisma.routine.update({
      where: { id: routineId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(estimatedDurationMinutes !== undefined && {
          estimatedDurationMinutes,
        }),
        ...(muscleGroupsTargeted !== undefined && {
          muscleGroupsTargeted: muscleGroupsTargeted as MuscleGroup[],
        }),
      },
    });

    logger.info('Personal routine updated', {
      routineId,
      userId: appUser.id,
    });

    sendSuccess(res, {
      routine: {
        id: routine.id,
        userId: routine.userId,
        name: routine.name,
        description: routine.description,
        estimatedDurationMinutes: routine.estimatedDurationMinutes,
        muscleGroupsTargeted: routine.muscleGroupsTargeted,
        createdAt: routine.createdAt,
        updatedAt: routine.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating personal routine', error);
    sendSingleError(res, 'Failed to update routine', 500);
  }
};

/**
 * Delete a personal routine (user must own it). Cascades to RoutineExercise.
 */
export const deletePersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = res.locals.validated
      ?.params as DeletePersonalRoutineParams;

    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    await prisma.routine.delete({ where: { id: routineId } });

    logger.info('Personal routine deleted', { routineId, userId: appUser.id });
    sendSuccess(res, { message: 'Routine deleted successfully' });
  } catch (error) {
    logger.error('Error deleting personal routine', error);
    sendSingleError(res, 'Failed to delete routine', 500);
  }
};

// ============== Routine Exercise Junction Controllers ==============

/**
 * Add an exercise to a user's routine.
 * Exercise must be public or owned by the user.
 */
export const addExerciseToRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = res.locals.validated
      ?.params as AddExerciseToRoutineParams;
    const data = res.locals.validated?.body as AddExerciseToRoutineInput;

    // Verify routine ownership
    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine || routine.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    // Verify exercise is accessible (public or user-owned)
    const exercise = await prisma.exercise.findUnique({
      where: { id: data.exerciseId },
    });
    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }
    // User can add public exercises or their own private exercises
    // Cannot add coach-private exercises (isPublic=false, coachId set, userId null)
    if (!exercise.isPublic && exercise.userId !== appUser.id) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    const routineExercise = await prisma.routineExercise.create({
      data: {
        routineId,
        exerciseId: data.exerciseId,
        sets: data.sets,
        repsMin: data.repsMin,
        repsMax: data.repsMax,
        restSeconds: data.restSeconds,
        orderInRoutine: data.orderInRoutine,
        notes: data.notes,
      },
    });

    logger.info('Exercise added to personal routine', {
      routineId,
      exerciseId: data.exerciseId,
      userId: appUser.id,
    });
    sendSuccess(res, { routineExercise: stripDeletedAt(routineExercise) }, 201);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      sendSingleError(res, 'This exercise is already in the routine', 409);
      return;
    }
    logger.error('Error adding exercise to routine', error);
    sendSingleError(res, 'Failed to add exercise to routine', 500);
  }
};

/**
 * Update the prescription (sets/reps/rest/order/notes) for an exercise in a routine.
 */
export const updateRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId, routineExerciseId } = res.locals.validated
      ?.params as UpdateRoutineExerciseParams;
    const { sets, repsMin, repsMax, restSeconds, orderInRoutine, notes } = res
      .locals.validated?.body as UpdateRoutineExerciseInput;

    if (
      sets === undefined &&
      repsMin === undefined &&
      repsMax === undefined &&
      restSeconds === undefined &&
      orderInRoutine === undefined &&
      notes === undefined
    ) {
      sendSingleError(res, 'At least one field must be provided', 400);
      return;
    }

    // Verify routine ownership
    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine || routine.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    const routineExercise = await prisma.routineExercise.findUnique({
      where: { id: routineExerciseId },
    });
    if (!routineExercise || routineExercise.routineId !== routineId) {
      sendSingleError(res, 'Routine exercise not found', 404);
      return;
    }

    const updated = await prisma.routineExercise.update({
      where: { id: routineExerciseId },
      data: {
        ...(sets !== undefined && { sets }),
        ...(repsMin !== undefined && { repsMin }),
        ...(repsMax !== undefined && { repsMax }),
        ...(restSeconds !== undefined && { restSeconds }),
        ...(orderInRoutine !== undefined && { orderInRoutine }),
        ...(notes !== undefined && { notes }),
      },
    });

    logger.info('Routine exercise updated', {
      routineExerciseId,
      routineId,
      userId: appUser.id,
    });
    sendSuccess(res, { routineExercise: stripDeletedAt(updated) });
  } catch (error) {
    logger.error('Error updating routine exercise', error);
    sendSingleError(res, 'Failed to update routine exercise', 500);
  }
};

/**
 * Remove an exercise from a routine. Does NOT delete the Exercise.
 */
export const removeRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId, routineExerciseId } = res.locals.validated
      ?.params as RemoveRoutineExerciseParams;

    // Verify routine ownership
    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine || routine.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    const routineExercise = await prisma.routineExercise.findUnique({
      where: { id: routineExerciseId },
    });
    if (!routineExercise || routineExercise.routineId !== routineId) {
      sendSingleError(res, 'Routine exercise not found', 404);
      return;
    }

    await prisma.routineExercise.delete({ where: { id: routineExerciseId } });

    logger.info('Routine exercise removed', {
      routineExerciseId,
      routineId,
      userId: appUser.id,
    });
    sendSuccess(res, { message: 'Exercise removed from routine successfully' });
  } catch (error) {
    logger.error('Error removing routine exercise', error);
    sendSingleError(res, 'Failed to remove exercise from routine', 500);
  }
};

// ============== Personal Program Controllers ==============

/**
 * Create a personal program owned by the authenticated user.
 */
export const createPersonalProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { name, description } = res.locals.validated
      ?.body as CreatePersonalProgramInput;

    const program = await prisma.program.create({
      data: {
        name,
        description,
        userId: appUser.id,
      },
    });

    logger.info('Personal program created', {
      programId: program.id,
      userId: appUser.id,
    });
    sendSuccess(res, { program: stripDeletedAt(program) }, 201);
  } catch (error) {
    logger.error('Error creating personal program', error);
    sendSingleError(res, 'Failed to create program', 500);
  }
};

/**
 * List all programs owned by the authenticated user.
 */
export const getPersonalPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { limit, offset } = res.locals.validated
      ?.query as GetPersonalProgramsQuery;

    const [programs, total] = await Promise.all([
      prisma.program.findMany({
        where: { userId: appUser.id },
        include: {
          _count: {
            select: {
              programRoutines: notDeleted,
              assignedPrograms: notDeleted,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.program.count({ where: { userId: appUser.id } }),
    ]);

    sendSuccess(res, {
      programs: programs.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        userId: p.userId,
        routineCount: p._count.programRoutines,
        assignedCount: p._count.assignedPrograms,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + programs.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching personal programs', error);
    sendSingleError(res, 'Failed to fetch programs', 500);
  }
};

/**
 * Get a single program with its full routine/exercise tree (user must own it).
 */
export const getPersonalProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated
      ?.params as GetPersonalProgramByIdParams;

    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        programRoutines: {
          ...notDeleted,
          include: {
            routine: {
              include: {
                routineExercises: {
                  ...notDeleted,
                  include: { exercise: true },
                  orderBy: { orderInRoutine: 'asc' },
                },
              },
            },
          },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    if (!program || program.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    sendSuccess(res, {
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        userId: program.userId,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        routines: program.programRoutines.map((pr) => ({
          id: pr.id,
          dayNumber: pr.dayNumber,
          routine: {
            id: pr.routine.id,
            name: pr.routine.name,
            description: pr.routine.description,
            estimatedDurationMinutes: pr.routine.estimatedDurationMinutes,
            muscleGroupsTargeted: pr.routine.muscleGroupsTargeted,
            exercises: pr.routine.routineExercises.map((re) => ({
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
            createdAt: pr.routine.createdAt,
            updatedAt: pr.routine.updatedAt,
          },
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching personal program', error);
    sendSingleError(res, 'Failed to fetch program', 500);
  }
};

/**
 * Update a personal program's name or description.
 */
export const updatePersonalProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated
      ?.params as UpdatePersonalProgramParams;
    const { name, description } = res.locals.validated
      ?.body as UpdatePersonalProgramInput;

    if (!name && !description) {
      sendSingleError(
        res,
        'At least one field (name, description) must be provided',
        400
      );
      return;
    }

    const existing = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!existing || existing.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    const program = await prisma.program.update({
      where: { id: programId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });

    logger.info('Personal program updated', {
      programId,
      userId: appUser.id,
    });
    sendSuccess(res, { program: stripDeletedAt(program) });
  } catch (error) {
    logger.error('Error updating personal program', error);
    sendSingleError(res, 'Failed to update program', 500);
  }
};

/**
 * Delete a personal program (user must own it). Cascades to ProgramRoutine.
 */
export const deletePersonalProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated
      ?.params as DeletePersonalProgramParams;

    const existing = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!existing || existing.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    await prisma.program.delete({ where: { id: programId } });

    logger.info('Personal program deleted', { programId, userId: appUser.id });
    sendSuccess(res, { message: 'Program deleted successfully' });
  } catch (error) {
    logger.error('Error deleting personal program', error);
    sendSingleError(res, 'Failed to delete program', 500);
  }
};

// ============== Program Routine Junction Controllers ==============

/**
 * Assign a user's routine to a program day slot.
 * Both program and routine must belong to the authenticated user.
 */
export const assignRoutineToProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated
      ?.params as AssignRoutineToProgramParams;
    const { routineId, dayNumber } = res.locals.validated
      ?.body as AssignRoutineToProgramInput;

    const [program, routine] = await Promise.all([
      prisma.program.findUnique({ where: { id: programId } }),
      prisma.routine.findUnique({ where: { id: routineId } }),
    ]);

    if (!program || program.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    if (!routine || routine.userId !== appUser.id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    const assignment = await prisma.programRoutine.create({
      data: { programId, routineId, dayNumber },
    });

    logger.info('Routine assigned to personal program', {
      programId,
      routineId,
      dayNumber,
      userId: appUser.id,
    });
    sendSuccess(res, { assignment: stripDeletedAt(assignment) }, 201);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      sendSingleError(
        res,
        'This routine is already assigned to this program',
        409
      );
      return;
    }
    logger.error('Error assigning routine to program', error);
    sendSingleError(res, 'Failed to assign routine to program', 500);
  }
};

/**
 * Reassign a routine to a different day number within a program.
 */
export const updateProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId, programRoutineId } = res.locals.validated
      ?.params as UpdateProgramRoutineParams;
    const { dayNumber } = res.locals.validated
      ?.body as UpdateProgramRoutineInput;

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    const programRoutine = await prisma.programRoutine.findUnique({
      where: { id: programRoutineId },
    });
    if (!programRoutine || programRoutine.programId !== programId) {
      sendSingleError(res, 'Program routine not found', 404);
      return;
    }

    const updated = await prisma.programRoutine.update({
      where: { id: programRoutineId },
      data: { dayNumber },
    });

    logger.info('Program routine day updated', {
      programRoutineId,
      dayNumber,
      userId: appUser.id,
    });
    sendSuccess(res, { programRoutine: stripDeletedAt(updated) });
  } catch (error) {
    logger.error('Error updating program routine', error);
    sendSingleError(res, 'Failed to update program routine', 500);
  }
};

/**
 * Remove a routine from a program day slot. Does NOT delete the Routine.
 */
export const removeProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId, programRoutineId } = res.locals.validated
      ?.params as RemoveProgramRoutineParams;

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    const programRoutine = await prisma.programRoutine.findUnique({
      where: { id: programRoutineId },
    });
    if (!programRoutine || programRoutine.programId !== programId) {
      sendSingleError(res, 'Program routine not found', 404);
      return;
    }

    await prisma.programRoutine.delete({ where: { id: programRoutineId } });

    logger.info('Program routine removed', {
      programRoutineId,
      programId,
      userId: appUser.id,
    });
    sendSuccess(res, { message: 'Routine removed from program successfully' });
  } catch (error) {
    logger.error('Error removing program routine', error);
    sendSingleError(res, 'Failed to remove routine from program', 500);
  }
};

// ============== Self-Assignment Controllers ==============

/**
 * Activate (self-assign) a personal program.
 * Creates an AssignedProgram row with userId = self.
 * Only one active standalone assignment at a time.
 */
export const activateProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated?.params as ActivateProgramParams;
    const { startDate } = res.locals.validated?.body as ActivateProgramInput;

    // Verify program ownership
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    // Deactivate any currently active standalone program assignments
    // (only deactivate user-owned programs; leave coach-assigned ones alone)
    const activeAssignments = await prisma.assignedProgram.findMany({
      where: {
        userId: appUser.id,
        isActive: true,
        program: { userId: appUser.id },
      },
    });

    if (activeAssignments.length > 0) {
      await prisma.assignedProgram.updateMany({
        where: {
          id: { in: activeAssignments.map((a) => a.id) },
        },
        data: { isActive: false },
      });
    }

    // Upsert the assignment (user may have previously assigned this program)
    // Compound unique was replaced with partial index — use findFirst + create/update
    const existingAssignment = await prisma.assignedProgram.findFirst({
      where: {
        userId: appUser.id,
        programId,
      },
    });

    let assignment;
    if (existingAssignment) {
      assignment = await prisma.assignedProgram.update({
        where: { id: existingAssignment.id },
        data: {
          isActive: true,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: null,
        },
      });
    } else {
      assignment = await prisma.assignedProgram.create({
        data: {
          userId: appUser.id,
          programId,
          startDate: startDate ? new Date(startDate) : new Date(),
          isActive: true,
        },
      });
    }

    logger.info('Standalone program activated', {
      assignmentId: assignment.id,
      programId,
      userId: appUser.id,
    });

    sendSuccess(res, { assignment: stripDeletedAt(assignment) }, 201);
  } catch (error) {
    logger.error('Error activating standalone program', error);
    sendSingleError(res, 'Failed to activate program', 500);
  }
};

/**
 * Deactivate a personal program assignment.
 */
export const deactivateProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated
      ?.params as DeactivateProgramParams;

    // Verify program ownership
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.userId !== appUser.id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    const assignment = await prisma.assignedProgram.findFirst({
      where: {
        userId: appUser.id,
        programId,
      },
    });

    if (!assignment || !assignment.isActive) {
      sendSingleError(res, 'No active assignment found for this program', 404);
      return;
    }

    const updated = await prisma.assignedProgram.update({
      where: { id: assignment.id },
      data: { isActive: false, endDate: new Date() },
    });

    logger.info('Standalone program deactivated', {
      assignmentId: updated.id,
      programId,
      userId: appUser.id,
    });

    sendSuccess(res, { assignment: stripDeletedAt(updated) });
  } catch (error) {
    logger.error('Error deactivating standalone program', error);
    sendSingleError(res, 'Failed to deactivate program', 500);
  }
};

/**
 * Get the current active standalone program assignment.
 */
export const getActiveProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const assignment = await prisma.assignedProgram.findFirst({
      where: {
        userId: appUser.id,
        isActive: true,
        program: { userId: appUser.id },
      },
      include: {
        program: {
          include: {
            programRoutines: {
              ...notDeleted,
              include: {
                routine: true,
              },
              orderBy: { dayNumber: 'asc' },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    sendSuccess(res, { assignment: stripDeletedAt(assignment) });
  } catch (error) {
    logger.error('Error fetching active standalone program', error);
    sendSingleError(res, 'Failed to fetch active program', 500);
  }
};

// ============== Today's Workout Controller ==============

/**
 * Resolve today's routine from the user's active standalone program.
 * Uses day-cycling logic identical to the coach-assigned version.
 */
export const getStandaloneToday = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { assignedProgramId: queryProgramId } = res.locals.validated
      ?.query as GetStandaloneTodayQuery;

    // Find active standalone assignment (only user-owned programs)
    const assignment = await prisma.assignedProgram.findFirst({
      where: {
        userId: appUser.id,
        isActive: true,
        program: { userId: appUser.id },
        ...(queryProgramId && { id: queryProgramId }),
      },
      include: {
        program: {
          include: {
            programRoutines: {
              ...notDeleted,
              include: {
                routine: {
                  include: {
                    routineExercises: {
                      ...notDeleted,
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
      sendSingleError(res, 'No active standalone program assigned', 404);
      return;
    }

    if (!assignment.program) {
      sendSingleError(res, 'Associated program no longer exists', 404);
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

    logger.debug('Standalone today workout calculation', {
      userId: appUser.id,
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
    logger.error('Error fetching standalone today workout', error);
    sendSingleError(res, 'Failed to fetch today workout', 500);
  }
};

// ============== Standalone Session Controllers ==============

/**
 * Start a standalone workout session (no subscription required).
 */
export const startStandaloneSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { assignedProgramId } = res.locals.validated
      ?.body as StartStandaloneSessionInput;

    // If assignedProgramId provided, validate it belongs to the user and is user-owned
    if (assignedProgramId) {
      const assignment = await prisma.assignedProgram.findUnique({
        where: { id: assignedProgramId },
        include: { program: true },
      });
      if (
        !assignment ||
        assignment.userId !== appUser.id ||
        !assignment.program ||
        assignment.program.userId !== appUser.id
      ) {
        sendSingleError(res, 'Assigned program not found', 404);
        return;
      }
    }

    // Check for active session
    const activeSession = await prisma.workoutSession.findFirst({
      where: {
        userId: appUser.id,
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
        userId: appUser.id,
        assignedProgramId: assignedProgramId || null,
        startedAt: new Date(),
      },
      include: {
        performedSets: true,
      },
    });

    logger.info('Standalone session started', {
      sessionId: session.id,
      userId: appUser.id,
    });

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
    logger.error('Error starting standalone session', error);
    sendSingleError(res, 'Failed to start workout session', 500);
  }
};

/**
 * Get the user's active workout session (standalone context).
 */
export const getStandaloneActiveSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const session = await prisma.workoutSession.findFirst({
      where: {
        userId: appUser.id,
        completedAt: null,
      },
      include: {
        performedSets: {
          ...notDeleted,
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
    logger.error('Error fetching standalone active session', error);
    sendSingleError(res, 'Failed to fetch active session', 500);
  }
};

/**
 * Complete a standalone workout session.
 */
export const completeStandaloneSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { sessionId } = res.locals.validated
      ?.params as CompleteStandaloneSessionParams;
    const { notes } = res.locals.validated
      ?.body as CompleteStandaloneSessionInput;

    const session = await prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId: appUser.id,
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
          ...notDeleted,
          orderBy: [{ routineExerciseId: 'asc' }, { setNumber: 'asc' }],
        },
      },
    });

    logger.info('Standalone session completed', {
      sessionId,
      userId: appUser.id,
    });

    // Award coins for the completed session
    let coinReward = null;
    try {
      coinReward = await calculateSessionCoins(appUser.id, sessionId, prisma);
    } catch (coinError) {
      // Log but don't fail the session completion if coin award fails
      logger.error('Failed to award coins for standalone session', {
        sessionId,
        userId: appUser.id,
        error: coinError,
      });
    }

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
      ...(coinReward ? { coinReward } : {}),
    });
  } catch (error) {
    logger.error('Error completing standalone session', error);
    sendSingleError(res, 'Failed to complete workout session', 500);
  }
};

/**
 * Get standalone workout session history (paginated).
 */
export const getStandaloneSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { limit, offset, startDate, endDate } = res.locals.validated
      ?.query as GetStandaloneSessionsQuery;

    const where: Record<string, unknown> = {
      userId: appUser.id,
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
            ...notDeleted,
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
    logger.error('Error fetching standalone sessions', error);
    sendSingleError(res, 'Failed to fetch workout sessions', 500);
  }
};

/**
 * Get a single standalone workout session by ID.
 */
export const getStandaloneSessionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { sessionId } = res.locals.validated
      ?.params as GetStandaloneSessionByIdParams;

    const session = await prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId: appUser.id,
      },
      include: {
        performedSets: {
          ...notDeleted,
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
          exercise: ps.routineExercise
            ? {
                id: ps.routineExercise.exercise.id,
                name: ps.routineExercise.exercise.name,
              }
            : null,
          createdAt: ps.createdAt,
          updatedAt: ps.updatedAt,
        })),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching standalone session', error);
    sendSingleError(res, 'Failed to fetch workout session', 500);
  }
};

// ============== Standalone Weekly Stats Controller ==============

/**
 * Get weekly workout stats for the authenticated user (standalone context).
 */
export const getStandaloneWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { weekOf } = res.locals.validated
      ?.query as GetStandaloneWeeklyStatsQuery;

    // Determine the week window (Monday–Sunday)
    const referenceDate = weekOf ? new Date(weekOf) : new Date();
    const dayOfWeek = referenceDate.getUTCDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const weekStart = new Date(referenceDate);
    weekStart.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    logger.debug('Fetching standalone weekly stats', {
      userId: appUser.id,
      weekStart,
      weekEnd,
    });

    // Fetch completed sessions for the week
    const sessions = await prisma.workoutSession.findMany({
      where: {
        userId: appUser.id,
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

    const totalMinutes = sessions.reduce((sum, s) => {
      if (s.completedAt) {
        const durationMs =
          new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
        return sum + Math.round(durationMs / 60000);
      }
      return sum;
    }, 0);

    // Streak (shared utility)
    const streakDays = await calculateStreak(appUser.id, new Date(), prisma);

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
    logger.error('Error fetching standalone weekly stats', error);
    sendSingleError(res, 'Failed to fetch weekly stats', 500);
  }
};
