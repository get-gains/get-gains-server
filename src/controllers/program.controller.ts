import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { createNotification } from '../services/notification.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '../lib/errors';
import type {
  CreateClientProgramParams,
  CreateClientProgramInput,
  GetClientActiveProgramParams,
  UpdateClientProgramParams,
  UpdateClientProgramInput,
  DeleteClientProgramParams,
  GetProgramByIdParams,
  AddProgramRoutineParams,
  AddProgramRoutineInput,
  UpdateProgramRoutineParams,
  UpdateProgramRoutineInput,
  DeleteProgramRoutineParams,
  AddProgramRoutineExerciseParams,
  AddProgramRoutineExerciseInput,
  UpdateProgramRoutineExerciseParams,
  UpdateProgramRoutineExerciseInput,
  DeleteProgramRoutineExerciseParams,
  CreateRoutineInput,
  GetCoachRoutinesQuery,
  UpdateRoutineInput,
} from '../schemas/program.schema';

// ============== Helpers ==============

/**
 * Verify the coach owns the given program and return it.
 * @param programId - The program to look up
 * @param coachId - The authenticated coach's user_id
 * @returns The assigned_program row
 * @throws NotFoundException if not found or not owned
 */
const requireCoachProgram = async (programId: string, coachId: string) => {
  const program = await prisma.assigned_program.findUnique({
    where: { id: programId },
  });
  if (!program || program.coach_id !== coachId || program.deleted_at) {
    throw new NotFoundException(
      'PROGRAM_NOT_FOUND',
      'Program not found or access denied'
    );
  }
  return program;
};

/**
 * Verify a routine within a program belongs to the coach's program.
 * @param aprId - assigned_program_routine id
 * @param programId - parent program id
 * @param coachId - the coach's user_id
 * @returns The assigned_program_routine row
 * @throws NotFoundException if not found
 */
const requireProgramRoutine = async (
  aprId: string,
  programId: string,
  coachId: string
) => {
  const apr = await prisma.assigned_program_routine.findFirst({
    where: {
      id: aprId,
      assigned_program_id: programId,
      deleted_at: null,
      assigned_program: { coach_id: coachId, deleted_at: null },
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
 * @param programId - The program to fetch
 * @returns Program with all routines and exercises
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

/**
 * Shape a full program tree for the response envelope.
 * @param program - Prisma result with nested includes
 * @returns Cleaned response object
 */
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

// ============== Client Program Controllers ==============

/**
 * Create a new program for a specific client.
 * POST /coach/clients/:clientId/programs
 * @param req - Express request with validated params + body
 * @param res - Express response
 */
export const createClientProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { clientId } = res.locals.validated
    ?.params as CreateClientProgramParams;
  const { name, description, notes, start_date, end_date } = res.locals
    .validated?.body as CreateClientProgramInput;

  // Verify client is in coach's class
  const isInClass = await prisma.subscribed_coach.findFirst({
    where: {
      user_id: clientId,
      coach_id: coach.user_id,
      ended_at: null,
    },
  });
  if (!isInClass) {
    throw new NotFoundException(
      'COACH_CLIENT_NOT_FOUND',
      'Client not found in your class'
    );
  }

  const program = await prisma.assigned_program.create({
    data: {
      coach_id: coach.user_id,
      user_id: clientId,
      name,
      description,
      notes: notes ?? null,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
    },
  });

  logger.info('Client program created', {
    programId: program.id,
    coachId: coach.user_id,
    clientId,
  });

  // Notify client
  try {
    await createNotification({
      userId: clientId,
      type: 'program_assigned',
      title: 'New Program Assigned',
      body: `Your coach assigned you a new program: ${name}`,
      data: { coachId: coach.user_id, programId: program.id },
    });
  } catch (err) {
    logger.error('Failed to create program_assigned notification', err);
  }

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
 * Get the active program for a specific client (or null).
 * GET /coach/clients/:clientId/program
 * @param req - Express request
 * @param res - Express response
 */
export const getClientActiveProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { clientId } = res.locals.validated
    ?.params as GetClientActiveProgramParams;

  // Verify client is in coach's class
  const isInClass = await prisma.subscribed_coach.findFirst({
    where: {
      user_id: clientId,
      coach_id: coach.user_id,
      ended_at: null,
    },
  });
  if (!isInClass) {
    throw new NotFoundException(
      'COACH_CLIENT_NOT_FOUND',
      'Client not found in your class'
    );
  }

  const program = await prisma.assigned_program.findFirst({
    where: {
      user_id: clientId,
      coach_id: coach.user_id,
      is_active: true,
      deleted_at: null,
    },
    orderBy: { created_at: 'desc' },
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

  sendSuccess(res, { program: program ? shapeProgramTree(program) : null });
};

/**
 * Get a program by ID.
 * GET /coach/programs/:programId
 * @param req - Express request
 * @param res - Express response
 */
export const getProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId } = res.locals.validated?.params as GetProgramByIdParams;
  await requireCoachProgram(programId, coach.user_id);

  const tree = await fetchProgramTree(programId);
  sendSuccess(res, { program: shapeProgramTree(tree) });
};

/**
 * Update program metadata.
 * PATCH /coach/programs/:programId
 * @param req - Express request
 * @param res - Express response
 */
export const updateClientProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId } = res.locals.validated
    ?.params as UpdateClientProgramParams;
  const { name, description, notes, is_active, start_date, end_date } = res
    .locals.validated?.body as UpdateClientProgramInput;

  await requireCoachProgram(programId, coach.user_id);

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

  logger.info('Client program updated', {
    programId,
    coachId: coach.user_id,
  });

  const tree = await fetchProgramTree(updated.id);
  sendSuccess(res, { program: shapeProgramTree(tree) });
};

/**
 * Soft-delete a program.
 * DELETE /coach/programs/:programId
 * @param req - Express request
 * @param res - Express response
 */
export const deleteClientProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId } = res.locals.validated
    ?.params as DeleteClientProgramParams;

  await requireCoachProgram(programId, coach.user_id);

  await prisma.assigned_program.update({
    where: { id: programId },
    data: { deleted_at: new Date(), is_active: false },
  });

  logger.info('Client program deleted', {
    programId,
    coachId: coach.user_id,
  });

  sendSuccess(res, { message: 'Program deleted successfully' });
};

// ============== Program Routine Controllers ==============

/**
 * Add a routine to a program — either from a template or inline.
 * POST /coach/programs/:programId/routines
 * @param req - Express request
 * @param res - Express response
 */
export const addProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId } = res.locals.validated?.params as AddProgramRoutineParams;
  const body = res.locals.validated?.body as AddProgramRoutineInput;

  await requireCoachProgram(programId, coach.user_id);

  if (body.mode === 'template') {
    // Copy from template routine
    const template = await prisma.routine.findUnique({
      where: { id: body.source_routine_id },
    });
    if (
      !template ||
      template.user_id !== coach.user_id ||
      template.deleted_at
    ) {
      throw new NotFoundException(
        'ROUTINE_TEMPLATE_NOT_FOUND',
        'Routine template not found or access denied'
      );
    }

    await prisma.assigned_program_routine.create({
      data: {
        assigned_program_id: programId,
        source_routine_id: template.id,
        name: template.name,
        description: template.description,
        estimated_duration_minutes: template.estimated_duration_minutes,
        order_in_program: body.order_in_program,
        days_of_week: body.days_of_week,
      },
    });

    logger.info('Program routine added from template', {
      programId,
      sourceRoutineId: template.id,
      coachId: coach.user_id,
    });

    const tree = await fetchProgramTree(programId);
    sendSuccess(res, { program: shapeProgramTree(tree) }, 201);
  } else {
    // Inline creation
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
          if (exercise.user_id !== coach.user_id && !exercise.is_public) {
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

    logger.info('Program routine added inline', {
      programId,
      coachId: coach.user_id,
    });

    const tree = await fetchProgramTree(programId);
    sendSuccess(res, { program: shapeProgramTree(tree) }, 201);
  }
};

/**
 * Update a routine within a program.
 * PATCH /coach/programs/:programId/routines/:aprId
 * @param req - Express request
 * @param res - Express response
 */
export const updateProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId, aprId } = res.locals.validated
    ?.params as UpdateProgramRoutineParams;
  const {
    name,
    description,
    estimated_duration_minutes,
    days_of_week,
    order_in_program,
  } = res.locals.validated?.body as UpdateProgramRoutineInput;

  await requireProgramRoutine(aprId, programId, coach.user_id);

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

  logger.info('Program routine updated', {
    programId,
    aprId,
    coachId: coach.user_id,
  });

  const tree = await fetchProgramTree(programId);
  sendSuccess(res, { program: shapeProgramTree(tree) });
};

/**
 * Soft-delete a routine from a program.
 * DELETE /coach/programs/:programId/routines/:aprId
 * @param req - Express request
 * @param res - Express response
 */
export const deleteProgramRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId, aprId } = res.locals.validated
    ?.params as DeleteProgramRoutineParams;

  await requireProgramRoutine(aprId, programId, coach.user_id);

  await prisma.assigned_program_routine.update({
    where: { id: aprId },
    data: { deleted_at: new Date() },
  });

  logger.info('Program routine removed', {
    programId,
    aprId,
    coachId: coach.user_id,
  });

  sendSuccess(res, { message: 'Routine removed from program' });
};

// ============== Program Routine Exercise Controllers ==============

/**
 * Add an exercise to a program routine.
 * POST /coach/programs/:programId/routines/:aprId/exercises
 * @param req - Express request
 * @param res - Express response
 */
export const addProgramRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId, aprId } = res.locals.validated
    ?.params as AddProgramRoutineExerciseParams;
  const {
    exercise_id,
    sets,
    reps_min,
    reps_max,
    rest_seconds,
    order_in_routine,
  } = res.locals.validated?.body as AddProgramRoutineExerciseInput;

  await requireProgramRoutine(aprId, programId, coach.user_id);

  // Verify exercise exists and is accessible
  const exercise = await prisma.exercise.findUnique({
    where: { id: exercise_id },
  });
  if (!exercise || exercise.deleted_at) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }
  if (exercise.user_id !== coach.user_id && !exercise.is_public) {
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

  logger.info('Program routine exercise added', {
    programId,
    aprId,
    apreId: apre.id,
    coachId: coach.user_id,
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
 * Update an exercise within a program routine.
 * PATCH /coach/programs/:programId/routines/:aprId/exercises/:apreId
 * @param req - Express request
 * @param res - Express response
 */
export const updateProgramRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId, aprId, apreId } = res.locals.validated
    ?.params as UpdateProgramRoutineExerciseParams;
  const {
    exercise_id,
    sets,
    reps_min,
    reps_max,
    rest_seconds,
    order_in_routine,
  } = res.locals.validated?.body as UpdateProgramRoutineExerciseInput;

  await requireProgramRoutine(aprId, programId, coach.user_id);

  // Verify the exercise row exists and belongs to this apr
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

  // If changing exercise_id, verify the new exercise
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
    if (exercise.user_id !== coach.user_id && !exercise.is_public) {
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

  logger.info('Program routine exercise updated', {
    programId,
    aprId,
    apreId,
    coachId: coach.user_id,
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
 * Delete an exercise from a program routine.
 * DELETE /coach/programs/:programId/routines/:aprId/exercises/:apreId
 * @param req - Express request
 * @param res - Express response
 */
export const deleteProgramRoutineExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { programId, aprId, apreId } = res.locals.validated
    ?.params as DeleteProgramRoutineExerciseParams;

  await requireProgramRoutine(aprId, programId, coach.user_id);

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

  await prisma.assigned_program_routine_exercise.update({
    where: { id: apreId },
    data: { deleted_at: new Date() },
  });

  logger.info('Program routine exercise removed', {
    programId,
    aprId,
    apreId,
    coachId: coach.user_id,
  });

  sendSuccess(res, { message: 'Routine exercise removed successfully' });
};

// ============== Routine Template Controllers (Coach Library) ==============

/**
 * Create a routine template.
 * POST /coach/routine-templates
 * @param req - Express request
 * @param res - Express response
 */
export const createRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { name, description, estimated_duration_minutes } = res.locals.validated
    ?.body as CreateRoutineInput;

  const routine = await prisma.routine.create({
    data: {
      user_id: appUser.supabase_auth_id,
      name,
      description,
      estimated_duration_minutes,
    },
  });

  logger.info('Routine template created', {
    routineId: routine.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(
    res,
    {
      routine: {
        id: routine.id,
        user_id: routine.user_id,
        name: routine.name,
        description: routine.description,
        estimated_duration_minutes: routine.estimated_duration_minutes,
        created_at: routine.created_at,
        updated_at: routine.updated_at,
      },
    },
    201
  );
};

/**
 * List coach's routine templates.
 * GET /coach/routine-templates
 * @param req - Express request
 * @param res - Express response
 */
export const getCoachRoutines = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset } = res.locals.validated
    ?.query as GetCoachRoutinesQuery;

  const [routines, total] = await Promise.all([
    prisma.routine.findMany({
      where: { user_id: appUser.supabase_auth_id, deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.routine.count({
      where: { user_id: appUser.supabase_auth_id, deleted_at: null },
    }),
  ]);

  sendSuccess(res, {
    routines: routines.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      description: r.description,
      estimated_duration_minutes: r.estimated_duration_minutes,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + routines.length < total,
    },
  });
};

/**
 * Get a routine template by ID.
 * GET /coach/routine-templates/:routineId
 * @param req - Express request
 * @param res - Express response
 */
export const getCoachRoutineById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated?.params as { routineId: string };

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
  });

  if (
    !routine ||
    routine.user_id !== appUser.supabase_auth_id ||
    routine.deleted_at
  ) {
    throw new NotFoundException(
      'WORKOUT_ROUTINE_NOT_FOUND',
      'Routine not found or access denied'
    );
  }

  sendSuccess(res, {
    routine: {
      id: routine.id,
      user_id: routine.user_id,
      name: routine.name,
      description: routine.description,
      estimated_duration_minutes: routine.estimated_duration_minutes,
      created_at: routine.created_at,
      updated_at: routine.updated_at,
    },
  });
};

/**
 * Update a routine template.
 * PATCH /coach/routine-templates/:routineId
 * @param req - Express request
 * @param res - Express response
 */
export const updateRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated?.params as { routineId: string };
  const { name, description, estimated_duration_minutes } = res.locals.validated
    ?.body as UpdateRoutineInput;

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
  if (
    !existing ||
    existing.user_id !== appUser.supabase_auth_id ||
    existing.deleted_at
  ) {
    throw new NotFoundException(
      'WORKOUT_ROUTINE_NOT_FOUND',
      'Routine not found or access denied'
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

  logger.info('Routine template updated', {
    routineId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, {
    routine: {
      id: routine.id,
      user_id: routine.user_id,
      name: routine.name,
      description: routine.description,
      estimated_duration_minutes: routine.estimated_duration_minutes,
      created_at: routine.created_at,
      updated_at: routine.updated_at,
    },
  });
};

/**
 * Delete a routine template (soft-delete).
 * DELETE /coach/routine-templates/:routineId
 * @param req - Express request
 * @param res - Express response
 */
export const deleteRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { routineId } = res.locals.validated?.params as { routineId: string };

  const existing = await prisma.routine.findUnique({
    where: { id: routineId },
  });
  if (
    !existing ||
    existing.user_id !== appUser.supabase_auth_id ||
    existing.deleted_at
  ) {
    throw new NotFoundException(
      'WORKOUT_ROUTINE_NOT_FOUND',
      'Routine not found or access denied'
    );
  }

  // Soft-delete; assigned_program_routine.source_routine_id stays (onDelete: SetNull handled by DB)
  await prisma.routine.update({
    where: { id: routineId },
    data: { deleted_at: new Date() },
  });

  logger.info('Routine template deleted', {
    routineId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { message: 'Routine template deleted successfully' });
};
