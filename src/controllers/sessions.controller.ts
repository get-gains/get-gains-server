import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { UnauthorizedException } from '../lib/errors';
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
 * Session ownership flows through the relational path:
 *   workout_session → assigned_program_routine → assigned_program → user_id
 *
 * Source distinction:
 *   standalone: assigned_program.program.user_id == supabaseId (user's own program)
 *   coach:      assigned_program.program.user_id != supabaseId (coach's program)
 *
 * All sessions are returned regardless of subscription status — coach
 * session history is never gated (user's own training data, FR-014).
 *
 * @route GET /api/sessions/history
 */
export const getSessionHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : rawUser.id
    : undefined;
  const { source, limit, offset } = (res.locals.validated
    ?.query as SessionHistoryQuery) || {
    source: 'all',
    limit: 20,
    offset: 0,
  };

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  logger.debug('Fetching unified session history', {
    supabaseId,
    source,
    limit,
    offset,
  });

  // Build source filter condition based on relational path
  type WhereCondition = {
    assigned_program_routine: {
      assigned_program: {
        user_id: string;
        program?: { user_id: string | { not: string } };
      };
    };
    completed_at: { not: null };
    deleted_at: null;
  };

  let where: WhereCondition;

  if (source === 'standalone') {
    where = {
      assigned_program_routine: {
        assigned_program: {
          user_id: supabaseId,
          program: { user_id: supabaseId },
        },
      },
      completed_at: { not: null },
      deleted_at: null,
    };
  } else if (source === 'coach') {
    where = {
      assigned_program_routine: {
        assigned_program: {
          user_id: supabaseId,
          program: { user_id: { not: supabaseId } },
        },
      },
      completed_at: { not: null },
      deleted_at: null,
    };
  } else {
    where = {
      assigned_program_routine: {
        assigned_program: { user_id: supabaseId },
      },
      completed_at: { not: null },
      deleted_at: null,
    };
  }

  // Fetch sessions and total count in parallel
  const [sessions, total] = await Promise.all([
    prisma.workout_session.findMany({
      where,
      include: {
        assigned_program_routine: {
          include: {
            routine: { select: { id: true, name: true } },
            assigned_program: {
              include: {
                program: {
                  include: {
                    user: { select: { full_name: true } },
                  },
                },
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

  // Map to unified response shape
  const mappedSessions: UnifiedSessionSummary[] = sessions.map((s) => {
    const isCoach =
      s.assigned_program_routine.assigned_program.program.user_id !==
      supabaseId;

    return {
      id: s.id,
      routineId: s.assigned_program_routine.routine_id,
      routineName: s.assigned_program_routine.routine.name,
      startedAt: s.started_at?.toISOString() ?? null,
      completedAt: s.completed_at?.toISOString() ?? null,
      feedback: s.feedback ?? null,
      totalSets: 0, // filled in below via bulk set count
      source: isCoach ? 'coach' : 'standalone',
      programName:
        s.assigned_program_routine.assigned_program.program.name ?? null,
      coachName: isCoach
        ? (s.assigned_program_routine.assigned_program.program.user.full_name ??
          null)
        : null,
    };
  });

  // Bulk-fetch set counts to avoid N+1 queries
  const sessionIds = sessions.map((s) => s.id);
  const setCounts = await prisma.performed_set.groupBy({
    by: ['workout_session_id'],
    where: { workout_session_id: { in: sessionIds } },
    _count: { id: true },
  });

  const setCountMap = new Map(
    setCounts.map((sc) => [sc.workout_session_id, sc._count.id])
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
};
