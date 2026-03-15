import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { MuscleGroup } from '@prisma/client';
import type {
  CreateRoutineInput,
  GetCoachProgramsQuery,
  GetCoachRoutinesQuery,
  UpdateProgramInput,
  UpdateRoutineInput,
  UpdateProgramRoutineInput,
  AddRoutineExerciseParams,
  AddRoutineExerciseInput,
  UpdateRoutineExerciseInput,
  UpdateProgramRoutineParams,
  RemoveProgramRoutineParams,
  UpdateRoutineExerciseParams,
  RemoveRoutineExerciseParams,
} from '../schemas/program.schema';

// ======= Shared shape helpers =======

const routineShape = (routine: {
  id: string;
  coachId: string | null;
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  muscleGroupsTargeted: MuscleGroup[];
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: routine.id,
  coachId: routine.coachId,
  name: routine.name,
  description: routine.description,
  estimatedDurationMinutes: routine.estimatedDurationMinutes,
  muscleGroupsTargeted: routine.muscleGroupsTargeted,
  createdAt: routine.createdAt,
  updatedAt: routine.updatedAt,
});

const exerciseSlotShape = (re: {
  id: string;
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  orderInRoutine: number;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    description: string;
    primaryMuscleGroup: MuscleGroup;
    equipmentNeeded: string[];
  };
}) => ({
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
});

// ============== Program Controllers ==============

/**
 * Create a new training program.
 */
export const createProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { name, description, customForUserId } =
      req.body as import('../schemas/program.schema').CreateProgramInput;

    // If customForUserId is set, validate the user exists and is in the coach's class
    if (customForUserId) {
      const clientRelation = await prisma.subscribedCoach.findFirst({
        where: { userId: customForUserId, coachId: coach.id, endedAt: null },
      });
      if (!clientRelation) {
        sendSingleError(res, 'Client not found in your class', 404);
        return;
      }
    }

    const program = await prisma.program.create({
      data: {
        name,
        description,
        coachId: coach.id,
        ...(customForUserId && { customForUserId }),
      },
    });

    logger.info('Program created', {
      programId: program.id,
      coachId: coach.id,
    });
    sendSuccess(res, { program }, 201);
  } catch (error) {
    logger.error('Error creating program', error);
    sendSingleError(res, 'Failed to create program', 500);
  }
};

/**
 * List all programs owned by the authenticated coach.
 */
export const getCoachPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const rawQuery = req.query as unknown as GetCoachProgramsQuery;
    const limit = rawQuery.limit ? Number(rawQuery.limit) : 50;
    const offset = rawQuery.offset ? Number(rawQuery.offset) : 0;

    // Use validated query if available; fall back to raw parsed values
    const validatedQuery = res.locals.validated?.query as
      | GetCoachProgramsQuery
      | undefined;
    const includeCustom = validatedQuery?.includeCustom ?? false;

    logger.debug('Fetching programs for coach', {
      coachId: coach.id,
      limit,
      offset,
      includeCustom,
    });

    // By default, exclude custom (one-off) programs from the reusable library view
    const where: Record<string, unknown> = {
      coachId: coach.id,
      ...(!includeCustom && { customForUserId: null }),
    };

    const [programs, total] = await Promise.all([
      prisma.program.findMany({
        where,
        include: {
          _count: { select: { programRoutines: true, assignedPrograms: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.program.count({ where }),
    ]);

    sendSuccess(res, {
      programs: programs.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        customForUserId: p.customForUserId,
        routineCount: p._count.programRoutines,
        assignedClientCount: p._count.assignedPrograms,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + programs.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching coach programs', error);
    sendSingleError(res, 'Failed to fetch programs', 500);
  }
};

/**
 * Get a single program with its full routine/exercise tree.
 */
export const getCoachProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { programId } = req.params as Record<string, string>;

    const program = await prisma.program.findUnique({
      where: { id: programId },
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
    });

    if (!program || program.coachId !== coach.id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    sendSuccess(res, {
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        coachId: program.coachId,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        routines: program.programRoutines.map((pr) => ({
          id: pr.id,
          dayNumber: pr.dayNumber,
          routine: {
            ...routineShape(pr.routine),
            exercises: pr.routine.routineExercises.map(exerciseSlotShape),
          },
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching program', error);
    sendSingleError(res, 'Failed to fetch program', 500);
  }
};

/**
 * Update a program's name or description.
 */
export const updateProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { programId } = req.params as Record<string, string>;
    const { name, description } = req.body as UpdateProgramInput;

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
    if (!existing || existing.coachId !== coach.id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    const program = await prisma.program.update({
      where: { id: programId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });

    logger.info('Program updated', { programId, coachId: coach.id });
    sendSuccess(res, { program });
  } catch (error) {
    logger.error('Error updating program', error);
    sendSingleError(res, 'Failed to update program', 500);
  }
};

/**
 * Delete a program. Cascades to ProgramRoutine records but NOT Routines.
 */
export const deleteProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { programId } = req.params as Record<string, string>;

    const existing = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!existing || existing.coachId !== coach.id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    await prisma.program.delete({ where: { id: programId } });

    logger.info('Program deleted', { programId, coachId: coach.id });
    sendSuccess(res, { message: 'Program deleted successfully' });
  } catch (error) {
    logger.error('Error deleting program', error);
    sendSingleError(res, 'Failed to delete program', 500);
  }
};

// ============== Routine Controllers ==============

/**
 * Create a new reusable routine owned by the coach.
 */
export const createRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const {
      name,
      description,
      estimatedDurationMinutes,
      muscleGroupsTargeted,
    } = req.body as CreateRoutineInput;

    const routine = await prisma.routine.create({
      data: {
        coachId: coach.id,
        name,
        description,
        estimatedDurationMinutes,
        muscleGroupsTargeted: muscleGroupsTargeted as MuscleGroup[],
      },
    });

    logger.info('Routine created', {
      routineId: routine.id,
      coachId: coach.id,
    });
    sendSuccess(res, { routine: routineShape(routine) }, 201);
  } catch (error) {
    logger.error('Error creating routine', error);
    sendSingleError(res, 'Failed to create routine', 500);
  }
};

/**
 * List all routines owned by the authenticated coach.
 */
export const getCoachRoutines = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const rawQuery = req.query as unknown as GetCoachRoutinesQuery;
    const limit = rawQuery.limit ? Number(rawQuery.limit) : 50;
    const offset = rawQuery.offset ? Number(rawQuery.offset) : 0;

    const [routines, total] = await Promise.all([
      prisma.routine.findMany({
        where: { coachId: coach.id },
        include: {
          _count: { select: { routineExercises: true, programRoutines: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.routine.count({ where: { coachId: coach.id } }),
    ]);

    sendSuccess(res, {
      routines: routines.map((r) => ({
        ...routineShape(r),
        exerciseCount: r._count.routineExercises,
        programCount: r._count.programRoutines,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + routines.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching coach routines', error);
    sendSingleError(res, 'Failed to fetch routines', 500);
  }
};

/**
 * Get a single routine with its full exercise list.
 */
export const getCoachRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { routineId } = req.params as Record<string, string>;

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
      include: {
        routineExercises: {
          include: { exercise: true },
          orderBy: { orderInRoutine: 'asc' },
        },
      },
    });

    if (!routine || routine.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    sendSuccess(res, {
      routine: {
        ...routineShape(routine),
        exercises: routine.routineExercises.map(exerciseSlotShape),
      },
    });
  } catch (error) {
    logger.error('Error fetching routine', error);
    sendSingleError(res, 'Failed to fetch routine', 500);
  }
};

/**
 * Update a routine's fields.
 */
export const updateRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { routineId } = req.params as Record<string, string>;
    const {
      name,
      description,
      estimatedDurationMinutes,
      muscleGroupsTargeted,
    } = req.body as UpdateRoutineInput;

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
    if (!existing || existing.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
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

    logger.info('Routine updated', { routineId, coachId: coach.id });
    sendSuccess(res, { routine: routineShape(routine) });
  } catch (error) {
    logger.error('Error updating routine', error);
    sendSingleError(res, 'Failed to update routine', 500);
  }
};

/**
 * Delete a routine. Cascades to RoutineExercise and ProgramRoutine but NOT Exercises.
 */
export const deleteRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { routineId } = req.params as Record<string, string>;

    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    await prisma.routine.delete({ where: { id: routineId } });

    logger.info('Routine deleted', { routineId, coachId: coach.id });
    sendSuccess(res, { message: 'Routine deleted successfully' });
  } catch (error) {
    logger.error('Error deleting routine', error);
    sendSingleError(res, 'Failed to delete routine', 500);
  }
};

// ============== ProgramRoutine Junction Controllers ==============

/**
 * Assign an existing routine to a program day slot.
 * Both program and routine must belong to the authenticated coach.
 */
export const assignRoutineToProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { programId } = req.params as Record<string, string>;
    const { routineId, dayNumber } = req.body;

    const [program, routine] = await Promise.all([
      prisma.program.findUnique({ where: { id: programId } }),
      prisma.routine.findUnique({ where: { id: routineId } }),
    ]);

    if (!program || program.coachId !== coach.id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    if (!routine || routine.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    const assignment = await prisma.programRoutine.create({
      data: { programId, routineId, dayNumber },
    });

    logger.info('Routine assigned to program', {
      programId,
      routineId,
      dayNumber,
    });
    sendSuccess(res, { assignment }, 201);
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
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { programId, programRoutineId } =
      req.params as UpdateProgramRoutineParams;
    const { dayNumber } = req.body as UpdateProgramRoutineInput;

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.coachId !== coach.id) {
      sendSingleError(res, 'Program not found or access denied', 404);
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

    logger.info('ProgramRoutine day updated', { programRoutineId, dayNumber });
    sendSuccess(res, { programRoutine: updated });
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
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { programId, programRoutineId } =
      req.params as RemoveProgramRoutineParams;

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.coachId !== coach.id) {
      sendSingleError(res, 'Program not found or access denied', 404);
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

    logger.info('ProgramRoutine removed', { programRoutineId, programId });
    sendSuccess(res, { message: 'Routine removed from program successfully' });
  } catch (error) {
    logger.error('Error removing program routine', error);
    sendSingleError(res, 'Failed to remove routine from program', 500);
  }
};

// ============== RoutineExercise Junction Controllers ==============

/**
 * Add an exercise (from the global library) to a routine.
 * Verifies the coach owns the routine before adding.
 */
export const addExerciseToRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { routineId } = res.locals.validated
      ?.params as AddRoutineExerciseParams;
    const {
      exerciseId,
      sets,
      repsMin,
      repsMax,
      restSeconds,
      orderInRoutine,
      notes,
    } = res.locals.validated?.body as AddRoutineExerciseInput;

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    // P0 security fix: ownership check
    if (routine.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 403);
      return;
    }

    const routineExercise = await prisma.routineExercise.create({
      data: {
        routineId,
        exerciseId,
        sets,
        repsMin,
        repsMax,
        restSeconds,
        orderInRoutine,
        notes: notes ?? null,
      },
    });

    logger.info('Exercise added to routine', {
      routineId,
      exerciseId,
      coachId: coach.id,
    });
    sendSuccess(res, { routineExercise }, 201);
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
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
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

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine || routine.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
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

    logger.info('RoutineExercise updated', { routineExerciseId, routineId });
    sendSuccess(res, { routineExercise: updated });
  } catch (error) {
    logger.error('Error updating routine exercise', error);
    sendSingleError(res, 'Failed to update routine exercise', 500);
  }
};

/**
 * Remove an exercise slot from a routine. Does NOT delete the Exercise.
 */
export const removeRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { routineId, routineExerciseId } = res.locals.validated
      ?.params as RemoveRoutineExerciseParams;

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine || routine.coachId !== coach.id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
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

    logger.info('RoutineExercise removed', { routineExerciseId, routineId });
    sendSuccess(res, { message: 'Exercise removed from routine successfully' });
  } catch (error) {
    logger.error('Error removing routine exercise', error);
    sendSingleError(res, 'Failed to remove exercise from routine', 500);
  }
};
