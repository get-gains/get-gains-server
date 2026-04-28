import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../lib/errors';
import type {
  CreateSelfProgramInput,
  GetSelfProgramsQuery,
  GetSelfProgramByIdParams,
  UpdateSelfProgramParams,
  UpdateSelfProgramInput,
  DeleteSelfProgramParams,
  AddSelfProgramRoutineParams,
  AddSelfProgramRoutineInput,
  UpdateSelfProgramRoutineParams,
  UpdateSelfProgramRoutineInput,
  DeleteSelfProgramRoutineParams,
  AddSelfProgramRoutineExerciseParams,
  AddSelfProgramRoutineExerciseInput,
  UpdateSelfProgramRoutineExerciseParams,
  UpdateSelfProgramRoutineExerciseInput,
  DeleteSelfProgramRoutineExerciseParams,
} from '../schemas/user_program.schema';

// ============== Helpers ==============

/**
 * Verify the user owns the given program and return it.
 */
const requireUserProgram = async (programId: string, userId: string) => {
  const program = await prisma.assigned_program.findUnique({
    where: { id: programId },
  });
  if (
    !program ||
    program.coach_id !== userId ||
    program.user_id !== userId ||
    program.deleted_at
  ) {
    throw new NotFoundException(
      'PROGRAM_NOT_FOUND',
      'Program not found or access denied'
    );
  }
  return program;
};

/**
 * Verify a routine within a program belongs to the user's program.
 */
const requireUserProgramRoutine = async (
  aprId: string,
  programId: string,
  userId: string
) => {
  const apr = await prisma.assigned_program_routine.findFirst({
    where: {
      id: aprId,
      assigned_program_id: programId,
      deleted_at: null,
      assigned_program: { coach_id: userId, user_id: userId, deleted_at: null },
    },
  });
  if (!apr) {
    throw new NotFoundException(
      'PROGRAM_ROUTINE_NOT_FOUND',
      'Routine not found in this program'
    );
  }
  return apr;
};

/**
 * Full program tree shape used by getById and create responses.
 */
const fetchProgramTree = async (programId: string) => {
  return prisma.assigned_program.findUniqueOrThrow({
    where: { id: programId },
    include: {
      assigned_program_routines: {
        where: { deleted_at: null },
        orderBy: { order_in_program: 'asc' },
        include: {
          assigned_program_routine_exercises: {
            where: { deleted_at: null },
            orderBy: { order_in_routine: 'asc' },
            include: { exercise: true },
          },
        },
      },
    },
  });
};

const shapeProgramTree = (
  program: Awaited<ReturnType<typeof fetchProgramTree>>
) => ({
  id: program.id,
  coach_id: program.coach_id,
  user_id: program.user_id,
  name: program.name,
  description: program.description,
  notes: program.notes,
  is_active: program.is_active,
  start_date: program.start_date,
  end_date: program.end_date,
  deleted_at: program.deleted_at,
  created_at: program.created_at,
  updated_at: program.updated_at,
  routines: program.assigned_program_routines.map((apr) => ({
    id: apr.id,
    source_routine_id: apr.source_routine_id,
    name: apr.name,
    description: apr.description,
    estimated_duration_minutes: apr.estimated_duration_minutes,
    order_in_program: apr.order_in_program,
    days_of_week: apr.days_of_week,
    created_at: apr.created_at,
    updated_at: apr.updated_at,
    exercises: apr.assigned_program_routine_exercises.map((apre) => ({
      id: apre.id,
      exercise_id: apre.exercise_id,
      sets: apre.sets,
      reps_min: apre.reps_min,
      reps_max: apre.reps_max,
      rest_seconds: apre.rest_seconds,
      order_in_routine: apre.order_in_routine,
      exercise: apre.exercise
        ? {
            id: apre.exercise.id,
            name: apre.exercise.name,
            description: apre.exercise.description,
            target_muscles: apre.exercise.target_muscles,
          }
        : undefined,
      created_at: apre.created_at,
      updated_at: apre.updated_at,
    })),
  })),
});

// ============== Controllers ==============

/**
 * Create a new self-program.
 * POST /user/programs
 */
export const createSelfProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;

  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  if (user.active_subscription_tier !== 'FREE') {
    throw new ForbiddenException(
      'PROGRAM_FORBIDDEN',
      'Only FREE tier users can create standalone programs'
    );
  }

  const { name, description, notes, start_date, end_date } = res.locals
    .validated?.body as CreateSelfProgramInput;

  // Max 5 programs limit check
  const count = await prisma.assigned_program.count({
    where: {
      user_id: user.supabase_auth_id,
      coach_id: user.supabase_auth_id,
      deleted_at: null,
    },
  });

  if (count >= 5) {
    throw new BadRequestException(
      'PROGRAM_FORBIDDEN',
      'Max 5 self-programs allowed'
    );
  }

  const program = await prisma.assigned_program.create({
    data: {
      coach_id: user.supabase_auth_id,
      user_id: user.supabase_auth_id,
      name,
      description,
      notes: notes ?? null,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
    },
  });

  logger.info('Self program created', {
    programId: program.id,
    userId: user.supabase_auth_id,
  });

  sendSuccess(
    res,
    {
      program: shapeProgramTree({
        ...program,
        assigned_program_routines: [],
      }),
    },
    201
  );
};

/**
 * Get self programs list.
 * GET /user/programs
 */
export const listSelfPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { limit, offset } = res.locals.validated?.query as GetSelfProgramsQuery;

  const programs = await prisma.assigned_program.findMany({
    where: {
      user_id: user.supabase_auth_id,
      coach_id: user.supabase_auth_id,
      deleted_at: null,
    },
    take: limit,
    skip: offset,
    orderBy: { created_at: 'desc' },
    include: {
      _count: {
        select: { assigned_program_routines: { where: { deleted_at: null } } },
      },
    },
  });

  const count = await prisma.assigned_program.count({
    where: {
      user_id: user.supabase_auth_id,
      coach_id: user.supabase_auth_id,
      deleted_at: null,
    },
  });

  sendSuccess(res, { programs, count });
};

/**
 * Get a self program by ID.
 * GET /user/programs/:programId
 */
export const getSelfProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as GetSelfProgramByIdParams;
  await requireUserProgram(programId, user.supabase_auth_id);

  const tree = await fetchProgramTree(programId);
  sendSuccess(res, { program: shapeProgramTree(tree) });
};

/**
 * Update self program metadata.
 * PATCH /user/programs/:programId
 */
export const updateSelfProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId } = res.locals.validated?.params as UpdateSelfProgramParams;
  const { name, description, notes, is_active, start_date, end_date } = res
    .locals.validated?.body as UpdateSelfProgramInput;

  await requireUserProgram(programId, user.supabase_auth_id);

  const updated = await prisma.assigned_program.update({
    where: { id: programId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(notes !== undefined && { notes }),
      ...(is_active !== undefined && { is_active }),
      ...(start_date !== undefined && { start_date }),
      ...(end_date !== undefined && { end_date }),
    },
  });

  logger.info('Self program updated', {
    programId,
    userId: user.supabase_auth_id,
  });

  const tree = await fetchProgramTree(updated.id);
  sendSuccess(res, { program: shapeProgramTree(tree) });
};

/**
 * Soft-delete a self program.
 * DELETE /user/programs/:programId
 */
export const deleteSelfProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId } = res.locals.validated?.params as DeleteSelfProgramParams;

  await requireUserProgram(programId, user.supabase_auth_id);

  await prisma.assigned_program.update({
    where: { id: programId },
    data: { deleted_at: new Date(), is_active: false },
  });

  logger.info('Self program deleted', {
    programId,
    userId: user.supabase_auth_id,
  });

  sendSuccess(res, { message: 'Program deleted successfully' });
};

// ============== Program Routine Controllers ==============

/**
 * Add an inline routine to a self program.
 * POST /user/programs/:programId/routines
 */
export const addSelfProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as AddSelfProgramRoutineParams;
  const body = res.locals.validated?.body as AddSelfProgramRoutineInput;

  await requireUserProgram(programId, user.supabase_auth_id);

  await prisma.$transaction(async (tx) => {
    const created = await tx.assigned_program_routine.create({
      data: {
        assigned_program_id: programId,
        name: body.name,
        description: body.description,
        estimated_duration_minutes: body.estimated_duration_minutes,
        order_in_program: body.order_in_program,
        days_of_week: body.days_of_week,
      },
    });

    if (body.exercises && body.exercises.length > 0) {
      for (const ex of body.exercises) {
        // Verify exercise exists and is accessible
        const exercise = await tx.exercise.findUnique({
          where: { id: ex.exercise_id },
        });
        if (!exercise || exercise.deleted_at) {
          throw new NotFoundException(
            'WORKOUT_EXERCISE_NOT_FOUND',
            `Exercise ${ex.exercise_id} not found`
          );
        }
        // Free users only have access to their own or public exercises
        if (exercise.user_id !== user.supabase_auth_id && !exercise.is_public) {
          throw new ForbiddenException(
            'WORKOUT_EXERCISE_FORBIDDEN',
            `Exercise ${ex.exercise_id} not accessible`
          );
        }

        await tx.assigned_program_routine_exercise.create({
          data: {
            assigned_program_routine_id: created.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps_min: ex.reps_min,
            reps_max: ex.reps_max,
            rest_seconds: ex.rest_seconds,
            order_in_routine: ex.order_in_routine,
          },
        });
      }
    }

    return created;
  });

  logger.info('Self program routine added', {
    programId,
    userId: user.supabase_auth_id,
  });

  const tree = await fetchProgramTree(programId);
  sendSuccess(res, { program: shapeProgramTree(tree) }, 201);
};

/**
 * Update a routine within a self program.
 * PATCH /user/programs/:programId/routines/:aprId
 */
export const updateSelfProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId, aprId } = res.locals.validated
    ?.params as UpdateSelfProgramRoutineParams;
  const {
    name,
    description,
    estimated_duration_minutes,
    days_of_week,
    order_in_program,
  } = res.locals.validated?.body as UpdateSelfProgramRoutineInput;

  await requireUserProgramRoutine(aprId, programId, user.supabase_auth_id);

  await prisma.assigned_program_routine.update({
    where: { id: aprId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(estimated_duration_minutes !== undefined && {
        estimated_duration_minutes,
      }),
      ...(days_of_week !== undefined && { days_of_week }),
      ...(order_in_program !== undefined && { order_in_program }),
    },
  });

  logger.info('Self program routine updated', {
    programId,
    aprId,
    userId: user.supabase_auth_id,
  });

  const tree = await fetchProgramTree(programId);
  sendSuccess(res, { program: shapeProgramTree(tree) });
};

/**
 * Soft-delete a routine from a self program.
 * DELETE /user/programs/:programId/routines/:aprId
 */
export const deleteSelfProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId, aprId } = res.locals.validated
    ?.params as DeleteSelfProgramRoutineParams;

  await requireUserProgramRoutine(aprId, programId, user.supabase_auth_id);

  await prisma.assigned_program_routine.update({
    where: { id: aprId },
    data: { deleted_at: new Date() },
  });

  logger.info('Self program routine removed', {
    programId,
    aprId,
    userId: user.supabase_auth_id,
  });

  sendSuccess(res, { message: 'Routine removed from program' });
};

// ============== Program Routine Exercise Controllers ==============

/**
 * Add an exercise to a self program routine.
 * POST /user/programs/:programId/routines/:aprId/exercises
 */
export const addSelfProgramRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId, aprId } = res.locals.validated
    ?.params as AddSelfProgramRoutineExerciseParams;
  const {
    exercise_id,
    sets,
    reps_min,
    reps_max,
    rest_seconds,
    order_in_routine,
  } = res.locals.validated?.body as AddSelfProgramRoutineExerciseInput;

  await requireUserProgramRoutine(aprId, programId, user.supabase_auth_id);

  const exercise = await prisma.exercise.findUnique({
    where: { id: exercise_id },
  });
  if (!exercise || exercise.deleted_at) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }
  if (exercise.user_id !== user.supabase_auth_id && !exercise.is_public) {
    throw new ForbiddenException(
      'WORKOUT_EXERCISE_FORBIDDEN',
      'Exercise not accessible'
    );
  }

  const apre = await prisma.assigned_program_routine_exercise.create({
    data: {
      assigned_program_routine_id: aprId,
      exercise_id,
      sets,
      reps_min,
      reps_max,
      rest_seconds,
      order_in_routine,
    },
    include: { exercise: true },
  });

  logger.info('Self program routine exercise added', {
    programId,
    aprId,
    apreId: apre.id,
    userId: user.supabase_auth_id,
  });

  sendSuccess(
    res,
    {
      exercise: {
        id: apre.id,
        exercise_id: apre.exercise_id,
        sets: apre.sets,
        reps_min: apre.reps_min,
        reps_max: apre.reps_max,
        rest_seconds: apre.rest_seconds,
        order_in_routine: apre.order_in_routine,
        exercise: apre.exercise
          ? {
              id: apre.exercise.id,
              name: apre.exercise.name,
              description: apre.exercise.description,
              target_muscles: apre.exercise.target_muscles,
            }
          : undefined,
        created_at: apre.created_at,
        updated_at: apre.updated_at,
      },
    },
    201
  );
};

/**
 * Update an exercise within a self program routine.
 * PATCH /user/programs/:programId/routines/:aprId/exercises/:apreId
 */
export const updateSelfProgramRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId, aprId, apreId } = res.locals.validated
    ?.params as UpdateSelfProgramRoutineExerciseParams;
  const {
    exercise_id,
    sets,
    reps_min,
    reps_max,
    rest_seconds,
    order_in_routine,
  } = res.locals.validated?.body as UpdateSelfProgramRoutineExerciseInput;

  await requireUserProgramRoutine(aprId, programId, user.supabase_auth_id);

  const existing = await prisma.assigned_program_routine_exercise.findFirst({
    where: {
      id: apreId,
      assigned_program_routine_id: aprId,
      deleted_at: null,
    },
  });
  if (!existing) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Routine exercise not found'
    );
  }

  if (exercise_id !== undefined) {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exercise_id },
    });
    if (!exercise || exercise.deleted_at) {
      throw new NotFoundException(
        'WORKOUT_EXERCISE_NOT_FOUND',
        'Exercise not found'
      );
    }
    if (exercise.user_id !== user.supabase_auth_id && !exercise.is_public) {
      throw new ForbiddenException(
        'WORKOUT_EXERCISE_FORBIDDEN',
        'Exercise not accessible'
      );
    }
  }

  const updated = await prisma.assigned_program_routine_exercise.update({
    where: { id: apreId },
    data: {
      ...(exercise_id !== undefined && { exercise_id }),
      ...(sets !== undefined && { sets }),
      ...(reps_min !== undefined && { reps_min }),
      ...(reps_max !== undefined && { reps_max }),
      ...(rest_seconds !== undefined && { rest_seconds }),
      ...(order_in_routine !== undefined && { order_in_routine }),
    },
    include: { exercise: true },
  });

  logger.info('Self program routine exercise updated', {
    programId,
    aprId,
    apreId,
    userId: user.supabase_auth_id,
  });

  sendSuccess(res, {
    exercise: {
      id: updated.id,
      exercise_id: updated.exercise_id,
      sets: updated.sets,
      reps_min: updated.reps_min,
      reps_max: updated.reps_max,
      rest_seconds: updated.rest_seconds,
      order_in_routine: updated.order_in_routine,
      exercise: updated.exercise
        ? {
            id: updated.exercise.id,
            name: updated.exercise.name,
            description: updated.exercise.description,
            target_muscles: updated.exercise.target_muscles,
          }
        : undefined,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  });
};

/**
 * Delete an exercise from a self program routine.
 * DELETE /user/programs/:programId/routines/:aprId/exercises/:apreId
 */
export const deleteSelfProgramRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    throw new ForbiddenException('UNAUTHENTICATED', 'User required');
  }

  const { programId, aprId, apreId } = res.locals.validated
    ?.params as DeleteSelfProgramRoutineExerciseParams;

  await requireUserProgramRoutine(aprId, programId, user.supabase_auth_id);

  await prisma.assigned_program_routine_exercise.update({
    where: { id: apreId },
    data: { deleted_at: new Date() },
  });

  logger.info('Self program routine exercise removed', {
    programId,
    aprId,
    apreId,
    userId: user.supabase_auth_id,
  });

  sendSuccess(res, { message: 'Exercise removed from routine' });
};
