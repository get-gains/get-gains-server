import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { createAssignment } from '../services/assignment.service';
import type {
  CreateRoutineInput,
  GetCoachProgramsQuery,
  GetCoachRoutinesQuery,
  UpdateProgramInput,
  UpdateRoutineInput,
  AssignRoutineInput,
  AssignRoutineParams,
  UpdateProgramRoutineInput,
  UpdateProgramRoutineParams,
  RemoveProgramRoutineParams,
  AddRoutineExerciseInput,
  AddRoutineExerciseParams,
  UpdateRoutineExerciseInput,
  UpdateRoutineExerciseParams,
  DeleteRoutineExerciseParams,
  AssignProgramInput,
  AssignProgramParams,
} from '../schemas/program.schema';

// ============== Shape helpers ==============

const routineShape = (routine: {
  id: string;
  user_id: string;
  name: string;
  description: string;
  estimated_duration_minutes: number;
  created_at: Date;
  updated_at: Date;
}) => ({
  id: routine.id,
  user_id: routine.user_id,
  name: routine.name,
  description: routine.description,
  estimated_duration_minutes: routine.estimated_duration_minutes,
  created_at: routine.created_at,
  updated_at: routine.updated_at,
});

const routineExerciseShape = (routineExercise: {
  id: string;
  routine_id: string;
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  order_in_routine: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  exercise?: {
    id: string;
    name: string;
    description: string;
    target_muscles: string[];
    created_at: Date;
    updated_at: Date;
  };
}) => ({
  id: routineExercise.id,
  routine_id: routineExercise.routine_id,
  exercise_id: routineExercise.exercise_id,
  sets: routineExercise.sets,
  reps_min: routineExercise.reps_min,
  reps_max: routineExercise.reps_max,
  rest_seconds: routineExercise.rest_seconds,
  order_in_routine: routineExercise.order_in_routine,
  notes: routineExercise.notes,
  created_at: routineExercise.created_at,
  updated_at: routineExercise.updated_at,
  exercise: routineExercise.exercise
    ? {
        id: routineExercise.exercise.id,
        name: routineExercise.exercise.name,
        description: routineExercise.exercise.description,
        target_muscles: routineExercise.exercise.target_muscles,
        created_at: routineExercise.exercise.created_at,
        updated_at: routineExercise.exercise.updated_at,
      }
    : undefined,
});

const programRoutineShape = (programRoutine: {
  id: string;
  program_id: string;
  routine_id: string;
  day_of_week: string;
  created_at: Date;
  updated_at: Date;
}) => ({
  id: programRoutine.id,
  programId: programRoutine.program_id,
  routineId: programRoutine.routine_id,
  dayOfWeek: programRoutine.day_of_week,
  createdAt: programRoutine.created_at,
  updatedAt: programRoutine.updated_at,
});

const getRoutineExerciseModel = () =>
  ((prisma as any).routine_exercise ?? (prisma as any).routineExercise) as any;

// ============== Program Controllers ==============

export const createProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { name, description } =
      req.body as import('../schemas/program.schema').CreateProgramInput;

    const program = await prisma.program.create({
      data: { user_id: appUser.supabase_auth_id, name, description },
    });

    logger.info('Program created', {
      programId: program.id,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { program }, 201);
  } catch (error) {
    logger.error('Error creating program', error);
    sendSingleError(res, 'Failed to create program', 500);
  }
};

export const getCoachPrograms = async (
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
      ?.query as GetCoachProgramsQuery;

    const [programs, total] = await Promise.all([
      prisma.program.findMany({
        where: { user_id: appUser.supabase_auth_id },
        include: { _count: { select: { assigned_programs: true } } },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.program.count({ where: { user_id: appUser.supabase_auth_id } }),
    ]);

    sendSuccess(res, {
      programs: programs.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        assigned_client_count: p._count.assigned_programs,
        created_at: p.created_at,
        updated_at: p.updated_at,
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

export const getCoachProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = req.params as Record<string, string>;

    const program = (await prisma.program.findUnique({
      where: { id: programId },
      include: {
        program_routines: {
          orderBy: { created_at: 'asc' },
          include: {
            routine: {
              include: {
                routine_exercises: {
                  orderBy: { order_in_routine: 'asc' },
                  include: { exercise: true },
                },
              },
            },
          },
        },
      },
    } as any)) as any;

    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    const programRoutines = ((program as any).program_routines ??
      (program as any).programRoutines ??
      []) as any[];

    sendSuccess(res, {
      program: {
        id: program.id,
        user_id: program.user_id,
        name: program.name,
        description: program.description,
        deleted_at: program.deleted_at,
        created_at: program.created_at,
        updated_at: program.updated_at,
        routines: programRoutines.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          routine: {
            ...routineShape(slot.routine),
            exercises: (
              slot.routine.routine_exercises ??
              slot.routine.routineExercises ??
              []
            ).map(routineExerciseShape),
          },
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching program', error);
    sendSingleError(res, 'Failed to fetch program', 500);
  }
};

export const updateProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
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
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
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

    logger.info('Program updated', {
      programId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { program });
  } catch (error) {
    logger.error('Error updating program', error);
    sendSingleError(res, 'Failed to update program', 500);
  }
};

export const deleteProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = req.params as Record<string, string>;

    const existing = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    await prisma.program.delete({ where: { id: programId } });

    logger.info('Program deleted', {
      programId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { message: 'Program deleted successfully' });
  } catch (error) {
    logger.error('Error deleting program', error);
    sendSingleError(res, 'Failed to delete program', 500);
  }
};

// ============== Routine Controllers ==============

export const createRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { name, description, estimated_duration_minutes } =
      req.body as CreateRoutineInput;

    const routine = await prisma.routine.create({
      data: {
        user_id: appUser.supabase_auth_id,
        name,
        description,
        estimated_duration_minutes,
      },
    });

    logger.info('Routine created', {
      routineId: routine.id,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { routine: routineShape(routine) }, 201);
  } catch (error) {
    logger.error('Error creating routine', error);
    sendSingleError(res, 'Failed to create routine', 500);
  }
};

export const getCoachRoutines = async (
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
      ?.query as GetCoachRoutinesQuery;

    const [routines, total] = await Promise.all([
      prisma.routine.findMany({
        where: { user_id: appUser.supabase_auth_id },
        include: { _count: { select: { routine_exercises: true } } },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      } as any),
      prisma.routine.count({ where: { user_id: appUser.supabase_auth_id } }),
    ]);

    sendSuccess(res, {
      routines: (routines as any[]).map((routine) => ({
        ...routineShape(routine),
        exercise_count:
          routine._count?.routine_exercises ??
          routine._count?.routineExercises ??
          0,
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

export const getCoachRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = req.params as Record<string, string>;

    const routine = (await prisma.routine.findUnique({
      where: { id: routineId },
      include: {
        routine_exercises: {
          orderBy: { order_in_routine: 'asc' },
          include: { exercise: true },
        },
      },
    } as any)) as any;

    if (!routine || routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    const routineExercises = ((routine as any).routine_exercises ??
      (routine as any).routineExercises ??
      []) as any[];

    sendSuccess(res, {
      routine: {
        ...routineShape(routine),
        exercises: routineExercises.map(routineExerciseShape),
      },
    });
  } catch (error) {
    logger.error('Error fetching routine', error);
    sendSingleError(res, 'Failed to fetch routine', 500);
  }
};

export const updateRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = req.params as Record<string, string>;
    const { name, description, estimated_duration_minutes } =
      req.body as UpdateRoutineInput;

    if (
      name === undefined &&
      description === undefined &&
      estimated_duration_minutes === undefined
    ) {
      sendSingleError(res, 'At least one field must be provided', 400);
      return;
    }

    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    const routine = await prisma.routine.update({
      where: { id: routineId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(estimated_duration_minutes !== undefined && {
          estimated_duration_minutes,
        }),
      },
    });

    logger.info('Routine updated', {
      routineId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { routine: routineShape(routine) });
  } catch (error) {
    logger.error('Error updating routine', error);
    sendSingleError(res, 'Failed to update routine', 500);
  }
};

export const deleteRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { routineId } = req.params as Record<string, string>;

    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    await prisma.routine.delete({ where: { id: routineId } });

    logger.info('Routine deleted', {
      routineId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { message: 'Routine deleted successfully' });
  } catch (error) {
    logger.error('Error deleting routine', error);
    sendSingleError(res, 'Failed to delete routine', 500);
  }
};

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

    const { programId } = res.locals.validated?.params as AssignRoutineParams;
    const { routine_id, day_of_week } = res.locals.validated
      ?.body as AssignRoutineInput;

    const [program, routine] = await Promise.all([
      prisma.program.findUnique({ where: { id: programId } }),
      prisma.routine.findUnique({ where: { id: routine_id } }),
    ]);

    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    if (!routine || routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    const existingSlot = await prisma.program_routine.findFirst({
      where: {
        program_id: programId,
        day_of_week,
      },
      select: { id: true },
    });

    if (existingSlot) {
      sendSingleError(
        res,
        'A routine is already assigned to this day',
        409,
        'body.day_of_week'
      );
      return;
    }

    const assignment = await prisma.program_routine.create({
      data: {
        program_id: programId,
        routine_id,
        day_of_week,
      },
    });

    logger.info('Routine assigned to program', {
      programId,
      routineId: routine_id,
      dayOfWeek: day_of_week,
      coachId: appUser.supabase_auth_id,
    });

    sendSuccess(res, { assignment: programRoutineShape(assignment) }, 201);
  } catch (error) {
    logger.error('Error assigning routine to program', error);
    sendSingleError(res, 'Failed to assign routine to program', 500);
  }
};

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
    const { day_of_week } = res.locals.validated
      ?.body as UpdateProgramRoutineInput;

    const existing = await prisma.program_routine.findUnique({
      where: { id: programRoutineId },
      include: { program: true },
    });

    if (!existing || existing.program_id !== programId) {
      sendSingleError(res, 'Program routine not found', 404);
      return;
    }

    if (existing.program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    const conflictingSlot = await prisma.program_routine.findFirst({
      where: {
        program_id: programId,
        day_of_week,
        id: { not: programRoutineId },
      },
      select: { id: true },
    });

    if (conflictingSlot) {
      sendSingleError(
        res,
        'A routine is already assigned to this day',
        409,
        'body.day_of_week'
      );
      return;
    }

    const programRoutine = await prisma.program_routine.update({
      where: { id: programRoutineId },
      data: { day_of_week },
    });

    logger.info('Program routine updated', {
      programId,
      programRoutineId,
      dayOfWeek: day_of_week,
      coachId: appUser.supabase_auth_id,
    });

    sendSuccess(res, { programRoutine: programRoutineShape(programRoutine) });
  } catch (error) {
    logger.error('Error updating program routine', error);
    sendSingleError(res, 'Failed to update program routine', 500);
  }
};

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

    const existing = await prisma.program_routine.findUnique({
      where: { id: programRoutineId },
      include: { program: true },
    });

    if (!existing || existing.program_id !== programId) {
      sendSingleError(res, 'Program routine not found', 404);
      return;
    }

    if (existing.program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    await prisma.program_routine.delete({ where: { id: programRoutineId } });

    logger.info('Program routine removed', {
      programId,
      programRoutineId,
      coachId: appUser.supabase_auth_id,
    });

    sendSuccess(res, { message: 'Program routine removed successfully' });
  } catch (error) {
    logger.error('Error removing program routine', error);
    sendSingleError(res, 'Failed to remove program routine', 500);
  }
};

export const addRoutineExercise = async (
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
      ?.params as AddRoutineExerciseParams;
    const {
      exercise_id,
      sets,
      reps_min,
      reps_max,
      rest_seconds,
      order_in_routine,
      notes,
    } = res.locals.validated?.body as AddRoutineExerciseInput;

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!routine || routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: exercise_id },
    });
    if (!exercise || exercise.deleted_at) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }
    if (exercise.user_id !== appUser.supabase_auth_id && !exercise.is_public) {
      sendSingleError(res, 'Exercise not found or access denied', 404);
      return;
    }

    const routineExerciseModel = getRoutineExerciseModel();

    const routineExercise = await routineExerciseModel.create({
      data: {
        routine_id: routineId,
        exercise_id,
        sets,
        reps_min,
        reps_max,
        rest_seconds,
        order_in_routine,
        notes: notes ?? null,
      },
      include: { exercise: true },
    });

    logger.info('Routine exercise added', {
      routineId,
      routineExerciseId: routineExercise.id,
      coachId: appUser.supabase_auth_id,
    });

    sendSuccess(
      res,
      { routineExercise: routineExerciseShape(routineExercise) },
      201
    );
  } catch (error) {
    logger.error('Error adding routine exercise', error);
    sendSingleError(res, 'Failed to add exercise to routine', 500);
  }
};

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
    const {
      exercise_id,
      sets,
      reps_min,
      reps_max,
      rest_seconds,
      order_in_routine,
      notes,
    } = res.locals.validated?.body as UpdateRoutineExerciseInput;

    const routineExerciseModel = getRoutineExerciseModel();

    const existing = await routineExerciseModel.findUnique({
      where: { id: routineExerciseId },
      include: { routine: true },
    });

    if (!existing || existing.routine_id !== routineId || existing.deleted_at) {
      sendSingleError(res, 'Routine exercise not found', 404);
      return;
    }

    if (existing.routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    if (exercise_id !== undefined) {
      const exercise = await prisma.exercise.findUnique({
        where: { id: exercise_id },
      });
      if (!exercise || exercise.deleted_at) {
        sendSingleError(res, 'Exercise not found', 404);
        return;
      }
      if (
        exercise.user_id !== appUser.supabase_auth_id &&
        !exercise.is_public
      ) {
        sendSingleError(res, 'Exercise not found or access denied', 404);
        return;
      }
    }

    const routineExercise = await routineExerciseModel.update({
      where: { id: routineExerciseId },
      data: {
        ...(exercise_id !== undefined && { exercise_id }),
        ...(sets !== undefined && { sets }),
        ...(reps_min !== undefined && { reps_min }),
        ...(reps_max !== undefined && { reps_max }),
        ...(rest_seconds !== undefined && { rest_seconds }),
        ...(order_in_routine !== undefined && { order_in_routine }),
        ...(notes !== undefined && { notes }),
      },
      include: { exercise: true },
    });

    logger.info('Routine exercise updated', {
      routineId,
      routineExerciseId,
      coachId: appUser.supabase_auth_id,
    });

    sendSuccess(res, {
      routineExercise: routineExerciseShape(routineExercise),
    });
  } catch (error) {
    logger.error('Error updating routine exercise', error);
    sendSingleError(res, 'Failed to update routine exercise', 500);
  }
};

export const deleteRoutineExercise = async (
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
      ?.params as DeleteRoutineExerciseParams;

    const routineExerciseModel = getRoutineExerciseModel();

    const existing = await routineExerciseModel.findUnique({
      where: { id: routineExerciseId },
      include: { routine: true },
    });

    if (!existing || existing.routine_id !== routineId || existing.deleted_at) {
      sendSingleError(res, 'Routine exercise not found', 404);
      return;
    }

    if (existing.routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    await routineExerciseModel.delete({ where: { id: routineExerciseId } });

    logger.info('Routine exercise removed', {
      routineId,
      routineExerciseId,
      coachId: appUser.supabase_auth_id,
    });

    sendSuccess(res, { message: 'Routine exercise removed successfully' });
  } catch (error) {
    logger.error('Error deleting routine exercise', error);
    sendSingleError(res, 'Failed to remove routine exercise', 500);
  }
};

// ============== Assignment Controller ==============

export const assignProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { programId } = res.locals.validated?.params as AssignProgramParams;
    const {
      user_id: clientUserId,
      notes,
      start_date,
      end_date,
      routines,
    } = res.locals.validated?.body as AssignProgramInput;

    // Verify coach owns program
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    // Verify client is in coach's class
    const clientRelation = await prisma.subscribed_coach.findFirst({
      where: {
        coach_id: appUser.supabase_auth_id,
        user_id: clientUserId,
        ended_at: null,
      },
    });
    if (!clientRelation) {
      sendSingleError(res, 'Client not found in your class', 404);
      return;
    }

    const assignment = await createAssignment({
      user_id: clientUserId,
      program_id: programId,
      notes,
      start_date,
      end_date,
      routines,
    });

    logger.info('Program assigned', {
      programId,
      clientUserId,
      coachId: appUser.supabase_auth_id,
      assignmentId: assignment.id,
    });
    sendSuccess(res, { assignment }, 201);
  } catch (error) {
    logger.error('Error assigning program', error);
    sendSingleError(res, 'Failed to assign program', 500);
  }
};
