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

    const body = (req.body as CreateCoachProfileInput) ?? {};
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

    const { filter, limit, offset } = req.query as unknown as GetClientsQuery;

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

    const { limit, offset } = req.query as unknown as GetPerformanceQuery;

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

    const { userId, programId, startDate, endDate, notes } =
      req.body as AssignProgramInput;

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
