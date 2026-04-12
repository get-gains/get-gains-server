import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
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
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { name, description, target_muscles, is_public } = res.locals
      .validated?.body as CreatePersonalExerciseInput;

    const existing = await prisma.exercise.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ is_public: true }, { user_id: appUser.supabase_auth_id }],
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
  } catch (error) {
    logger.error('Error creating personal exercise', error);
    sendSingleError(res, 'Failed to create exercise', 500);
  }
};

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
  } catch (error) {
    logger.error('Error fetching personal exercises', error);
    sendSingleError(res, 'Failed to fetch exercises', 500);
  }
};

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

    if (!exercise || exercise.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
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

    logger.info('Personal exercise updated', {
      exerciseId: updated.id,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { exercise: updated });
  } catch (error) {
    logger.error('Error updating personal exercise', error);
    sendSingleError(res, 'Failed to update exercise', 500);
  }
};

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
    if (!exercise || exercise.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Exercise not found', 404);
      return;
    }

    await prisma.exercise.delete({ where: { id: exerciseId } });
    logger.info('Personal exercise deleted', {
      exerciseId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting personal exercise', error);
    sendSingleError(res, 'Failed to delete exercise', 500);
  }
};

// ============== Personal Routine Controllers ==============

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

    const { name, description, estimated_duration_minutes } = res.locals
      .validated?.body as CreatePersonalRoutineInput;

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
  } catch (error) {
    logger.error('Error creating personal routine', error);
    sendSingleError(res, 'Failed to create routine', 500);
  }
};

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
  } catch (error) {
    logger.error('Error fetching personal routines', error);
    sendSingleError(res, 'Failed to fetch routines', 500);
  }
};

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
    });
    if (!routine || routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    sendSuccess(res, { routine });
  } catch (error) {
    logger.error('Error fetching personal routine', error);
    sendSingleError(res, 'Failed to fetch routine', 500);
  }
};

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
    const { name, description, estimated_duration_minutes } = res.locals
      .validated?.body as UpdatePersonalRoutineInput;

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
      sendSingleError(res, 'Routine not found', 404);
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

    logger.info('Personal routine updated', {
      routineId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { routine });
  } catch (error) {
    logger.error('Error updating personal routine', error);
    sendSingleError(res, 'Failed to update routine', 500);
  }
};

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
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found', 404);
      return;
    }

    await prisma.routine.delete({ where: { id: routineId } });
    logger.info('Personal routine deleted', {
      routineId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting personal routine', error);
    sendSingleError(res, 'Failed to delete routine', 500);
  }
};

// ============== Personal Program Controllers ==============

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
      data: { user_id: appUser.supabase_auth_id, name, description },
    });

    logger.info('Personal program created', {
      programId: program.id,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { program }, 201);
  } catch (error) {
    logger.error('Error creating personal program', error);
    sendSingleError(res, 'Failed to create program', 500);
  }
};

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
  } catch (error) {
    logger.error('Error fetching personal programs', error);
    sendSingleError(res, 'Failed to fetch programs', 500);
  }
};

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
    });
    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    sendSuccess(res, { program });
  } catch (error) {
    logger.error('Error fetching personal program', error);
    sendSingleError(res, 'Failed to fetch program', 500);
  }
};

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
      sendSingleError(res, 'At least one field must be provided', 400);
      return;
    }

    const existing = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
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
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { program });
  } catch (error) {
    logger.error('Error updating personal program', error);
    sendSingleError(res, 'Failed to update program', 500);
  }
};

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
    if (!existing || existing.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found', 404);
      return;
    }

    await prisma.program.delete({ where: { id: programId } });
    logger.info('Personal program deleted', {
      programId,
      user_id: appUser.supabase_auth_id,
    });
    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('Error deleting personal program', error);
    sendSingleError(res, 'Failed to delete program', 500);
  }
};

// ============== Standalone Assignment Controllers ==============

export const createStandaloneAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'User required', 401);
      return;
    }

    const { program_id, notes, start_date, end_date, routines } = res.locals
      .validated?.body as CreateStandaloneAssignmentInput;

    // Verify user owns the program
    const program = await prisma.program.findUnique({
      where: { id: program_id },
    });
    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found', 404);
      return;
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
  } catch (error) {
    logger.error('Error creating standalone assignment', error);
    sendSingleError(res, 'Failed to create assignment', 500);
  }
};

export const getStandaloneAssignments = async (
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
  } catch (error) {
    logger.error('Error fetching standalone assignments', error);
    sendSingleError(res, 'Failed to fetch assignments', 500);
  }
};

export const getStandaloneAssignmentById = async (
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
      sendSingleError(res, 'Assignment not found', 404);
      return;
    }

    sendSuccess(res, { assignment });
  } catch (error) {
    logger.error('Error fetching standalone assignment', error);
    sendSingleError(res, 'Failed to fetch assignment', 500);
  }
};

// ============== Today's Workout Controller ==============

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
      sendSingleError(res, 'No program assignment found', 404);
      return;
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
  } catch (error) {
    logger.error('Error fetching standalone today', error);
    sendSingleError(res, "Failed to fetch today's workout", 500);
  }
};

// ============== Session Controllers ==============

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

    const { assigned_program_routine_id } = res.locals.validated
      ?.body as StartStandaloneSessionInput;

    // Validate ownership via relational path
    const apr = await prisma.assigned_program_routine.findUnique({
      where: { id: assigned_program_routine_id },
      include: { assigned_program: true },
    });

    if (!apr || apr.assigned_program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Assigned routine not found', 404);
      return;
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
      sendSingleError(
        res,
        'You already have an active workout session. Complete it first.',
        409
      );
      return;
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
  } catch (error) {
    logger.error('Error starting standalone session', error);
    sendSingleError(res, 'Failed to start workout session', 500);
  }
};

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
  } catch (error) {
    logger.error('Error fetching standalone active session', error);
    sendSingleError(res, 'Failed to fetch active session', 500);
  }
};

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
      sendSingleError(res, 'Workout session not found', 404);
      return;
    }

    if (session.completed_at) {
      sendSingleError(res, 'Workout session is already completed', 400);
      return;
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
  } catch (error) {
    logger.error('Error completing standalone session', error);
    sendSingleError(res, 'Failed to complete workout session', 500);
  }
};

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
  } catch (error) {
    logger.error('Error fetching standalone sessions', error);
    sendSingleError(res, 'Failed to fetch sessions', 500);
  }
};

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

    const session = await prisma.workout_session.findFirst({
      where: {
        id: sessionId,
        assigned_program_routine: {
          assigned_program: { user_id: appUser.supabase_auth_id },
        },
      },
    });

    if (!session) {
      sendSingleError(res, 'Session not found', 404);
      return;
    }

    sendSuccess(res, { session });
  } catch (error) {
    logger.error('Error fetching standalone session', error);
    sendSingleError(res, 'Failed to fetch session', 500);
  }
};

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
  } catch (error) {
    logger.error('Error fetching standalone weekly stats', error);
    sendSingleError(res, 'Failed to fetch weekly stats', 500);
  }
};
