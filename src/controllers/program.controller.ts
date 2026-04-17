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
  AssignRoutineToProgramInput,
  AssignRoutineToProgramParams,
  UpdateProgramRoutineInput,
  UpdateProgramRoutineParams,
  RemoveProgramRoutineParams,
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

const programRoutineShape = (
  programRoutine: {
    id: string;
    assigned_program_id: string;
    routine_id: string;
    days_of_week: string[];
    created_at: Date;
    updated_at: Date;
  },
  programId: string
) => ({
  id: programRoutine.id,
  programId,
  routineId: programRoutine.routine_id,
  dayOfWeek: programRoutine.days_of_week[0] ?? 'MONDAY',
  createdAt: programRoutine.created_at,
  updatedAt: programRoutine.updated_at,
});

const getOrCreateDraftAssignment = async (
  programId: string,
  coachId: string
) => {
  const existing = await prisma.assigned_program.findFirst({
    where: {
      program_id: programId,
      user_id: coachId,
    },
    orderBy: { created_at: 'desc' },
  });

  if (existing) {
    return existing;
  }

  return prisma.assigned_program.create({
    data: {
      program_id: programId,
      user_id: coachId,
    },
  });
};

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

    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        assigned_programs: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            assigned_program_routines: {
              where: { deleted_at: null },
              orderBy: { created_at: 'asc' },
              include: {
                routine: true,
                assigned_program_routine_exercises: {
                  where: { deleted_at: null },
                  orderBy: { order_in_routine: 'asc' },
                  include: { exercise: true },
                },
              },
            },
          },
        },
      },
    });

    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    // Latest snapshot routines (from the most recent assignment)
    const latestAssignment = program.assigned_programs[0] ?? null;
    const assignedRoutines = latestAssignment?.assigned_program_routines ?? [];

    sendSuccess(res, {
      program: {
        id: program.id,
        user_id: program.user_id,
        name: program.name,
        description: program.description,
        deleted_at: program.deleted_at,
        created_at: program.created_at,
        updated_at: program.updated_at,
        routines: assignedRoutines.map((apr) => ({
          id: apr.id,
          dayOfWeek: apr.days_of_week[0] ?? 'MONDAY',
          routine: {
            ...routineShape(apr.routine),
            exercises: apr.assigned_program_routine_exercises.map((e) => ({
              id: e.id,
              exercise_id: e.exercise_id,
              sets: e.sets,
              reps_min: e.reps_min,
              reps_max: e.reps_max,
              rest_seconds: e.rest_seconds,
              order_in_routine: e.order_in_routine,
              exercise: e.exercise
                ? {
                    id: e.exercise.id,
                    name: e.exercise.name,
                    description: e.exercise.description,
                    target_muscles: e.exercise.target_muscles,
                  }
                : undefined,
            })),
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
        include: {
          _count: { select: { assigned_program_routines: true } },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.routine.count({ where: { user_id: appUser.supabase_auth_id } }),
    ]);

    sendSuccess(res, {
      routines: routines.map((routine) => ({
        ...routineShape(routine),
        assignment_count: routine._count.assigned_program_routines,
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

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
    });

    if (!routine || routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    sendSuccess(res, { routine: routineShape(routine) });
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

// ============== ProgramRoutine Controllers ==============

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
    const { routine_id, day_of_week } = res.locals.validated
      ?.body as AssignRoutineToProgramInput;

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    const routine = await prisma.routine.findUnique({
      where: { id: routine_id },
    });
    if (!routine || routine.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Routine not found or access denied', 404);
      return;
    }

    const draftAssignment = await getOrCreateDraftAssignment(
      programId,
      appUser.supabase_auth_id
    );

    const existingDaySlot = await prisma.assigned_program_routine.findFirst({
      where: {
        assigned_program_id: draftAssignment.id,
        deleted_at: null,
        days_of_week: { has: day_of_week },
      },
    });
    if (existingDaySlot) {
      sendSingleError(res, 'A routine is already assigned for this day', 409);
      return;
    }

    const assignment = await prisma.assigned_program_routine.create({
      data: {
        assigned_program_id: draftAssignment.id,
        routine_id,
        days_of_week: [day_of_week],
      },
    });

    logger.info('Routine assigned to program', {
      programId,
      routine_id,
      day_of_week,
      coachId: appUser.supabase_auth_id,
      assignmentId: assignment.id,
    });
    sendSuccess(
      res,
      { assignment: programRoutineShape(assignment, programId) },
      201
    );
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

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    const existing = await prisma.assigned_program_routine.findFirst({
      where: {
        id: programRoutineId,
        deleted_at: null,
        assigned_program: {
          program_id: programId,
          user_id: appUser.supabase_auth_id,
        },
      },
    });

    if (!existing) {
      sendSingleError(res, 'Program routine not found or access denied', 404);
      return;
    }

    const dayConflict = await prisma.assigned_program_routine.findFirst({
      where: {
        assigned_program_id: existing.assigned_program_id,
        deleted_at: null,
        id: { not: programRoutineId },
        days_of_week: { has: day_of_week },
      },
    });
    if (dayConflict) {
      sendSingleError(res, 'A routine is already assigned for this day', 409);
      return;
    }

    const programRoutine = await prisma.assigned_program_routine.update({
      where: { id: programRoutineId },
      data: { days_of_week: [day_of_week] },
    });

    logger.info('Program routine day updated', {
      programId,
      programRoutineId,
      day_of_week,
      coachId: appUser.supabase_auth_id,
    });
    sendSuccess(res, {
      programRoutine: programRoutineShape(programRoutine, programId),
    });
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

    const program = await prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program || program.user_id !== appUser.supabase_auth_id) {
      sendSingleError(res, 'Program not found or access denied', 404);
      return;
    }

    const existing = await prisma.assigned_program_routine.findFirst({
      where: {
        id: programRoutineId,
        deleted_at: null,
        assigned_program: {
          program_id: programId,
          user_id: appUser.supabase_auth_id,
        },
      },
    });

    if (!existing) {
      sendSingleError(res, 'Program routine not found or access denied', 404);
      return;
    }

    await prisma.assigned_program_routine.update({
      where: { id: programRoutineId },
      data: { deleted_at: new Date() },
    });

    logger.info('Program routine removed', {
      programId,
      programRoutineId,
      coachId: appUser.supabase_auth_id,
    });
    sendSuccess(res, { message: 'Routine removed from program' });
  } catch (error) {
    logger.error('Error removing program routine', error);
    sendSingleError(res, 'Failed to remove program routine', 500);
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
