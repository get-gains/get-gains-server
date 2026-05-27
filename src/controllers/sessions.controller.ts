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
 * Merges sessions from both the coach-assigned system (`workout_session`)
 * and the standalone system (`standalone_session`). Returns paginated
 * results with derived `source` field ("standalone" or "coach"),
 * along with `programName` and `coachName` for coach sessions.
 *
 * Source distinction for coach-assigned sessions:
 *   standalone: assigned_program.coach_id == supabaseId (user's own program)
 *   coach:      assigned_program.coach_id != supabaseId (coach's program)
 *
 * Standalone sessions (`standalone_session`) are always source "standalone".
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

  // Coach sessions are always relevant — only the where filter varies by source
  const includeStandalone = source === 'all' || source === 'standalone';

  // ── Coach-assigned sessions ──

  type CoachWhereCondition = {
    assigned_program_routine: {
      assigned_program: {
        user_id: string;
        coach_id?: string | { not: string };
      };
    };
    completed_at: { not: null };
    deleted_at: null;
  };

  let coachWhere: CoachWhereCondition;

  if (source === 'coach') {
    coachWhere = {
      assigned_program_routine: {
        assigned_program: {
          user_id: supabaseId,
          coach_id: { not: supabaseId },
        },
      },
      completed_at: { not: null },
      deleted_at: null,
    };
  } else if (source === 'standalone') {
    coachWhere = {
      assigned_program_routine: {
        assigned_program: {
          user_id: supabaseId,
          coach_id: supabaseId,
        },
      },
      completed_at: { not: null },
      deleted_at: null,
    };
  } else {
    coachWhere = {
      assigned_program_routine: {
        assigned_program: { user_id: supabaseId },
      },
      completed_at: { not: null },
      deleted_at: null,
    };
  }

  const coachInclude = {
    assigned_program_routine: {
      select: {
        id: true,
        source_routine_id: true,
        name: true,
        assigned_program: {
          select: {
            name: true,
            coach_id: true,
            coach: {
              select: { full_name: true },
            },
          },
        },
      },
    },
  } as const;

  // ── Standalone sessions ──

  type StandaloneWhereCondition = {
    user_id: string;
    completed_at: { not: null };
    deleted_at: null;
  };

  const standaloneWhere: StandaloneWhereCondition | null = includeStandalone
    ? {
        user_id: supabaseId,
        completed_at: { not: null },
        deleted_at: null,
      }
    : null;

  const standaloneInclude = {
    program_routine: {
      select: {
        id: true,
        routine: { select: { name: true } },
        program: { select: { name: true } },
      },
    },
  } as const;

  // ── Helper queries with clean type inference ──

  async function loadCoachSessions() {
    return prisma.workout_session.findMany({
      where: coachWhere,
      include: coachInclude,
      orderBy: { started_at: 'desc' },
    });
  }

  async function loadStandaloneSessions() {
    return standaloneWhere
      ? prisma.standalone_session.findMany({
          where: standaloneWhere,
          include: standaloneInclude,
          orderBy: { started_at: 'desc' },
        })
      : [];
  }

  const [coachSessions, standaloneSessions] = await Promise.all([
    loadCoachSessions(),
    loadStandaloneSessions(),
  ]);

  // ── Map to unified shape ──

  const unifiedSessions: UnifiedSessionSummary[] = [];

  for (const s of coachSessions) {
    const isCoach =
      s.assigned_program_routine.assigned_program.coach_id !== supabaseId;

    unifiedSessions.push({
      id: s.id,
      userId: supabaseId,
      routineId:
        s.assigned_program_routine.source_routine_id ??
        s.assigned_program_routine.id,
      routineName: s.assigned_program_routine.name,
      startedAt: s.started_at?.toISOString() ?? null,
      completedAt: s.completed_at?.toISOString() ?? null,
      notes: s.feedback ?? null,
      totalSets: 0,
      source: isCoach ? 'coach' : 'standalone',
      programName: s.assigned_program_routine.assigned_program.name ?? null,
      coachName: isCoach
        ? (s.assigned_program_routine.assigned_program.coach.full_name ?? null)
        : null,
    });
  }

  for (const s of standaloneSessions) {
    unifiedSessions.push({
      id: s.id,
      userId: supabaseId,
      routineId: s.program_routine.id,
      routineName: s.program_routine.routine.name,
      startedAt: s.started_at.toISOString(),
      completedAt: s.completed_at?.toISOString() ?? null,
      notes: s.feedback ?? null,
      totalSets: 0,
      source: 'standalone',
      programName: s.program_routine.program.name ?? null,
      coachName: null,
    });
  }

  // ── Sort by startedAt descending ──

  unifiedSessions.sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });

  const total = unifiedSessions.length;

  // ── Paginate in memory ──

  const paginatedSessions = unifiedSessions.slice(offset, offset + limit);

  // ── Bulk-fetch set counts ──

  const coachIds = paginatedSessions
    .filter((s) => coachSessions.some((cs) => cs.id === s.id))
    .map((s) => s.id);

  const standaloneIds = paginatedSessions
    .filter((s) => standaloneSessions.some((ss) => ss.id === s.id))
    .map((s) => s.id);

  const [coachSetCounts, standaloneSetCounts] = await Promise.all([
    coachIds.length > 0
      ? prisma.performed_set.groupBy({
          by: ['workout_session_id'],
          where: { workout_session_id: { in: coachIds } },
          _count: { id: true },
        })
      : ([] as { workout_session_id: string; _count: { id: number } }[]),

    standaloneIds.length > 0
      ? prisma.standalone_performed_set.groupBy({
          by: ['session_id'],
          where: { session_id: { in: standaloneIds } },
          _count: { id: true },
        })
      : ([] as { session_id: string; _count: { id: number } }[]),
  ]);

  const setCountMap = new Map<string, number>();
  for (const sc of coachSetCounts) {
    setCountMap.set(sc.workout_session_id, sc._count.id);
  }
  for (const sc of standaloneSetCounts) {
    setCountMap.set(sc.session_id, sc._count.id);
  }

  for (const session of paginatedSessions) {
    session.totalSets = setCountMap.get(session.id) ?? 0;
  }

  sendSuccess(res, {
    sessions: paginatedSessions,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + paginatedSessions.length < total,
    },
  });
};
