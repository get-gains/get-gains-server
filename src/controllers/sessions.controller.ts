import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  SessionHistoryQuery,
  UnifiedSessionSummary,
} from '../schemas/sessions.schema';

// ============== Unified Session History ==============

/**
 * Get unified session history with source metadata.
 *
 * Returns paginated sessions with derived `source` field ("standalone" or
 * "coach"), along with `programName` and `coachName` for coach sessions.
 *
 * All sessions are returned regardless of subscription status — coach
 * session history is never gated (user's own training data, FR-014).
 *
 * Uses `attachSubscription` middleware (non-blocking) — endpoint never
 * returns 403 for subscription reasons.
 *
 * @route GET /api/sessions/history
 */
export const getSessionHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const supabaseId = req.user?.id;
    const { source, limit, offset } = (res.locals.validated
      ?.query as SessionHistoryQuery) || {
      source: 'all',
      limit: 20,
      offset: 0,
    };

    if (!supabaseId) {
      sendSingleError(res, 'Unauthorized', 401);
      return;
    }

    // Resolve app user
    const user = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.debug('Fetching unified session history', {
      userId: user.id,
      source,
      limit,
      offset,
    });

    // Build source filter condition
    const sourceFilter: Record<string, unknown> = {};
    if (source === 'standalone') {
      sourceFilter.assignedProgramId = null;
    } else if (source === 'coach') {
      sourceFilter.assignedProgramId = { not: null };
    }

    const where = {
      userId: user.id,
      completedAt: { not: null },
      ...sourceFilter,
    };

    // Fetch sessions with joins for programName, coachName, and routineName
    const [sessions, total] = await Promise.all([
      prisma.workoutSession.findMany({
        where,
        include: {
          assignedProgram: {
            include: {
              program: {
                include: {
                  coach: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          performedSets: {
            take: 1,
            orderBy: { setNumber: 'asc' },
            include: {
              routineExercise: {
                include: {
                  routine: {
                    select: { id: true, name: true },
                  },
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

    // Map to unified response shape
    const mappedSessions: UnifiedSessionSummary[] = sessions.map((s) => {
      const isCoach = s.assignedProgramId !== null;
      const routine = s.performedSets[0]?.routineExercise?.routine;

      return {
        id: s.id,
        userId: s.userId,
        assignedProgramId: s.assignedProgramId,
        routineId: routine?.id ?? null,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
        notes: s.notes,
        totalSets: s.performedSets.length
          ? // We fetched only 1 performed set for routine info;
            // count total sets via a separate approach
            0
          : 0,
        routineName: routine?.name ?? null,
        source: isCoach ? 'coach' : 'standalone',
        programName: isCoach
          ? (s.assignedProgram?.program?.name ?? null)
          : null,
        coachName: isCoach
          ? (s.assignedProgram?.program?.coach?.name ?? null)
          : null,
      };
    });

    // We need actual totalSets counts — fetch them in bulk
    const sessionIds = sessions.map((s) => s.id);
    const setCounts = await prisma.performedSet.groupBy({
      by: ['workoutSessionId'],
      where: { workoutSessionId: { in: sessionIds } },
      _count: { id: true },
    });

    const setCountMap = new Map(
      setCounts.map((sc) => [sc.workoutSessionId, sc._count.id])
    );

    for (const session of mappedSessions) {
      session.totalSets = setCountMap.get(session.id) ?? 0;
    }

    sendSuccess(res, {
      sessions: mappedSessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching unified session history', error);
    sendSingleError(res, 'Failed to fetch session history', 500);
  }
};
