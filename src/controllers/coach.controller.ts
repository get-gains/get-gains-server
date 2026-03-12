import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  CreateCoachProfileInput,
  GetClientsQuery,
  GetPerformanceQuery,
  AssignProgramInput,
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
  GetClientFormResultsParams,
  GetClientFormResultsQuery,
} from '../schemas/coach.schema';
import { getUserBySupabaseId } from './user.controller';
import { SubscriptionStatus } from '@prisma/client';

const DAYS_FOR_GOOD_PERFORMANCE = 7;
const DAYS_FOR_FALLING_BEHIND = 14;

/**
 * Create coach profile (become a coach). Any authenticated user can call.
 * Returns 409 if user already has a coach profile.
 */
export const createCoachProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseUser = req.user;
    if (!supabaseUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const supabaseId =
      'supabaseId' in supabaseUser ? supabaseUser.supabaseId : supabaseUser.id;
    const appUser = await getUserBySupabaseId(supabaseId);

    if (!appUser) {
      sendSingleError(res, 'User not found', 401);
      return;
    }

    const existingCoach = await prisma.coach.findUnique({
      where: { userId: appUser.id },
    });

    if (existingCoach) {
      sendSingleError(res, 'User is already a coach', 409);
      return;
    }

    const body = (res.locals.validated?.body as CreateCoachProfileInput) ?? {};
    const name = body.name ?? appUser.name;
    const email = body.email ?? appUser.email;

    const coach = await prisma.coach.create({
      data: {
        userId: appUser.id,
        name,
        email,
        avatarUrl: body.avatarUrl ?? null,
        bio: body.bio ?? null,
        yearsExperience: body.yearsExperience ?? 0,
        certifications: body.certifications ?? [],
        certificationImageUrls: body.certificationImageUrls ?? [],
        awards: body.awards ?? [],
        specialties: body.specialties ?? [],
        socialLinks: body.socialLinks ?? [],
        settings: {
          create: {},
        },
      },
    });

    logger.info('Coach profile created', {
      userId: appUser.id,
      coachId: coach.id,
    });

    sendSuccess(
      res,
      {
        coach: {
          id: coach.id,
          name: coach.name,
          email: coach.email,
          avatarUrl: coach.avatarUrl,
          bio: coach.bio,
          yearsExperience: coach.yearsExperience,
        },
        isCoach: true,
      },
      201
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Error creating coach profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to create coach profile', 500);
  }
};

/**
 * Get coach's clients with optional filter (assigned / unassigned)
 */
export const getClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { filter, limit, offset } = res.locals.validated
      ?.query as GetClientsQuery;

    logger.debug('Fetching coach clients', {
      coachId: coach.id,
      filter,
      limit,
      offset,
    });

    const classRelations = await prisma.subscribedCoach.findMany({
      where: {
        coachId: coach.id,
        endedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
            assignedPrograms: {
              where: { isActive: true },
              select: { programId: true, program: { select: { name: true } } },
            },
            subscriptions: {
              where: {
                status: {
                  in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
                },
              },
              select: { currentPeriodEnd: true },
              orderBy: { currentPeriodEnd: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    let clients = classRelations.map((cr) => ({
      id: cr.user.id,
      email: cr.user.email,
      name: cr.user.name,
      nickname: cr.user.nickname,
      subscribedAt: cr.startedAt,
      subscriptionExpiresAt: cr.user.subscriptions[0]?.currentPeriodEnd ?? null,
      assignedPrograms: cr.user.assignedPrograms,
      isAssigned: cr.user.assignedPrograms.length > 0,
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
  } catch (error) {
    logger.error('Error fetching coach clients', error);
    sendSingleError(res, 'Failed to fetch clients', 500);
  }
};

/**
 * Get performance report (good performance / falling behind)
 */
export const getPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { limit, offset } = res.locals.validated
      ?.query as GetPerformanceQuery;

    logger.debug('Fetching performance report', {
      coachId: coach.id,
      limit,
      offset,
    });

    const now = new Date();
    const goodThreshold = new Date(now);
    goodThreshold.setDate(goodThreshold.getDate() - DAYS_FOR_GOOD_PERFORMANCE);
    const fallingBehindThreshold = new Date(now);
    fallingBehindThreshold.setDate(
      fallingBehindThreshold.getDate() - DAYS_FOR_FALLING_BEHIND
    );

    const classRelations = await prisma.subscribedCoach.findMany({
      where: {
        coachId: coach.id,
        endedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
            assignedPrograms: {
              where: { isActive: true },
              select: { id: true },
            },
            workoutSessions: {
              where: { completedAt: { not: null } },
              select: { completedAt: true },
              orderBy: { completedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const performanceData = classRelations
      .filter((cr) => cr.user.assignedPrograms.length > 0)
      .map((cr) => {
        const lastSession = cr.user.workoutSessions[0];
        const lastCompletedAt = lastSession?.completedAt
          ? new Date(lastSession.completedAt)
          : null;

        let status: 'good' | 'falling_behind' = 'good';
        if (!lastCompletedAt) {
          status = 'falling_behind';
        } else if (lastCompletedAt < fallingBehindThreshold) {
          status = 'falling_behind';
        } else if (lastCompletedAt >= goodThreshold) {
          status = 'good';
        }

        return {
          id: cr.user.id,
          email: cr.user.email,
          name: cr.user.name,
          nickname: cr.user.nickname,
          status,
          lastCompletedAt: lastCompletedAt?.toISOString() ?? null,
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
  } catch (error) {
    logger.error('Error fetching performance report', error);
    sendSingleError(res, 'Failed to fetch performance', 500);
  }
};

/**
 * Assign program to client
 */
export const assignProgram = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId, programId, startDate, endDate, notes } = res.locals
      .validated?.body as AssignProgramInput;

    const programRecord = await prisma.program.findUnique({
      where: { id: programId },
    });

    if (!programRecord) {
      sendSingleError(res, 'Program not found', 404, 'programId');
      return;
    }

    if (programRecord.coachId !== coach.id) {
      sendSingleError(
        res,
        'Program does not belong to coach',
        403,
        'programId'
      );
      return;
    }

    const isInClass = await prisma.subscribedCoach.findUnique({
      where: {
        userId_coachId: { userId, coachId: coach.id },
      },
    });

    if (!isInClass || isInClass.endedAt) {
      sendSingleError(res, 'Client must be in class to assign program', 403);
      return;
    }

    const existingAssignment = await prisma.assignedProgram.findUnique({
      where: {
        userId_programId: { userId, programId },
      },
    });

    if (existingAssignment?.isActive) {
      sendSingleError(
        res,
        'Client already has this program assigned',
        409,
        'programId'
      );
      return;
    }

    const assignment = await prisma.assignedProgram.upsert({
      where: {
        userId_programId: { userId, programId },
      },
      create: {
        userId,
        programId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        notes: notes ?? null,
      },
      update: {
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        notes: notes ?? null,
        isActive: true,
      },
      include: {
        program: { select: { id: true, name: true, description: true } },
        user: {
          select: { id: true, email: true, name: true, nickname: true },
        },
      },
    });

    sendSuccess(
      res,
      {
        assignment: {
          id: assignment.id,
          userId: assignment.userId,
          programId: assignment.programId,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          notes: assignment.notes,
          program: assignment.program,
          user: assignment.user,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Error assigning program', error);
    sendSingleError(res, 'Failed to assign program', 500);
  }
};

// ============== Assignment Management Controllers ==============

/**
 * Get all program assignments for a specific client (coach's clients only).
 */
export const getClientPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId } = req.params as GetClientProgramsParams;

    // Verify the client is currently in this coach's class
    const isInClass = await prisma.subscribedCoach.findUnique({
      where: { userId_coachId: { userId, coachId: coach.id } },
    });

    if (!isInClass || isInClass.endedAt) {
      sendSingleError(res, 'Client not found in class', 404);
      return;
    }

    // Return only assignments where the program belongs to this coach
    const assignments = await prisma.assignedProgram.findMany({
      where: {
        userId,
        program: { coachId: coach.id },
      },
      include: {
        program: {
          include: {
            _count: { select: { programRoutines: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, {
      assignments: assignments.map((a) => ({
        id: a.id,
        userId: a.userId,
        programId: a.programId,
        startDate: a.startDate,
        endDate: a.endDate,
        isActive: a.isActive,
        notes: a.notes,
        program: {
          id: a.program.id,
          name: a.program.name,
          description: a.program.description,
          routineCount: a.program._count.programRoutines,
        },
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching client programs', error);
    sendSingleError(res, 'Failed to fetch client programs', 500);
  }
};

/**
 * Update an existing program assignment's dates, notes, or active status.
 */
export const updateAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { assignmentId } = req.params as UpdateAssignmentParams;
    const { startDate, endDate, notes, isActive } =
      req.body as UpdateAssignmentInput;

    if (
      startDate === undefined &&
      endDate === undefined &&
      notes === undefined &&
      isActive === undefined
    ) {
      sendSingleError(res, 'At least one field must be provided', 400);
      return;
    }

    // Verify assignment exists and belongs to a program owned by this coach
    const assignment = await prisma.assignedProgram.findUnique({
      where: { id: assignmentId },
      include: { program: { select: { coachId: true } } },
    });

    if (!assignment || assignment.program.coachId !== coach.id) {
      sendSingleError(res, 'Assignment not found or access denied', 404);
      return;
    }

    const updated = await prisma.assignedProgram.update({
      where: { id: assignmentId },
      data: {
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        program: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true, nickname: true } },
      },
    });

    logger.info('Assignment updated', { assignmentId, coachId: coach.id });
    sendSuccess(res, {
      assignment: {
        id: updated.id,
        userId: updated.userId,
        programId: updated.programId,
        startDate: updated.startDate,
        endDate: updated.endDate,
        isActive: updated.isActive,
        notes: updated.notes,
        program: updated.program,
        user: updated.user,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating assignment', error);
    sendSingleError(res, 'Failed to update assignment', 500);
  }
};

/**
 * Delete a program assignment.
 * WorkoutSessions linked to this assignment will have assignedProgramId set to null (SetNull cascade).
 */
export const deleteAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { assignmentId } = req.params as DeleteAssignmentParams;

    const assignment = await prisma.assignedProgram.findUnique({
      where: { id: assignmentId },
      include: { program: { select: { coachId: true } } },
    });

    if (!assignment || assignment.program.coachId !== coach.id) {
      sendSingleError(res, 'Assignment not found or access denied', 404);
      return;
    }

    await prisma.assignedProgram.delete({ where: { id: assignmentId } });

    logger.info('Assignment deleted', { assignmentId, coachId: coach.id });
    sendSuccess(res, { message: 'Assignment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting assignment', error);
    sendSingleError(res, 'Failed to delete assignment', 500);
  }
};

// ============== Client Progress Controllers (GAP 1) ==============

/**
 * Helper: verify that the given userId is an active client of this coach.
 * Returns true if valid, sends error response and returns false otherwise.
 */
async function verifyCoachClientRelationship(
  coachId: string,
  userId: string,
  res: Response
): Promise<boolean> {
  const relation = await prisma.subscribedCoach.findUnique({
    where: { userId_coachId: { userId, coachId } },
  });
  if (!relation || relation.endedAt) {
    sendSingleError(res, 'Client not found in class', 404);
    return false;
  }
  return true;
}

/**
 * GET /coach/clients/:userId/sessions
 * List a client's workout sessions (paginated) with set/exercise counts.
 */
export const getClientSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId } = res.locals.validated?.params as GetClientSessionsParams;
    const { limit, offset, status, startDate, endDate } = res.locals.validated
      ?.query as GetClientSessionsQuery;

    if (!(await verifyCoachClientRelationship(coach.id, userId, res))) return;

    logger.debug('Fetching client sessions', {
      coachId: coach.id,
      userId,
      limit,
      offset,
      status,
    });

    const where: Record<string, unknown> = { userId };

    if (status === 'completed') {
      where.completedAt = { not: null };
    } else if (status === 'active') {
      where.completedAt = null;
    }

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
          assignedProgram: {
            include: {
              program: { select: { id: true, name: true } },
            },
          },
          performedSets: {
            select: {
              id: true,
              routineExercise: {
                select: {
                  exerciseId: true,
                  exercise: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.workoutSession.count({ where }),
    ]);

    sendSuccess(res, {
      sessions: sessions.map((s) => {
        const durationMinutes = s.completedAt
          ? Math.round(
              (new Date(s.completedAt).getTime() -
                new Date(s.startedAt).getTime()) /
                60000
            )
          : null;

        const uniqueExercises = new Set(
          s.performedSets.map((ps) => ps.routineExercise.exerciseId)
        );

        return {
          id: s.id,
          assignedProgramId: s.assignedProgramId,
          programName: s.assignedProgram?.program?.name ?? null,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          durationMinutes,
          totalSets: s.performedSets.length,
          uniqueExercises: uniqueExercises.size,
          notes: s.notes,
        };
      }),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching client sessions', error);
    sendSingleError(res, 'Failed to fetch client sessions', 500);
  }
};

/**
 * GET /coach/clients/:userId/sessions/:sessionId
 * Session detail with all performed sets grouped by exercise.
 */
export const getClientSessionDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId, sessionId } = res.locals.validated
      ?.params as GetClientSessionDetailParams;

    if (!(await verifyCoachClientRelationship(coach.id, userId, res))) return;

    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        assignedProgram: {
          include: {
            program: { select: { id: true, name: true } },
          },
        },
        performedSets: {
          include: {
            routineExercise: {
              include: {
                exercise: {
                  select: { id: true, name: true, primaryMuscleGroup: true },
                },
              },
            },
          },
          orderBy: [{ routineExerciseId: 'asc' }, { setNumber: 'asc' }],
        },
      },
    });

    if (!session) {
      sendSingleError(res, 'Session not found', 404);
      return;
    }

    const durationMinutes = session.completedAt
      ? Math.round(
          (new Date(session.completedAt).getTime() -
            new Date(session.startedAt).getTime()) /
            60000
        )
      : null;

    // Group performed sets by exercise
    const exerciseMap = new Map<
      string,
      {
        exerciseId: string;
        exerciseName: string;
        primaryMuscleGroup: string;
        sets: Array<{
          id: string;
          setNumber: number;
          repsCompleted: number;
          weightKg: number | null;
          rpe: number | null;
          notes: string | null;
          createdAt: Date;
        }>;
      }
    >();

    for (const ps of session.performedSets) {
      const exId = ps.routineExercise.exercise.id;
      if (!exerciseMap.has(exId)) {
        exerciseMap.set(exId, {
          exerciseId: exId,
          exerciseName: ps.routineExercise.exercise.name,
          primaryMuscleGroup: ps.routineExercise.exercise.primaryMuscleGroup,
          sets: [],
        });
      }
      exerciseMap.get(exId)!.sets.push({
        id: ps.id,
        setNumber: ps.setNumber,
        repsCompleted: ps.repsCompleted,
        weightKg: ps.weightKg,
        rpe: ps.rpe,
        notes: ps.notes,
        createdAt: ps.createdAt,
      });
    }

    sendSuccess(res, {
      session: {
        id: session.id,
        userId: session.userId,
        assignedProgramId: session.assignedProgramId,
        programName: session.assignedProgram?.program?.name ?? null,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationMinutes,
        notes: session.notes,
        exercises: Array.from(exerciseMap.values()),
        totalSets: session.performedSets.length,
        totalReps: session.performedSets.reduce(
          (s, ps) => s + ps.repsCompleted,
          0
        ),
        totalVolume: session.performedSets.reduce(
          (s, ps) => s + ps.repsCompleted * (ps.weightKg ?? 0),
          0
        ),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching client session detail', error);
    sendSingleError(res, 'Failed to fetch session detail', 500);
  }
};

/**
 * GET /coach/clients/:userId/stats/weekly
 * Mirror of getWeeklyStats but for a specific client, with previous-week delta.
 */
export const getClientWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId } = res.locals.validated
      ?.params as GetClientWeeklyStatsParams;
    const { weekOf } = res.locals.validated?.query as GetClientWeeklyStatsQuery;

    if (!(await verifyCoachClientRelationship(coach.id, userId, res))) return;

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

    // Fetch current week sessions with sets
    const [currentSessions, prevSessions] = await Promise.all([
      prisma.workoutSession.findMany({
        where: {
          userId,
          completedAt: { not: null },
          startedAt: { gte: weekStart, lt: weekEnd },
        },
        include: {
          performedSets: {
            select: { repsCompleted: true, weightKg: true },
          },
        },
      }),
      prisma.workoutSession.findMany({
        where: {
          userId,
          completedAt: { not: null },
          startedAt: { gte: prevWeekStart, lt: prevWeekEnd },
        },
        include: {
          performedSets: {
            select: { repsCompleted: true, weightKg: true },
          },
        },
      }),
    ]);

    const computeStats = (sessions: typeof currentSessions) => {
      const sessionsCompleted = sessions.length;
      const totalSets = sessions.reduce(
        (sum, s) => sum + s.performedSets.length,
        0
      );
      const totalReps = sessions.reduce(
        (sum, s) =>
          sum + s.performedSets.reduce((r, ps) => r + ps.repsCompleted, 0),
        0
      );
      const totalVolume = sessions.reduce(
        (sum, s) =>
          sum +
          s.performedSets.reduce(
            (v, ps) => v + ps.repsCompleted * (ps.weightKg ?? 0),
            0
          ),
        0
      );
      const totalMinutes = sessions.reduce((sum, s) => {
        if (s.completedAt) {
          return (
            sum +
            Math.round(
              (new Date(s.completedAt).getTime() -
                new Date(s.startedAt).getTime()) /
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
            Math.round((current.totalVolume - previous.totalVolume) * 100) /
            100,
          totalMinutes: current.totalMinutes - previous.totalMinutes,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching client weekly stats', error);
    sendSingleError(res, 'Failed to fetch client weekly stats', 500);
  }
};

/**
 * GET /coach/clients/:userId/exercises/:exerciseId/history
 * Exercise-level progress over time for a client, grouped by session.
 */
export const getClientExerciseHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId, exerciseId } = res.locals.validated
      ?.params as GetClientExerciseHistoryParams;
    const { limit } = res.locals.validated
      ?.query as GetClientExerciseHistoryQuery;

    if (!(await verifyCoachClientRelationship(coach.id, userId, res))) return;

    logger.debug('Fetching client exercise history', {
      coachId: coach.id,
      userId,
      exerciseId,
      limit,
    });

    // Verify exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true, primaryMuscleGroup: true },
    });

    if (!exercise) {
      sendSingleError(res, 'Exercise not found', 404, 'exerciseId');
      return;
    }

    // Find all performed sets for this exercise by this user, grouped by session
    const sets = await prisma.performedSet.findMany({
      where: {
        routineExercise: { exerciseId },
        workoutSession: { userId },
      },
      include: {
        workoutSession: {
          select: { id: true, startedAt: true, completedAt: true },
        },
      },
      orderBy: [
        { workoutSession: { startedAt: 'desc' } },
        { setNumber: 'asc' },
      ],
    });

    // Group by session
    const sessionMap = new Map<
      string,
      {
        sessionId: string;
        date: Date;
        sets: Array<{
          setNumber: number;
          repsCompleted: number;
          weightKg: number | null;
          rpe: number | null;
        }>;
      }
    >();

    for (const s of sets) {
      const sid = s.workoutSession.id;
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          sessionId: sid,
          date: s.workoutSession.startedAt,
          sets: [],
        });
      }
      sessionMap.get(sid)!.sets.push({
        setNumber: s.setNumber,
        repsCompleted: s.repsCompleted,
        weightKg: s.weightKg,
        rpe: s.rpe,
      });
    }

    // Limit to most recent N sessions
    const entries = Array.from(sessionMap.values()).slice(0, limit);

    sendSuccess(res, {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        primaryMuscleGroup: exercise.primaryMuscleGroup,
      },
      history: entries.map((entry) => {
        const bestSet = entry.sets.reduce(
          (best, s) => {
            const vol = s.repsCompleted * (s.weightKg ?? 0);
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
            totalReps: entry.sets.reduce((s, ps) => s + ps.repsCompleted, 0),
            maxWeight: Math.max(...entry.sets.map((s) => s.weightKg ?? 0)),
            totalVolume: entry.sets.reduce(
              (s, ps) => s + ps.repsCompleted * (ps.weightKg ?? 0),
              0
            ),
            bestSet: bestSet.set,
          },
        };
      }),
      total: sessionMap.size,
    });
  } catch (error) {
    logger.error('Error fetching client exercise history', error);
    sendSingleError(res, 'Failed to fetch exercise history', 500);
  }
};

// ============== Enhanced Performance Report (GAP 2) ==============

/**
 * GET /coach/performance/detailed
 * Enhanced performance report with volume, adherence, and trend data.
 */
export const getDetailedPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { limit, offset } = res.locals.validated
      ?.query as GetPerformanceQuery;

    logger.debug('Fetching detailed performance report', {
      coachId: coach.id,
      limit,
      offset,
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Fetch all active clients with their recent sessions + sets
    const classRelations = await prisma.subscribedCoach.findMany({
      where: { coachId: coach.id, endedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
            assignedPrograms: {
              where: { isActive: true },
              include: {
                program: {
                  select: {
                    name: true,
                    _count: { select: { programRoutines: true } },
                  },
                },
              },
            },
            workoutSessions: {
              where: {
                completedAt: { not: null },
                startedAt: { gte: fourteenDaysAgo },
              },
              include: {
                performedSets: {
                  select: { repsCompleted: true, weightKg: true },
                },
              },
              orderBy: { startedAt: 'desc' },
            },
          },
        },
      },
    });

    const performanceData = classRelations
      .filter((cr) => cr.user.assignedPrograms.length > 0)
      .map((cr) => {
        const user = cr.user;
        const allSessions = user.workoutSessions;
        const lastSession = allSessions[0];
        const lastCompletedAt = lastSession?.completedAt
          ? new Date(lastSession.completedAt)
          : null;

        // Status determination (same as existing)
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
          (s) => new Date(s.startedAt) >= sevenDaysAgo
        );

        // Volume in last 7 days: sum of (reps × weightKg)
        const totalVolume = sessionsThisWeek.reduce(
          (vol, s) =>
            vol +
            s.performedSets.reduce(
              (v, ps) => v + ps.repsCompleted * (ps.weightKg ?? 0),
              0
            ),
          0
        );

        const totalSets = sessionsThisWeek.reduce(
          (sum, s) => sum + s.performedSets.length,
          0
        );

        const totalReps = sessionsThisWeek.reduce(
          (sum, s) =>
            sum + s.performedSets.reduce((r, ps) => r + ps.repsCompleted, 0),
          0
        );

        // Average session duration (minutes) across last 7 days
        const durations = sessionsThisWeek
          .filter((s) => s.completedAt)
          .map((s) =>
            Math.round(
              (new Date(s.completedAt!).getTime() -
                new Date(s.startedAt).getTime()) /
                60000
            )
          );
        const averageSessionDuration =
          durations.length > 0
            ? Math.round(
                durations.reduce((a, b) => a + b, 0) / durations.length
              )
            : 0;

        // Adherence rate: sessions completed / expected sessions
        // Expected sessions = number of routine day slots in the active assigned program
        const activeProgramDays =
          user.assignedPrograms[0]?.program?._count?.programRoutines ?? 0;
        const expectedSessions = activeProgramDays; // per week
        const adherenceRate =
          expectedSessions > 0
            ? Math.min(
                Math.round((sessionsThisWeek.length / expectedSessions) * 100),
                100
              )
            : null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          status,
          lastCompletedAt: lastCompletedAt?.toISOString() ?? null,
          sessionsThisWeek: sessionsThisWeek.length,
          totalSets,
          totalReps,
          totalVolume: Math.round(totalVolume * 100) / 100,
          averageSessionDuration,
          adherenceRate,
          activeProgramName: user.assignedPrograms[0]?.program?.name ?? null,
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
  } catch (error) {
    logger.error('Error fetching detailed performance', error);
    sendSingleError(res, 'Failed to fetch detailed performance', 500);
  }
};

// ============== Client Form Results (GAP 3) ==============

/**
 * GET /coach/clients/:userId/form-results
 * Get a client's form comparison result history.
 */
export const getClientFormResults = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const { userId } = res.locals.validated
      ?.params as GetClientFormResultsParams;
    const { exerciseId, limit, offset } = res.locals.validated
      ?.query as GetClientFormResultsQuery;

    if (!(await verifyCoachClientRelationship(coach.id, userId, res))) return;

    logger.debug('Fetching client form results', {
      coachId: coach.id,
      userId,
      exerciseId,
      limit,
      offset,
    });

    const where: Record<string, unknown> = { userId };

    if (exerciseId) {
      where.exerciseForm = { exerciseId };
    }

    const [results, total] = await Promise.all([
      prisma.formComparisonResult.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          exerciseForm: {
            select: {
              id: true,
              cameraAngle: true,
              exercise: { select: { id: true, name: true } },
              coach: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.formComparisonResult.count({ where }),
    ]);

    sendSuccess(res, {
      results: results.map((r) => ({
        id: r.id,
        overallScore: r.overallScore,
        segmentScores: r.segmentScores,
        corrections: r.corrections,
        cameraAngle: r.cameraAngle,
        durationMs: r.durationMs,
        totalFrames: r.totalFrames,
        createdAt: r.createdAt,
        exerciseForm: r.exerciseForm,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + results.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching client form results', error);
    sendSingleError(res, 'Failed to fetch client form results', 500);
  }
};
