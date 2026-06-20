import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import {
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '../lib/errors';
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
  CreateStandaloneProgramInput,
  GetStandaloneProgramsQuery,
  GetStandaloneProgramByIdParams,
  UpdateStandaloneProgramParams,
  UpdateStandaloneProgramInput,
  DeleteStandaloneProgramParams,
  AddStandaloneProgramRoutineInput,
  AddStandaloneProgramRoutineParams,
  UpdateStandaloneProgramRoutineParams,
  UpdateStandaloneProgramRoutineInput,
  DeleteStandaloneProgramRoutineParams,
  AddStandaloneRoutineExerciseInput,
  AddStandaloneRoutineExerciseParams,
  UpdateStandaloneRoutineExerciseParams,
  UpdateStandaloneRoutineExerciseInput,
  DeleteStandaloneRoutineExerciseParams,
  BuildStandaloneProgramInput,
  ActivateStandaloneProgramParams,
  StartStandaloneSessionInput,
  CompleteStandaloneSessionParams,
  CompleteStandaloneSessionInput,
  GetStandaloneSessionsQuery,
  GetStandaloneSessionByIdParams,
  LogStandaloneSetInput,
  LogStandaloneSetParams,
  UpdateStandaloneSetParams,
  UpdateStandaloneSetInput,
  DeleteStandaloneSetParams,
  GetStandaloneExerciseStatParams,
} from '../schemas/standalone.schema';

// ============== Personal Exercise Controllers (shared `exercise` table) ==============

export const createPersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const {
    id: clientId,
    name,
    description,
    target_muscles,
    is_public,
  } = res.locals.validated?.body as CreatePersonalExerciseInput;

  if (clientId) {
    const existing = await prisma.exercise.findUnique({
      where: { id: clientId },
    });
    if (existing) {
      sendSuccess(res, { exercise: existing });
      return;
    }
  }

  const existing = await prisma.exercise.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      OR: [{ is_public: true }, { user_id: appUser.supabase_auth_id }],
    },
  });

  if (existing) {
    throw new ConflictException(
      'WORKOUT_EXERCISE_DUPLICATE_NAME',
      'An exercise with this name already exists'
    );
  }

  const exercise = await prisma.exercise.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      name,
      description,
      target_muscles: target_muscles ?? [],
      active_segments: [],
      user_id: appUser.supabase_auth_id,
      is_public: is_public ?? false,
    },
  });

  logger.info('Personal exercise created', {
    exerciseId: exercise.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { exercise }, 201);
};

export const getPersonalExercises = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset, search } = res.locals.validated
    ?.query as GetPersonalExercisesQuery;

  const where: Record<string, unknown> = {
    OR: [{ is_public: true }, { user_id: appUser.supabase_auth_id }],
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

  sendSuccess(res, {
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      target_muscles: e.target_muscles,
      active_segments: e.active_segments,
      user_id: e.user_id,
      is_public: e.is_public,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + exercises.length < total,
    },
  });
};

export const updatePersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { exerciseId } = res.locals.validated
    ?.params as UpdatePersonalExerciseParams;
  const updates = res.locals.validated?.body as UpdatePersonalExerciseInput;

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
  });

  if (!exercise || exercise.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }

  if (
    updates.name &&
    updates.name.toLowerCase() !== exercise.name.toLowerCase()
  ) {
    const duplicate = await prisma.exercise.findFirst({
      where: {
        name: { equals: updates.name, mode: 'insensitive' },
        id: { not: exerciseId },
        OR: [{ is_public: true }, { user_id: appUser.supabase_auth_id }],
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'WORKOUT_EXERCISE_DUPLICATE_NAME',
        'An exercise with this name already exists'
      );
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

  logger.info('Personal exercise updated', {
    exerciseId: updated.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { exercise: updated });
};

export const deletePersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { exerciseId } = res.locals.validated
    ?.params as DeletePersonalExerciseParams;

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
  });
  if (!exercise || exercise.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }

  await prisma.exercise.delete({ where: { id: exerciseId } });
  logger.info('Personal exercise deleted', {
    exerciseId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { deleted: true });
};

// ============== Personal Routine Controllers (shared `routine` table) ==============

export const createPersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const {
    id: clientId,
    name,
    description,
    estimated_duration_minutes,
  } = res.locals.validated?.body as CreatePersonalRoutineInput;

  if (clientId) {
    const existing = await prisma.routine.findUnique({
      where: { id: clientId },
    });
    if (existing) {
      sendSuccess(res, { routine: existing });
      return;
    }
  }

  const routine = await prisma.routine.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      user_id: appUser.supabase_auth_id,
      name,
      description,
      estimated_duration_minutes,
    },
  });

  logger.info('Personal routine created', {
    routineId: routine.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { routine }, 201);
};

export const getPersonalRoutines = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset } = res.locals.validated
    ?.query as GetPersonalRoutinesQuery;

  const [routines, total] = await Promise.all([
    prisma.routine.findMany({
      where: { user_id: appUser.supabase_auth_id },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.routine.count({ where: { user_id: appUser.supabase_auth_id } }),
  ]);

  sendSuccess(res, {
    routines,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + routines.length < total,
    },
  });
};

export const getPersonalRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated
    ?.params as GetPersonalRoutineByIdParams;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
  });
  if (!routine || routine.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'WORKOUT_ROUTINE_NOT_FOUND',
      'Routine not found'
    );
  }

  sendSuccess(res, { routine });
};

export const updatePersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated
    ?.params as UpdatePersonalRoutineParams;
  const { name, description, estimated_duration_minutes } = res.locals.validated
    ?.body as UpdatePersonalRoutineInput;

  if (
    name === undefined &&
    description === undefined &&
    estimated_duration_minutes === undefined
  ) {
    throw new BadRequestException(
      'VALIDATION_ERROR',
      'At least one field must be provided'
    );
  }

  const existing = await prisma.routine.findUnique({
    where: { id: routineId },
  });
  if (!existing || existing.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'WORKOUT_ROUTINE_NOT_FOUND',
      'Routine not found'
    );
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

  logger.info('Personal routine updated', {
    routineId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { routine });
};

export const deletePersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated
    ?.params as DeletePersonalRoutineParams;

  const existing = await prisma.routine.findUnique({
    where: { id: routineId },
  });
  if (!existing || existing.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'WORKOUT_ROUTINE_NOT_FOUND',
      'Routine not found'
    );
  }

  await prisma.routine.delete({ where: { id: routineId } });
  logger.info('Personal routine deleted', {
    routineId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { deleted: true });
};

// ============== Standalone Program Controllers (new `standalone_program` table) ==============

export const createStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const {
    id: clientId,
    name,
    description,
  } = res.locals.validated?.body as CreateStandaloneProgramInput;

  if (clientId) {
    const existing = await prisma.standalone_program.findUnique({
      where: { id: clientId },
    });
    if (existing) {
      sendSuccess(res, { program: existing });
      return;
    }
  }

  const program = await prisma.standalone_program.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      user_id: appUser.supabase_auth_id,
      name,
      description,
    },
  });

  logger.info('Standalone program created', {
    programId: program.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { program }, 201);
};

export const getStandalonePrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset } = res.locals.validated
    ?.query as GetStandaloneProgramsQuery;

  const where = {
    user_id: appUser.supabase_auth_id,
    deleted_at: null,
  };

  const [programs, total] = await Promise.all([
    prisma.standalone_program.findMany({
      where,
      include: {
        _count: { select: { routines: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.standalone_program.count({ where }),
  ]);

  sendSuccess(res, {
    programs: programs.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      is_active: p.is_active,
      routine_count: p._count.routines,
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
};

export const getStandaloneProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as GetStandaloneProgramByIdParams;

  const program = await prisma.standalone_program.findUnique({
    where: { id: programId },
    include: {
      routines: {
        where: { deleted_at: null },
        include: {
          routine: true,
          exercises: {
            where: { deleted_at: null },
            include: { exercise: true },
            orderBy: { order_in_routine: 'asc' },
          },
        },
        orderBy: { order_in_program: 'asc' },
      },
    },
  });

  if (
    !program ||
    program.user_id !== appUser.supabase_auth_id ||
    program.deleted_at !== null
  ) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  sendSuccess(res, { program });
};

export const getActiveStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const program = await prisma.standalone_program.findFirst({
    where: {
      user_id: appUser.supabase_auth_id,
      is_active: true,
      deleted_at: null,
    },
    include: {
      routines: {
        where: { deleted_at: null },
        include: {
          routine: true,
          exercises: {
            where: { deleted_at: null },
            include: { exercise: true },
            orderBy: { order_in_routine: 'asc' },
          },
        },
        orderBy: { order_in_program: 'asc' },
      },
    },
  });

  if (!program) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'No active program');
  }

  sendSuccess(res, { program });
};

export const updateStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as UpdateStandaloneProgramParams;
  const { name, description } = res.locals.validated
    ?.body as UpdateStandaloneProgramInput;

  if (!name && !description) {
    throw new BadRequestException(
      'VALIDATION_ERROR',
      'At least one field must be provided'
    );
  }

  const existing = await prisma.standalone_program.findUnique({
    where: { id: programId },
  });
  if (
    !existing ||
    existing.user_id !== appUser.supabase_auth_id ||
    existing.deleted_at !== null
  ) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  const program = await prisma.standalone_program.update({
    where: { id: programId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    },
  });

  logger.info('Standalone program updated', {
    programId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { program });
};

export const deleteStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as DeleteStandaloneProgramParams;

  const existing = await prisma.standalone_program.findUnique({
    where: { id: programId },
  });
  if (
    !existing ||
    existing.user_id !== appUser.supabase_auth_id ||
    existing.deleted_at !== null
  ) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  await prisma.standalone_program.update({
    where: { id: programId },
    data: { deleted_at: new Date() },
  });
  logger.info('Standalone program deleted', {
    programId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { deleted: true });
};

export const activateStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as ActivateStandaloneProgramParams;

  const existing = await prisma.standalone_program.findUnique({
    where: { id: programId },
  });
  if (
    !existing ||
    existing.user_id !== appUser.supabase_auth_id ||
    existing.deleted_at !== null
  ) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  await prisma.$transaction([
    prisma.standalone_program.updateMany({
      where: { user_id: appUser.supabase_auth_id, is_active: true },
      data: { is_active: false },
    }),
    prisma.standalone_program.update({
      where: { id: programId },
      data: { is_active: true },
    }),
  ]);

  logger.info('Standalone program activated', {
    programId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { activated: true, programId });
};

export const deactivateStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as ActivateStandaloneProgramParams;

  const existing = await prisma.standalone_program.findUnique({
    where: { id: programId },
  });
  if (
    !existing ||
    existing.user_id !== appUser.supabase_auth_id ||
    existing.deleted_at !== null
  ) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  await prisma.standalone_program.update({
    where: { id: programId },
    data: { is_active: false },
  });

  logger.info('Standalone program deactivated', {
    programId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { deactivated: true, programId });
};

// ============== Bulk Builder ==============

export const buildStandaloneProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const {
    id: clientId,
    name,
    description,
    routines,
  } = res.locals.validated?.body as BuildStandaloneProgramInput;

  if (clientId) {
    const existing = await prisma.standalone_program.findUnique({
      where: { id: clientId },
    });
    if (existing) {
      const program = await prisma.standalone_program.findUnique({
        where: { id: clientId },
        include: {
          routines: {
            include: {
              routine: true,
              exercises: {
                include: { exercise: true },
                orderBy: { order_in_routine: 'asc' },
              },
            },
            orderBy: { order_in_program: 'asc' },
          },
        },
      });
      sendSuccess(res, { program });
      return;
    }
  }

  const program = await prisma.$transaction(async (tx) => {
    const p = await tx.standalone_program.create({
      data: {
        ...(clientId ? { id: clientId } : {}),
        user_id: appUser.supabase_auth_id,
        name,
        description,
        is_active: true,
      },
    });

    // Deactivate other active programs
    await tx.standalone_program.updateMany({
      where: {
        user_id: appUser.supabase_auth_id,
        is_active: true,
        id: { not: p.id },
      },
      data: { is_active: false },
    });

    for (const r of routines) {
      const pr = await tx.standalone_program_routine.create({
        data: {
          program_id: p.id,
          routine_id: r.routine_id,
          order_in_program: r.order_in_program,
        },
      });

      for (const e of r.exercises) {
        await tx.standalone_program_routine_exercise.create({
          data: {
            program_routine_id: pr.id,
            exercise_id: e.exercise_id,
            sets: e.sets,
            reps_min: e.reps_min,
            reps_max: e.reps_max,
            rest_seconds: e.rest_seconds,
            order_in_routine: e.order_in_routine,
          },
        });
      }
    }

    return tx.standalone_program.findUnique({
      where: { id: p.id },
      include: {
        routines: {
          include: {
            routine: true,
            exercises: {
              include: { exercise: true },
              orderBy: { order_in_routine: 'asc' },
            },
          },
          orderBy: { order_in_program: 'asc' },
        },
      },
    });
  });

  logger.info('Standalone program built', {
    programId: program?.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { program }, 201);
};

// ============== Program Routine Controllers ==============

export const addStandaloneProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as AddStandaloneProgramRoutineParams;
  const {
    id: clientId,
    routine_id,
    order_in_program,
  } = res.locals.validated?.body as AddStandaloneProgramRoutineInput;

  if (clientId) {
    const existing = await prisma.standalone_program_routine.findUnique({
      where: { id: clientId },
    });
    if (existing) {
      sendSuccess(res, { program_routine: existing });
      return;
    }
  }

  const program = await prisma.standalone_program.findUnique({
    where: { id: programId },
  });
  if (
    !program ||
    program.user_id !== appUser.supabase_auth_id ||
    program.deleted_at !== null
  ) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  const programRoutine = await prisma.standalone_program_routine.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      program_id: programId,
      routine_id,
      order_in_program,
    },
  });

  logger.info('Routine added to standalone program', {
    programRoutineId: programRoutine.id,
    programId,
  });
  sendSuccess(res, { program_routine: programRoutine }, 201);
};

export const updateStandaloneProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId, programRoutineId } = res.locals.validated
    ?.params as UpdateStandaloneProgramRoutineParams;
  const { order_in_program } = res.locals.validated
    ?.body as UpdateStandaloneProgramRoutineInput;

  const pr = await prisma.standalone_program_routine.findUnique({
    where: { id: programRoutineId },
    include: { program: true },
  });
  if (
    !pr ||
    pr.program_id !== programId ||
    pr.program.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'PROGRAM_ROUTINE_NOT_FOUND',
      'Program routine not found'
    );
  }

  const updated = await prisma.standalone_program_routine.update({
    where: { id: programRoutineId },
    data: { order_in_program },
  });

  sendSuccess(res, { program_routine: updated });
};

export const deleteStandaloneProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId, programRoutineId } = res.locals.validated
    ?.params as DeleteStandaloneProgramRoutineParams;

  const pr = await prisma.standalone_program_routine.findUnique({
    where: { id: programRoutineId },
    include: { program: true },
  });
  if (
    !pr ||
    pr.program_id !== programId ||
    pr.program.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'PROGRAM_ROUTINE_NOT_FOUND',
      'Program routine not found'
    );
  }

  await prisma.standalone_program_routine.update({
    where: { id: programRoutineId },
    data: { deleted_at: new Date() },
  });

  sendSuccess(res, { deleted: true });
};

// ============== Routine Exercise Controllers ==============

export const addStandaloneRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated
    ?.params as AddStandaloneRoutineExerciseParams;
  const input = res.locals.validated?.body as AddStandaloneRoutineExerciseInput;

  if (input.id) {
    const existing =
      await prisma.standalone_program_routine_exercise.findUnique({
        where: { id: input.id },
      });
    if (existing) {
      sendSuccess(res, { routine_exercise: existing });
      return;
    }
  }

  const programRoutine = await prisma.standalone_program_routine.findUnique({
    where: { id: routineId },
    include: { program: true },
  });
  if (
    !programRoutine ||
    programRoutine.program.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'PROGRAM_ROUTINE_NOT_FOUND',
      'Program routine not found'
    );
  }

  const exercise = await prisma.standalone_program_routine_exercise.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      program_routine_id: routineId,
      exercise_id: input.exercise_id,
      sets: input.sets,
      reps_min: input.reps_min,
      reps_max: input.reps_max,
      rest_seconds: input.rest_seconds,
      order_in_routine: input.order_in_routine,
    },
  });

  sendSuccess(res, { routine_exercise: exercise }, 201);
};

export const updateStandaloneRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId, routineExerciseId } = res.locals.validated
    ?.params as UpdateStandaloneRoutineExerciseParams;
  const updates = res.locals.validated
    ?.body as UpdateStandaloneRoutineExerciseInput;

  const re = await prisma.standalone_program_routine_exercise.findUnique({
    where: { id: routineExerciseId },
    include: { program_routine: { include: { program: true } } },
  });
  if (
    !re ||
    re.program_routine_id !== routineId ||
    re.program_routine.program.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Routine exercise not found'
    );
  }

  const updated = await prisma.standalone_program_routine_exercise.update({
    where: { id: routineExerciseId },
    data: {
      ...(updates.sets !== undefined && { sets: updates.sets }),
      ...(updates.reps_min !== undefined && { reps_min: updates.reps_min }),
      ...(updates.reps_max !== undefined && { reps_max: updates.reps_max }),
      ...(updates.rest_seconds !== undefined && {
        rest_seconds: updates.rest_seconds,
      }),
      ...(updates.order_in_routine !== undefined && {
        order_in_routine: updates.order_in_routine,
      }),
    },
  });

  sendSuccess(res, { routine_exercise: updated });
};

export const deleteStandaloneRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId, routineExerciseId } = res.locals.validated
    ?.params as DeleteStandaloneRoutineExerciseParams;

  const re = await prisma.standalone_program_routine_exercise.findUnique({
    where: { id: routineExerciseId },
    include: { program_routine: { include: { program: true } } },
  });
  if (
    !re ||
    re.program_routine_id !== routineId ||
    re.program_routine.program.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Routine exercise not found'
    );
  }

  await prisma.standalone_program_routine_exercise.update({
    where: { id: routineExerciseId },
    data: { deleted_at: new Date() },
  });

  sendSuccess(res, { deleted: true });
};

// ============== Session Controllers ==============

export const startStandaloneSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { id: clientId, program_routine_id } = res.locals.validated
    ?.body as StartStandaloneSessionInput;

  if (clientId) {
    const existing = await prisma.standalone_session.findUnique({
      where: { id: clientId },
    });
    if (existing) {
      sendSuccess(res, {
        session: existing,
        alreadyCompleted: existing.completed_at != null,
      });
      return;
    }
  }

  const pr = await prisma.standalone_program_routine.findUnique({
    where: { id: program_routine_id },
    include: { program: true },
  });
  if (!pr || pr.program.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'STANDALONE_NOT_FOUND',
      'Program routine not found'
    );
  }

  const activeSession = await prisma.standalone_session.findFirst({
    where: {
      user_id: appUser.supabase_auth_id,
      completed_at: null,
      deleted_at: null,
    },
  });

  if (activeSession) {
    throw new ConflictException(
      'WORKOUT_SESSION_ALREADY_ACTIVE',
      'You already have an active workout session. Complete it first.'
    );
  }

  const session = await prisma.standalone_session.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      user_id: appUser.supabase_auth_id,
      program_routine_id,
      started_at: new Date(),
    },
  });

  logger.info('Standalone session started', {
    sessionId: session.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { session }, 201);
};

export const getStandaloneActiveSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const session = await prisma.standalone_session.findFirst({
    where: {
      user_id: appUser.supabase_auth_id,
      completed_at: null,
      deleted_at: null,
    },
    include: {
      program_routine: {
        include: {
          routine: true,
          exercises: {
            where: { deleted_at: null },
            include: { exercise: true },
            orderBy: { order_in_routine: 'asc' },
          },
        },
      },
      performed_sets: { orderBy: { set_number: 'asc' } },
    },
  });

  sendSuccess(res, { session: session ?? null });
};

export const completeStandaloneSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { sessionId } = res.locals.validated
    ?.params as CompleteStandaloneSessionParams;
  const { feedback } = res.locals.validated
    ?.body as CompleteStandaloneSessionInput;

  const session = await prisma.standalone_session.findFirst({
    where: {
      id: sessionId,
      user_id: appUser.supabase_auth_id,
      deleted_at: null,
    },
  });

  if (!session) {
    throw new NotFoundException(
      'SESSION_NOT_FOUND',
      'Workout session not found'
    );
  }

  if (session.completed_at) {
    sendSuccess(res, {
      session,
      alreadyCompleted: true,
      message: 'Session was already completed',
    });
    return;
  }

  const now = new Date();
  const updatedSession = await prisma.standalone_session.update({
    where: { id: sessionId },
    data: { completed_at: now, feedback },
  });

  // Update standalone streak
  const user = await prisma.user.findUnique({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    select: {
      standalone_streak_days: true,
      standalone_last_workout_date: true,
    },
  });

  if (user) {
    const lastDate = user.standalone_last_workout_date;
    let newStreak = 1;

    if (lastDate) {
      const dayMs = 24 * 60 * 60 * 1000;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last = new Date(
        lastDate.getFullYear(),
        lastDate.getMonth(),
        lastDate.getDate()
      );
      const diffDays = Math.round((today.getTime() - last.getTime()) / dayMs);

      if (diffDays === 1) {
        newStreak = user.standalone_streak_days + 1;
      } else if (diffDays === 0) {
        newStreak = user.standalone_streak_days;
      }
    }

    await prisma.user.update({
      where: { supabase_auth_id: appUser.supabase_auth_id },
      data: {
        standalone_streak_days: newStreak,
        standalone_last_workout_date: now,
      },
    });
  }

  logger.info('Standalone session completed', {
    sessionId,
    user_id: appUser.supabase_auth_id,
  });

  sendSuccess(res, { session: updatedSession });
};

export const getStandaloneSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset } = res.locals.validated
    ?.query as GetStandaloneSessionsQuery;

  const where = {
    user_id: appUser.supabase_auth_id,
    completed_at: { not: null },
    deleted_at: null,
  };

  const [sessions, total] = await Promise.all([
    prisma.standalone_session.findMany({
      where,
      include: {
        program_routine: {
          include: {
            routine: { select: { name: true } },
          },
        },
        _count: { select: { performed_sets: true } },
      },
      orderBy: { started_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.standalone_session.count({ where }),
  ]);

  sendSuccess(res, {
    sessions: sessions.map((s) => ({
      id: s.id,
      routine_name: s.program_routine.routine.name,
      started_at: s.started_at,
      completed_at: s.completed_at,
      feedback: s.feedback,
      set_count: s._count.performed_sets,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + sessions.length < total,
    },
  });
};

export const getStandaloneSessionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { sessionId } = res.locals.validated
    ?.params as GetStandaloneSessionByIdParams;

  const session = await prisma.standalone_session.findFirst({
    where: {
      id: sessionId,
      user_id: appUser.supabase_auth_id,
      deleted_at: null,
    },
    include: {
      program_routine: {
        include: {
          routine: true,
          exercises: {
            where: { deleted_at: null },
            include: { exercise: true },
            orderBy: { order_in_routine: 'asc' },
          },
        },
      },
      performed_sets: {
        orderBy: [{ routine_exercise_id: 'asc' }, { set_number: 'asc' }],
      },
    },
  });

  if (!session) {
    throw new NotFoundException('SESSION_NOT_FOUND', 'Session not found');
  }

  sendSuccess(res, { session });
};

// ============== Performed Set Controllers ==============

export const logStandaloneSet = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { sessionId } = res.locals.validated?.params as LogStandaloneSetParams;
  const {
    id: clientId,
    routine_exercise_id,
    set_number,
    reps,
    weight,
  } = res.locals.validated?.body as LogStandaloneSetInput;

  const session = await prisma.standalone_session.findFirst({
    where: {
      id: sessionId,
      user_id: appUser.supabase_auth_id,
      deleted_at: null,
    },
  });
  if (!session) {
    throw new NotFoundException('SESSION_NOT_FOUND', 'Session not found');
  }

  if (session.completed_at) {
    throw new BadRequestException(
      'STANDALONE_ALREADY_COMPLETED',
      'Session is already completed'
    );
  }

  const performedSet = await prisma.standalone_performed_set.upsert({
    where: {
      session_id_routine_exercise_id_set_number: {
        session_id: sessionId,
        routine_exercise_id,
        set_number,
      },
    },
    create: {
      ...(clientId ? { id: clientId } : {}),
      session_id: sessionId,
      routine_exercise_id,
      set_number,
      reps,
      weight,
    },
    update: {
      reps,
      weight,
    },
  });

  sendSuccess(res, { performed_set: performedSet }, 201);
};

export const updateStandaloneSet = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { sessionId, setId } = res.locals.validated
    ?.params as UpdateStandaloneSetParams;
  const { reps, weight } = res.locals.validated
    ?.body as UpdateStandaloneSetInput;

  const existing = await prisma.standalone_performed_set.findUnique({
    where: { id: setId },
    include: { session: true },
  });

  if (
    !existing ||
    existing.session_id !== sessionId ||
    existing.session.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'WORKOUT_SET_NOT_FOUND',
      'Performed set not found'
    );
  }

  const updated = await prisma.standalone_performed_set.update({
    where: { id: setId },
    data: {
      ...(reps !== undefined && { reps }),
      ...(weight !== undefined && { weight }),
    },
  });

  sendSuccess(res, { performed_set: updated });
};

export const deleteStandaloneSet = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { sessionId, setId } = res.locals.validated
    ?.params as DeleteStandaloneSetParams;

  const existing = await prisma.standalone_performed_set.findUnique({
    where: { id: setId },
    include: { session: true },
  });

  if (
    !existing ||
    existing.session_id !== sessionId ||
    existing.session.user_id !== appUser.supabase_auth_id
  ) {
    throw new NotFoundException(
      'WORKOUT_SET_NOT_FOUND',
      'Performed set not found'
    );
  }

  await prisma.standalone_performed_set.delete({ where: { id: setId } });
  sendSuccess(res, { deleted: true });
};

// ============== Stats Controllers ==============

export const getStandaloneStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  const user = await prisma.user.findUnique({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    select: {
      standalone_streak_days: true,
      standalone_last_workout_date: true,
    },
  });

  const sessions = await prisma.standalone_session.findMany({
    where: {
      user_id: appUser.supabase_auth_id,
      completed_at: { not: null, gte: weekStart },
      deleted_at: null,
    },
    select: { id: true, started_at: true, completed_at: true },
  });

  const totalDurationMs = sessions.reduce((sum, s) => {
    if (s.started_at && s.completed_at) {
      return sum + (s.completed_at.getTime() - s.started_at.getTime());
    }
    return sum;
  }, 0);

  const allTimeCount = await prisma.standalone_session.count({
    where: {
      user_id: appUser.supabase_auth_id,
      completed_at: { not: null },
      deleted_at: null,
    },
  });

  const totalSets = await prisma.standalone_performed_set.count({
    where: {
      session: {
        user_id: appUser.supabase_auth_id,
        completed_at: { not: null },
        deleted_at: null,
      },
    },
  });

  sendSuccess(res, {
    workouts_this_week: sessions.length,
    streak_days: user?.standalone_streak_days ?? 0,
    total_duration_minutes: Math.round(totalDurationMs / 60000),
    total_workouts: allTimeCount,
    total_sets: totalSets,
    week_start: weekStart,
  });
};

export const getStandaloneExerciseStat = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { exerciseId } = res.locals.validated
    ?.params as GetStandaloneExerciseStatParams;

  const lastSet = await prisma.standalone_performed_set.findFirst({
    where: {
      exercise: { exercise_id: exerciseId },
      session: {
        user_id: appUser.supabase_auth_id,
        completed_at: { not: null },
        deleted_at: null,
      },
    },
    orderBy: { created_at: 'desc' },
    select: { reps: true, weight: true, set_number: true, created_at: true },
  });

  sendSuccess(res, {
    exercise_id: exerciseId,
    last_set: lastSet ?? null,
  });
};
