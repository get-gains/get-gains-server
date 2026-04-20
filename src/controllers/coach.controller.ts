import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '../lib/errors';
import {
  CreateCoachProfileInput,
  GetClientsQuery,
  GetPerformanceQuery,
  GetClientProgramsParams,
  UpdateAssignmentParams,
  UpdateAssignmentInput,
  DeleteAssignmentParams,
  GetClientSessionsParams,
  GetClientSessionsQuery,
  GetClientSessionDetailParams,
  GetClientWeeklyStatsParams,
  GetClientWeeklyStatsQuery,
  GetClientExerciseHistoryParams,
  GetClientExerciseHistoryQuery,
} from '../schemas/coach.schema';
import { getUserBySupabaseId } from './user.controller';

/**
 * Create coach profile (become a coach). Any authenticated user can call.
 * Returns 409 if user already has a coach profile.
 */
export const createCoachProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const supabaseUser = req.user;
  if (!supabaseUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const supabaseId =
    'supabase_auth_id' in supabaseUser
      ? supabaseUser.supabase_auth_id
      : supabaseUser.id;
  const appUser = await getUserBySupabaseId(supabaseId);

  if (!appUser) {
    throw new UnauthorizedException('AUTH_USER_NOT_FOUND', 'User not found');
  }

  const existingCoach = await prisma.coach.findUnique({
    where: { user_id: appUser.supabase_auth_id },
  });

  if (existingCoach) {
    throw new ConflictException(
      'COACH_ALREADY_EXISTS',
      'User is already a coach'
    );
  }

  const body = (res.locals.validated?.body as CreateCoachProfileInput) ?? {};

  const [coach] = await prisma.$transaction([
    prisma.coach.create({
      data: {
        user_id: appUser.supabase_auth_id,
        certifications: body.certifications ?? [],
        specialties: body.specialties ?? [],
        social_links: body.social_links ?? [],
        ...(body.max_clients !== undefined && {
          max_clients: body.max_clients,
        }),
        ...(body.accepting_clients !== undefined && {
          accepting_clients: body.accepting_clients,
        }),
        ...(body.is_discoverable !== undefined && {
          is_discoverable: body.is_discoverable,
        }),
      },
    }),
    prisma.user.update({
      where: { supabase_auth_id: appUser.supabase_auth_id },
      data: { is_coach: true },
    }),
  ]);

  logger.info('Coach profile created', {
    userId: appUser.supabase_auth_id,
  });

  sendSuccess(
    res,
    {
      coach: {
        user_id: coach.user_id,
        name: appUser.full_name,
        email: appUser.email,
        certifications: coach.certifications,
        specialties: coach.specialties,
        social_links: coach.social_links,
        max_clients: coach.max_clients,
        accepting_clients: coach.accepting_clients,
        is_discoverable: coach.is_discoverable,
      },
      isCoach: true,
    },
    201
  );
};

/**
 * Get coach's clients with optional filter (assigned / unassigned)
 */
export const getClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { filter, limit, offset } = res.locals.validated
    ?.query as GetClientsQuery;

  logger.debug('Fetching coach clients', {
    coachId: coach.user_id,
    filter,
    limit,
    offset,
  });

  const classRelations = await prisma.subscribed_coach.findMany({
    where: {
      coach_id: coach.user_id,
      ended_at: null,
    },
    include: {
      user: {
        select: {
          supabase_auth_id: true,
          email: true,
          full_name: true,
          nickname: true,
          client_programs: {
            where: { deleted_at: null },
            select: {
              id: true,
              name: true,
              is_active: true,
            },
          },
          active_subscription_tier: true,
          active_weekdays: true,
          user_subscription: {
            select: { current_period_end: true },
          },
        },
      },
    },
    orderBy: { started_at: 'desc' },
  });

  let clients = classRelations.map((cr) => ({
    id: cr.user.supabase_auth_id,
    email: cr.user.email,
    name: cr.user.full_name,
    nickname: cr.user.nickname,
    subscribedAt: cr.started_at,
    subscriptionExpiresAt:
      cr.user.user_subscription?.current_period_end ?? null,
    activeWeekdays: cr.user.active_weekdays,
    assignedPrograms: cr.user.client_programs.map((ap) => ({
      id: ap.id,
      name: ap.name,
      isActive: ap.is_active,
    })),
    isAssigned: cr.user.client_programs.length > 0,
  }));

  if (filter === 'assigned') {
    clients = clients.filter((c) => c.isAssigned);
  } else if (filter === 'unassigned') {
    clients = clients.filter((c) => !c.isAssigned);
  }

  const total = clients.length;
  const paginatedClients = clients.slice(offset, offset + limit);

  sendSuccess(res, {
    clients: paginatedClients,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + paginatedClients.length < total,
    },
  });
};

/**
 * Get performance report (good performance / falling behind)
 * NOTE(B11): workout_session is no longer directly on user; this simplified version
 * marks all assigned clients as 'good' since last-session lookup requires a nested
 * relational path. TODO(B11): restore accurate status via assigned_programs →
 * assigned_program_routines → workout_sessions when needed.
 */
export const getPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { limit, offset } = res.locals.validated?.query as GetPerformanceQuery;

  logger.debug('Fetching performance report', {
    coachId: coach.user_id,
    limit,
    offset,
  });

  const classRelations = await prisma.subscribed_coach.findMany({
    where: {
      coach_id: coach.user_id,
      ended_at: null,
    },
    include: {
      user: {
        select: {
          supabase_auth_id: true,
          email: true,
          full_name: true,
          nickname: true,
          client_programs: {
            select: { id: true },
          },
        },
      },
    },
  });

  // TODO(B11): restore lastCompletedAt status logic via nested relational path
  // assigned_programs → assigned_program_routines → workout_sessions
  const performanceData = classRelations
    .filter((cr) => cr.user.client_programs.length > 0)
    .map((cr) => {
      return {
        id: cr.user.supabase_auth_id,
        email: cr.user.email,
        name: cr.user.full_name,
        nickname: cr.user.nickname,
        status: 'good' as 'good' | 'falling_behind',
        lastCompletedAt: null,
      };
    });

  const good = performanceData.filter((p) => p.status === 'good');
  const fallingBehind = performanceData.filter(
    (p) => p.status === 'falling_behind'
  );

  const paginatedData = performanceData.slice(offset, offset + limit);

  sendSuccess(res, {
    performance: paginatedData,
    summary: {
      good: good.length,
      fallingBehind: fallingBehind.length,
    },
    pagination: {
      total: performanceData.length,
      limit,
      offset,
      hasMore: offset + paginatedData.length < performanceData.length,
    },
  });
};

// ============== Assignment Management Controllers ==============

/**
 * Get all program assignments for a specific client (coach's clients only).
 */
export const getClientPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { userId } = res.locals.validated?.params as GetClientProgramsParams;

  // Verify the client is currently in this coach's class
  const isInClass = await prisma.subscribed_coach.findFirst({
    where: { user_id: userId, coach_id: coach.user_id, ended_at: null },
  });

  if (!isInClass) {
    throw new NotFoundException(
      'COACH_CLIENT_NOT_FOUND',
      'Client not found in class'
    );
  }

  // Return only assignments where this coach is the owner
  const assignments = await prisma.assigned_program.findMany({
    where: {
      user_id: userId,
      coach_id: coach.user_id,
      deleted_at: null,
    },
    include: {
      _count: { select: { assigned_program_routines: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  sendSuccess(res, {
    assignments: assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      coach_id: a.coach_id,
      name: a.name,
      description: a.description,
      is_active: a.is_active,
      start_date: a.start_date,
      end_date: a.end_date,
      notes: a.notes,
      routine_count: a._count.assigned_program_routines,
      created_at: a.created_at,
      updated_at: a.updated_at,
    })),
  });
};

/**
 * Update an existing program assignment's dates or notes.
 */
export const updateAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { assignmentId } = res.locals.validated
    ?.params as UpdateAssignmentParams;
  const { startDate, endDate, notes } = res.locals.validated
    ?.body as UpdateAssignmentInput;

  if (startDate === undefined && endDate === undefined && notes === undefined) {
    throw new BadRequestException(
      'VALIDATION_ERROR',
      'At least one field must be provided'
    );
  }

  // Verify assignment exists and belongs to this coach
  const assignment = await prisma.assigned_program.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.coach_id !== coach.user_id) {
    throw new NotFoundException(
      'ASSIGNMENT_NOT_FOUND',
      'Assignment not found or access denied'
    );
  }

  const updated = await prisma.assigned_program.update({
    where: { id: assignmentId },
    data: {
      ...(startDate !== undefined && { start_date: new Date(startDate) }),
      ...(endDate !== undefined && {
        end_date: endDate ? new Date(endDate) : null,
      }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      user: {
        select: {
          supabase_auth_id: true,
          email: true,
          full_name: true,
          nickname: true,
        },
      },
    },
  });

  logger.info('Assignment updated', { assignmentId, coachId: coach.user_id });
  sendSuccess(res, {
    assignment: {
      id: updated.id,
      user_id: updated.user_id,
      coach_id: updated.coach_id,
      name: updated.name,
      description: updated.description,
      start_date: updated.start_date,
      end_date: updated.end_date,
      notes: updated.notes,
      user: updated.user,
      updated_at: updated.updated_at,
    },
  });
};

/**
 * Delete a program assignment.
 */
export const deleteAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { assignmentId } = res.locals.validated
    ?.params as DeleteAssignmentParams;

  const assignment = await prisma.assigned_program.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.coach_id !== coach.user_id) {
    throw new NotFoundException(
      'ASSIGNMENT_NOT_FOUND',
      'Assignment not found or access denied'
    );
  }

  await prisma.assigned_program.update({
    where: { id: assignmentId },
    data: { deleted_at: new Date(), is_active: false },
  });

  logger.info('Assignment deleted', {
    assignmentId,
    coachId: coach.user_id,
  });
  sendSuccess(res, { message: 'Assignment deleted successfully' });
};

// ============== Client Progress Controllers (GAP 1) ==============

/**
 * Helper: verify that the given userId is an active client of this coach.
 * Throws NotFoundException if not found.
 */
async function verifyCoachClientRelationship(
  coachId: string,
  userId: string
): Promise<void> {
  const relation = await prisma.subscribed_coach.findFirst({
    where: { user_id: userId, coach_id: coachId, ended_at: null },
  });
  if (!relation) {
    throw new NotFoundException(
      'COACH_CLIENT_NOT_FOUND',
      'Client not found in class'
    );
  }
}

/**
 * GET /coach/clients/:userId/sessions
 * List a client's workout sessions (paginated) with set/exercise counts.
 */
export const getClientSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { userId } = res.locals.validated?.params as GetClientSessionsParams;
  const { limit, offset, status, startDate, endDate } = res.locals.validated
    ?.query as GetClientSessionsQuery;

  await verifyCoachClientRelationship(coach.user_id, userId);

  logger.debug('Fetching client sessions', {
    coachId: coach.user_id,
    userId,
    limit,
    offset,
    status,
  });

  // Filter via relational path since workout_session has no direct userId
  const where: Prisma.workout_sessionWhereInput = {
    assigned_program_routine: {
      assigned_program: { user_id: userId },
    },
  };

  if (status === 'completed') {
    where.completed_at = { not: null };
  } else if (status === 'active') {
    where.completed_at = null;
  }

  if (startDate || endDate) {
    where.started_at = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  const [sessions, total] = await Promise.all([
    prisma.workout_session.findMany({
      where,
      include: {
        assigned_program_routine: {
          include: {
            assigned_program: {
              select: { id: true, name: true },
            },
          },
        },
        performed_sets: {
          select: {
            id: true,
            assigned_program_routine_exercise: {
              select: {
                exercise_id: true,
                exercise: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { started_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.workout_session.count({ where }),
  ]);

  sendSuccess(res, {
    sessions: sessions.map((s) => {
      const durationMinutes =
        s.completed_at && s.started_at
          ? Math.round(
              (new Date(s.completed_at).getTime() -
                new Date(s.started_at).getTime()) /
                60000
            )
          : null;

      const uniqueExercises = new Set(
        s.performed_sets.map(
          (ps) => ps.assigned_program_routine_exercise.exercise_id
        )
      );

      return {
        id: s.id,
        assigned_program_routine_id: s.assigned_program_routine_id,
        programName: s.assigned_program_routine.assigned_program.name ?? null,
        started_at: s.started_at,
        completed_at: s.completed_at,
        durationMinutes,
        totalSets: s.performed_sets.length,
        uniqueExercises: uniqueExercises.size,
        feedback: s.feedback,
      };
    }),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + sessions.length < total,
    },
  });
};

/**
 * GET /coach/clients/:userId/sessions/:sessionId
 * Session detail with all performed sets grouped by exercise.
 */
export const getClientSessionDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { userId, sessionId } = res.locals.validated
    ?.params as GetClientSessionDetailParams;

  await verifyCoachClientRelationship(coach.user_id, userId);

  const session = await prisma.workout_session.findFirst({
    where: {
      id: sessionId,
      assigned_program_routine: {
        assigned_program: { user_id: userId },
      },
    },
    include: {
      assigned_program_routine: {
        include: {
          assigned_program: {
            select: { id: true, name: true },
          },
        },
      },
      performed_sets: {
        include: {
          assigned_program_routine_exercise: {
            include: {
              exercise: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: [
          { assigned_program_routine_exercise_id: 'asc' },
          { set_number: 'asc' },
        ],
      },
    },
  });

  if (!session) {
    throw new NotFoundException('SESSION_NOT_FOUND', 'Session not found');
  }

  const durationMinutes =
    session.completed_at && session.started_at
      ? Math.round(
          (new Date(session.completed_at).getTime() -
            new Date(session.started_at).getTime()) /
            60000
        )
      : null;

  // Group performed sets by exercise
  type ExerciseEntry = {
    exerciseId: string;
    exerciseName: string;
    sets: Array<{
      id: string;
      set_number: number;
      reps: number;
      weight: number | null;
      overall_score: number | null;
      completed_at: Date;
    }>;
  };

  const exerciseMap = new Map<string, ExerciseEntry>();

  for (const ps of session.performed_sets) {
    const exId = ps.assigned_program_routine_exercise.exercise.id;
    if (!exerciseMap.has(exId)) {
      exerciseMap.set(exId, {
        exerciseId: exId,
        exerciseName: ps.assigned_program_routine_exercise.exercise.name,
        sets: [],
      });
    }
    exerciseMap.get(exId)!.sets.push({
      id: ps.id,
      set_number: ps.set_number,
      reps: ps.reps,
      weight: ps.weight,
      overall_score: ps.overall_score,
      completed_at: ps.completed_at,
    });
  }

  sendSuccess(res, {
    session: {
      id: session.id,
      assigned_program_routine_id: session.assigned_program_routine_id,
      programName:
        session.assigned_program_routine.assigned_program.name ?? null,
      started_at: session.started_at,
      completed_at: session.completed_at,
      durationMinutes,
      feedback: session.feedback,
      exercises: Array.from(exerciseMap.values()),
      totalSets: session.performed_sets.length,
      totalReps: session.performed_sets.reduce((s, ps) => s + ps.reps, 0),
      totalVolume: session.performed_sets.reduce(
        (s, ps) => s + ps.reps * (ps.weight ?? 0),
        0
      ),
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
  });
};

/**
 * GET /coach/clients/:userId/stats/weekly
 * Mirror of getWeeklyStats but for a specific client, with previous-week delta.
 */
export const getClientWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { userId } = res.locals.validated?.params as GetClientWeeklyStatsParams;
  const { weekOf } = res.locals.validated?.query as GetClientWeeklyStatsQuery;

  await verifyCoachClientRelationship(coach.user_id, userId);

  // Calculate current week window (Monday–Sunday UTC)
  const referenceDate = weekOf ? new Date(weekOf) : new Date();
  const dayOfWeek = referenceDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(referenceDate);
  weekStart.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  // Previous week window
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
  const prevWeekEnd = new Date(weekStart);

  // Filter via relational path since workout_session has no direct userId
  const userFilter = {
    assigned_program_routine: {
      assigned_program: { user_id: userId },
    },
  };

  // Fetch current week sessions with sets
  const [currentSessions, prevSessions] = await Promise.all([
    prisma.workout_session.findMany({
      where: {
        ...userFilter,
        completed_at: { not: null },
        started_at: { gte: weekStart, lt: weekEnd },
      },
      include: {
        performed_sets: {
          select: { reps: true, weight: true },
        },
      },
    }),
    prisma.workout_session.findMany({
      where: {
        ...userFilter,
        completed_at: { not: null },
        started_at: { gte: prevWeekStart, lt: prevWeekEnd },
      },
      include: {
        performed_sets: {
          select: { reps: true, weight: true },
        },
      },
    }),
  ]);

  const computeStats = (
    sessions: Array<{
      completed_at: Date | null;
      started_at: Date | null;
      performed_sets: Array<{ reps: number; weight: number | null }>;
    }>
  ) => {
    const sessionsCompleted = sessions.length;
    const totalSets = sessions.reduce(
      (sum, s) => sum + s.performed_sets.length,
      0
    );
    const totalReps = sessions.reduce(
      (sum, s) => sum + s.performed_sets.reduce((r, ps) => r + ps.reps, 0),
      0
    );
    const totalVolume = sessions.reduce(
      (sum, s) =>
        sum +
        s.performed_sets.reduce((v, ps) => v + ps.reps * (ps.weight ?? 0), 0),
      0
    );
    const totalMinutes = sessions.reduce((sum, s) => {
      if (s.completed_at && s.started_at) {
        return (
          sum +
          Math.round(
            (new Date(s.completed_at).getTime() -
              new Date(s.started_at).getTime()) /
              60000
          )
        );
      }
      return sum;
    }, 0);

    return {
      sessionsCompleted,
      totalSets,
      totalReps,
      totalVolume,
      totalMinutes,
    };
  };

  const current = computeStats(currentSessions);
  const previous = computeStats(prevSessions);

  sendSuccess(res, {
    stats: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      ...current,
      averageSessionDuration:
        current.sessionsCompleted > 0
          ? Math.round(current.totalMinutes / current.sessionsCompleted)
          : 0,
      delta: {
        sessionsCompleted:
          current.sessionsCompleted - previous.sessionsCompleted,
        totalSets: current.totalSets - previous.totalSets,
        totalReps: current.totalReps - previous.totalReps,
        totalVolume:
          Math.round((current.totalVolume - previous.totalVolume) * 100) / 100,
        totalMinutes: current.totalMinutes - previous.totalMinutes,
      },
    },
  });
};

/**
 * GET /coach/clients/:userId/exercises/:exerciseId/history
 * Exercise-level progress over time for a client, grouped by session.
 */
export const getClientExerciseHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { userId, exerciseId } = res.locals.validated
    ?.params as GetClientExerciseHistoryParams;
  const { limit } = res.locals.validated
    ?.query as GetClientExerciseHistoryQuery;

  await verifyCoachClientRelationship(coach.user_id, userId);

  logger.debug('Fetching client exercise history', {
    coachId: coach.user_id,
    userId,
    exerciseId,
    limit,
  });

  // Verify exercise exists
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, name: true },
  });

  if (!exercise) {
    throw new NotFoundException(
      'WORKOUT_EXERCISE_NOT_FOUND',
      'Exercise not found'
    );
  }

  // Find all performed sets for this exercise by this user, grouped by session
  const sets = await prisma.performed_set.findMany({
    where: {
      assigned_program_routine_exercise: { exercise_id: exerciseId },
      workout_session: {
        assigned_program_routine: {
          assigned_program: { user_id: userId },
        },
      },
    },
    include: {
      workout_session: {
        select: { id: true, started_at: true, completed_at: true },
      },
    },
    orderBy: [
      { workout_session: { started_at: 'desc' } },
      { set_number: 'asc' },
    ],
  });

  // Group by session
  type SessionEntry = {
    sessionId: string;
    date: Date | null;
    sets: Array<{
      set_number: number;
      reps: number;
      weight: number | null;
      overall_score: number | null;
    }>;
  };

  const sessionMap = new Map<string, SessionEntry>();

  for (const s of sets) {
    const sid = s.workout_session.id;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, {
        sessionId: sid,
        date: s.workout_session.started_at,
        sets: [],
      });
    }
    sessionMap.get(sid)!.sets.push({
      set_number: s.set_number,
      reps: s.reps,
      weight: s.weight,
      overall_score: s.overall_score,
    });
  }

  // Limit to most recent N sessions
  const entries = Array.from(sessionMap.values()).slice(0, limit);

  sendSuccess(res, {
    exercise: {
      id: exercise.id,
      name: exercise.name,
    },
    history: entries.map((entry) => {
      const bestSet = entry.sets.reduce(
        (best, s) => {
          const vol = s.reps * (s.weight ?? 0);
          return vol > best.volume ? { volume: vol, set: s } : best;
        },
        { volume: 0, set: entry.sets[0] }
      );

      return {
        sessionId: entry.sessionId,
        date: entry.date,
        sets: entry.sets,
        summary: {
          totalSets: entry.sets.length,
          totalReps: entry.sets.reduce((s, ps) => s + ps.reps, 0),
          maxWeight: Math.max(...entry.sets.map((s) => s.weight ?? 0)),
          totalVolume: entry.sets.reduce(
            (s, ps) => s + ps.reps * (ps.weight ?? 0),
            0
          ),
          bestSet: bestSet.set,
        },
      };
    }),
    total: sessionMap.size,
  });
};

// ============== Enhanced Performance Report (GAP 2) ==============

/**
 * GET /coach/performance/detailed
 * Enhanced performance report with volume, adherence, and trend data.
 * NOTE(B11): workout_session last-session lookup simplified — see getPerformance.
 */
export const getDetailedPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  const coach = req.coach;
  if (!coach) {
    throw new ForbiddenException('AUTH_COACH_REQUIRED', 'Coach required');
  }

  const { limit, offset } = res.locals.validated?.query as GetPerformanceQuery;

  logger.debug('Fetching detailed performance report', {
    coachId: coach.user_id,
    limit,
    offset,
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Fetch all active clients with their assigned programs
  const classRelations = await prisma.subscribed_coach.findMany({
    where: { coach_id: coach.user_id, ended_at: null },
    include: {
      user: {
        select: {
          supabase_auth_id: true,
          email: true,
          full_name: true,
          nickname: true,
          client_programs: {
            where: { deleted_at: null },
            include: {
              assigned_program_routines: {
                include: {
                  workout_sessions: {
                    where: {
                      completed_at: { not: null },
                      started_at: { gte: fourteenDaysAgo },
                    },
                    include: {
                      performed_sets: {
                        select: { reps: true, weight: true },
                      },
                    },
                    orderBy: { started_at: 'desc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const performanceData = classRelations
    .filter((cr) => cr.user.client_programs.length > 0)
    .map((cr) => {
      const user = cr.user;

      // Collect all sessions across all assigned program routines
      const allSessions = user.client_programs.flatMap((ap) =>
        ap.assigned_program_routines.flatMap((apr) => apr.workout_sessions)
      );

      const lastSession = allSessions.sort(
        (a, b) =>
          new Date(b.started_at ?? 0).getTime() -
          new Date(a.started_at ?? 0).getTime()
      )[0];
      const lastCompletedAt = lastSession?.completed_at
        ? new Date(lastSession.completed_at)
        : null;

      // Status determination
      let status: 'good' | 'falling_behind' = 'good';
      if (!lastCompletedAt) {
        status = 'falling_behind';
      } else if (lastCompletedAt < fourteenDaysAgo) {
        status = 'falling_behind';
      } else if (lastCompletedAt >= sevenDaysAgo) {
        status = 'good';
      }

      // Sessions in last 7 days
      const sessionsThisWeek = allSessions.filter(
        (s) => s.started_at && new Date(s.started_at) >= sevenDaysAgo
      );

      const totalVolume = sessionsThisWeek.reduce(
        (vol, s) =>
          vol +
          s.performed_sets.reduce((v, ps) => v + ps.reps * (ps.weight ?? 0), 0),
        0
      );

      const totalSets = sessionsThisWeek.reduce(
        (sum, s) => sum + s.performed_sets.length,
        0
      );

      const totalReps = sessionsThisWeek.reduce(
        (sum, s) => sum + s.performed_sets.reduce((r, ps) => r + ps.reps, 0),
        0
      );

      const durations = sessionsThisWeek
        .filter((s) => s.completed_at && s.started_at)
        .map((s) =>
          Math.round(
            (new Date(s.completed_at!).getTime() -
              new Date(s.started_at!).getTime()) /
              60000
          )
        );
      const averageSessionDuration =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

      // Adherence: count how many distinct days-of-week are assigned
      const activeProgramDays =
        user.client_programs[0]?.assigned_program_routines?.reduce(
          (days, apr) => days + (apr.days_of_week?.length ?? 0),
          0
        ) ?? 0;
      const expectedSessions = activeProgramDays;
      const adherenceRate =
        expectedSessions > 0
          ? Math.min(
              Math.round((sessionsThisWeek.length / expectedSessions) * 100),
              100
            )
          : null;

      return {
        id: user.supabase_auth_id,
        email: user.email,
        name: user.full_name,
        nickname: user.nickname,
        status,
        lastCompletedAt: lastCompletedAt?.toISOString() ?? null,
        sessionsThisWeek: sessionsThisWeek.length,
        totalSets,
        totalReps,
        totalVolume: Math.round(totalVolume * 100) / 100,
        averageSessionDuration,
        adherenceRate,
        activeProgramName: user.client_programs[0]?.name ?? null,
      };
    });

  const good = performanceData.filter((p) => p.status === 'good');
  const fallingBehind = performanceData.filter(
    (p) => p.status === 'falling_behind'
  );

  const paginatedData = performanceData.slice(offset, offset + limit);

  sendSuccess(res, {
    performance: paginatedData,
    summary: {
      total: performanceData.length,
      good: good.length,
      fallingBehind: fallingBehind.length,
      averageAdherence:
        performanceData.length > 0
          ? Math.round(
              performanceData
                .filter((p) => p.adherenceRate !== null)
                .reduce((s, p) => s + (p.adherenceRate ?? 0), 0) /
                performanceData.filter((p) => p.adherenceRate !== null).length
            )
          : 0,
    },
    pagination: {
      total: performanceData.length,
      limit,
      offset,
      hasMore: offset + paginatedData.length < performanceData.length,
    },
  });
};
