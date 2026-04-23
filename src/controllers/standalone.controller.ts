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
import { calculateSessionCoins } from '../services/coin-calculation.service';
import { createAssignment } from '../services/assignment.service';
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
  CreatePersonalProgramInput,
  GetPersonalProgramsQuery,
  GetPersonalProgramByIdParams,
  UpdatePersonalProgramParams,
  UpdatePersonalProgramInput,
  DeletePersonalProgramParams,
  StartStandaloneSessionInput,
  CompleteStandaloneSessionParams,
  CompleteStandaloneSessionInput,
  GetStandaloneSessionsQuery,
  GetStandaloneSessionByIdParams,
  CreateStandaloneAssignmentInput,
  GetStandaloneAssignmentsQuery,
  GetStandaloneAssignmentByIdParams,
} from '../schemas/standalone.schema';

// ============== Personal Exercise Controllers ==============

export const createPersonalExercise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { name, description, target_muscles, is_public } = res.locals.validated
    ?.body as CreatePersonalExerciseInput;

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

// ============== Personal Routine Controllers ==============

export const createPersonalRoutine = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { name, description, estimated_duration_minutes } = res.locals.validated
    ?.body as CreatePersonalRoutineInput;

  const routine = await prisma.routine.create({
    data: {
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

// ============== Personal Program Controllers ==============

export const createPersonalProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { name, description } = res.locals.validated
    ?.body as CreatePersonalProgramInput;

  const program = await prisma.program.create({
    data: { user_id: appUser.supabase_auth_id, name, description },
  });

  logger.info('Personal program created', {
    programId: program.id,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { program }, 201);
};

export const getPersonalPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset } = res.locals.validated
    ?.query as GetPersonalProgramsQuery;

  const [programs, total] = await Promise.all([
    prisma.program.findMany({
      where: { user_id: appUser.supabase_auth_id },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.program.count({ where: { user_id: appUser.supabase_auth_id } }),
  ]);

  sendSuccess(res, {
    programs,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + programs.length < total,
    },
  });
};

export const getPersonalProgramById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as GetPersonalProgramByIdParams;

  const program = await prisma.program.findUnique({
    where: { id: programId },
  });
  if (!program || program.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  sendSuccess(res, { program });
};

export const updatePersonalProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as UpdatePersonalProgramParams;
  const { name, description } = res.locals.validated
    ?.body as UpdatePersonalProgramInput;

  if (!name && !description) {
    throw new BadRequestException(
      'VALIDATION_ERROR',
      'At least one field must be provided'
    );
  }

  const existing = await prisma.program.findUnique({
    where: { id: programId },
  });
  if (!existing || existing.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
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
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { program });
};

export const deletePersonalProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { programId } = res.locals.validated
    ?.params as DeletePersonalProgramParams;

  const existing = await prisma.program.findUnique({
    where: { id: programId },
  });
  if (!existing || existing.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  await prisma.program.delete({ where: { id: programId } });
  logger.info('Personal program deleted', {
    programId,
    user_id: appUser.supabase_auth_id,
  });
  sendSuccess(res, { deleted: true });
};

// ============== Standalone Assignment Controllers ==============

export const createStandaloneAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { program_id, notes, start_date, end_date, routines } = res.locals
    .validated?.body as CreateStandaloneAssignmentInput;

  // Verify user owns the program
  const program = await prisma.program.findUnique({
    where: { id: program_id },
  });
  if (!program || program.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException('PROGRAM_NOT_FOUND', 'Program not found');
  }

  const assignment = await createAssignment({
    user_id: appUser.supabase_auth_id,
    program_id,
    notes,
    start_date,
    end_date,
    routines,
  });

  logger.info('Standalone assignment created', {
    assignmentId: assignment.id,
    user_id: appUser.supabase_auth_id,
    program_id,
  });
  sendSuccess(res, { assignment }, 201);
};

export const getStandaloneAssignments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset } = res.locals.validated
    ?.query as GetStandaloneAssignmentsQuery;

  const [assignments, total] = await Promise.all([
    prisma.assigned_program.findMany({
      where: { user_id: appUser.supabase_auth_id },
      include: {
        _count: { select: { assigned_program_routines: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.assigned_program.count({
      where: { user_id: appUser.supabase_auth_id },
    }),
  ]);

  sendSuccess(res, {
    assignments: assignments.map((a) => ({
      id: a.id,
      program_id: a.program_id,
      user_id: a.user_id,
      notes: a.notes,
      start_date: a.start_date,
      end_date: a.end_date,
      routine_count: a._count.assigned_program_routines,
      created_at: a.created_at,
      updated_at: a.updated_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + assignments.length < total,
    },
  });
};

export const getStandaloneAssignmentById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { assignedProgramId } = res.locals.validated
    ?.params as GetStandaloneAssignmentByIdParams;

  const assignment = await prisma.assigned_program.findUnique({
    where: { id: assignedProgramId },
    include: {
      assigned_program_routines: {
        include: { assigned_program_routine_exercises: true },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!assignment || assignment.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException('ASSIGNMENT_NOT_FOUND', 'Assignment not found');
  }

  sendSuccess(res, { assignment });
};

// ============== Today's Workout Controller ==============

export const getStandaloneToday = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  // Latest assignment for user
  const assignment = await prisma.assigned_program.findFirst({
    where: { user_id: appUser.supabase_auth_id },
    orderBy: { created_at: 'desc' },
    include: {
      assigned_program_routines: {
        include: { assigned_program_routine_exercises: true },
      },
    },
  });

  if (!assignment) {
    throw new NotFoundException(
      'STANDALONE_NOT_FOUND',
      'No program assignment found'
    );
  }

  const TODAY = new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase(); // e.g. "MONDAY"

  const todayRoutines = assignment.assigned_program_routines.filter((apr) =>
    apr.days_of_week.includes(TODAY)
  );

  if (todayRoutines.length === 0) {
    sendSuccess(res, {
      today: null,
      is_rest_day: true,
      message: 'Rest day — no routines scheduled for today',
      assignment_id: assignment.id,
    });
    return;
  }

  sendSuccess(res, {
    today: todayRoutines,
    is_rest_day: false,
    assignment_id: assignment.id,
  });
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

  const { assigned_program_routine_id } = res.locals.validated
    ?.body as StartStandaloneSessionInput;

  // Validate ownership via relational path
  const apr = await prisma.assigned_program_routine.findUnique({
    where: { id: assigned_program_routine_id },
    include: { assigned_program: true },
  });

  if (!apr || apr.assigned_program.user_id !== appUser.supabase_auth_id) {
    throw new NotFoundException(
      'STANDALONE_NOT_FOUND',
      'Assigned routine not found'
    );
  }

  // Check for already-active session
  const activeSession = await prisma.workout_session.findFirst({
    where: {
      completed_at: null,
      deleted_at: null,
      assigned_program_routine: {
        assigned_program: { user_id: appUser.supabase_auth_id },
      },
    },
  });

  if (activeSession) {
    throw new ConflictException(
      'WORKOUT_SESSION_ALREADY_ACTIVE',
      'You already have an active workout session. Complete it first.'
    );
  }

  const session = await prisma.workout_session.create({
    data: {
      assigned_program_routine_id,
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

  const session = await prisma.workout_session.findFirst({
    where: {
      completed_at: null,
      deleted_at: null,
      assigned_program_routine: {
        assigned_program: { user_id: appUser.supabase_auth_id },
      },
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

  const session = await prisma.workout_session.findFirst({
    where: {
      id: sessionId,
      assigned_program_routine: {
        assigned_program: { user_id: appUser.supabase_auth_id },
      },
    },
  });

  if (!session) {
    throw new NotFoundException(
      'SESSION_NOT_FOUND',
      'Workout session not found'
    );
  }

  if (session.completed_at) {
    throw new BadRequestException(
      'STANDALONE_ALREADY_COMPLETED',
      'Workout session is already completed'
    );
  }

  const updatedSession = await prisma.workout_session.update({
    where: { id: sessionId },
    data: { completed_at: new Date(), feedback },
  });

  logger.info('Standalone session completed', {
    sessionId,
    user_id: appUser.supabase_auth_id,
  });

  let coinReward = null;
  try {
    coinReward = await calculateSessionCoins(
      appUser.supabase_auth_id,
      sessionId,
      prisma
    );
  } catch (coinError) {
    logger.error('Failed to award coins for standalone session', {
      sessionId,
      user_id: appUser.supabase_auth_id,
      error: coinError,
    });
  }

  sendSuccess(res, {
    session: updatedSession,
    ...(coinReward ? { coinReward } : {}),
  });
};

export const getStandaloneSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  const { limit, offset, startDate, endDate } = res.locals.validated
    ?.query as GetStandaloneSessionsQuery;

  const where: Record<string, unknown> = {
    completed_at: { not: null },
    assigned_program_routine: {
      assigned_program: { user_id: appUser.supabase_auth_id },
    },
  };

  if (startDate || endDate) {
    where.started_at = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  const [sessions, total] = await Promise.all([
    prisma.workout_session.findMany({
      where,
      orderBy: { started_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.workout_session.count({ where }),
  ]);

  sendSuccess(res, {
    sessions,
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

  const session = await prisma.workout_session.findFirst({
    where: {
      id: sessionId,
      assigned_program_routine: {
        assigned_program: { user_id: appUser.supabase_auth_id },
      },
    },
  });

  if (!session) {
    throw new NotFoundException('SESSION_NOT_FOUND', 'Session not found');
  }

  sendSuccess(res, { session });
};

export const getStandaloneWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    throw new UnauthorizedException('AUTH_APP_USER_NOT_FOUND', 'User required');
  }

  // Start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  const sessions = await prisma.workout_session.findMany({
    where: {
      completed_at: { not: null, gte: weekStart },
      assigned_program_routine: {
        assigned_program: { user_id: appUser.supabase_auth_id },
      },
    },
    select: { id: true, started_at: true, completed_at: true },
  });

  const totalDurationMs = sessions.reduce((sum, s) => {
    if (s.started_at && s.completed_at) {
      return sum + (s.completed_at.getTime() - s.started_at.getTime());
    }
    return sum;
  }, 0);

  sendSuccess(res, {
    week_start: weekStart,
    sessions_completed: sessions.length,
    total_duration_minutes: Math.round(totalDurationMs / 60000),
  });
};
