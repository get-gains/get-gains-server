import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { NotFoundException, UnauthorizedException } from '../lib/errors';
import {
  SessionHistoryQuery,
  UnifiedSessionSummary,
  SessionCalendarQuery,
  CalendarSessionSummary,
  SessionDetailParams,
  UnifiedExerciseGroup,
  UnifiedSessionDetail,
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

// ============== Unified Session Calendar ==============

/**
 * Get all completed sessions for a calendar month (both sources).
 *
 * Returns a flat list of sessions for the given month so the client can
 * group them by local day. Both coach-assigned (`workout_session`) and
 * standalone (`standalone_session`) sessions are included.
 *
 * The month is interpreted in UTC — the client is responsible for converting
 * startedAt timestamps to local time when grouping by day.
 *
 * @route GET /api/sessions/calendar?month=YYYY-MM
 */
export const getSessionCalendar = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : rawUser.id
    : undefined;

  const { month } = (res.locals.validated?.query as SessionCalendarQuery) || {
    month: '',
  };

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  if (!month) {
    res.status(400).json({ error: 'month query param is required (YYYY-MM)' });
    return;
  }

  // Build UTC date range for the given month.
  // e.g. month="2026-06" → start=2026-06-01T00:00:00Z, end=2026-07-01T00:00:00Z
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const rangeStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, monthNum, 1)); // exclusive

  logger.debug('Fetching calendar sessions', {
    supabaseId,
    month,
    rangeStart,
    rangeEnd,
  });

  // ── Coach-assigned sessions ──
  const coachSessions = await prisma.workout_session.findMany({
    where: {
      assigned_program_routine: {
        assigned_program: { user_id: supabaseId },
      },
      completed_at: { not: null },
      deleted_at: null,
      started_at: {
        gte: rangeStart,
        lt: rangeEnd,
      },
    },
    include: {
      assigned_program_routine: {
        select: {
          name: true,
          assigned_program: {
            select: { coach_id: true },
          },
        },
      },
    },
    orderBy: { started_at: 'asc' },
  });

  // ── Standalone sessions ──
  const standaloneSessions = await prisma.standalone_session.findMany({
    where: {
      user_id: supabaseId,
      completed_at: { not: null },
      deleted_at: null,
      started_at: {
        gte: rangeStart,
        lt: rangeEnd,
      },
    },
    include: {
      program_routine: {
        select: {
          routine: { select: { name: true } },
        },
      },
    },
    orderBy: { started_at: 'asc' },
  });

  // ── Collect session IDs to bulk-fetch set counts ──
  const coachIds = coachSessions.map((s) => s.id);
  const standaloneIds = standaloneSessions.map((s) => s.id);

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

  // ── Map to unified calendar shape ──
  const sessions: CalendarSessionSummary[] = [];

  for (const s of coachSessions) {
    const isCoach =
      s.assigned_program_routine.assigned_program.coach_id !== supabaseId;
    sessions.push({
      id: s.id,
      routineName: s.assigned_program_routine.name,
      startedAt: s.started_at?.toISOString() ?? new Date().toISOString(),
      completedAt: s.completed_at?.toISOString() ?? null,
      totalSets: setCountMap.get(s.id) ?? 0,
      source: isCoach ? 'coach' : 'standalone',
    });
  }

  for (const s of standaloneSessions) {
    sessions.push({
      id: s.id,
      routineName: s.program_routine.routine.name,
      startedAt: s.started_at.toISOString(),
      completedAt: s.completed_at?.toISOString() ?? null,
      totalSets: setCountMap.get(s.id) ?? 0,
      source: 'standalone',
    });
  }

  // Sort by startedAt ascending for predictable ordering
  sessions.sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  logger.debug('Calendar sessions fetched', {
    supabaseId,
    month,
    count: sessions.length,
  });

  sendSuccess(res, { sessions });
};

// ============== Unified Session Detail ==============

/**
 * Get full session detail by ID — works for both coach and standalone sessions.
 *
 * Lookup strategy:
 *   1. Try `workout_session` (coach-assigned) owned by the authenticated user.
 *   2. If not found, try `standalone_session`.
 *   3. Return 404 if neither match.
 *
 * The response is a unified `UnifiedSessionDetail` shape regardless of source,
 * so the client doesn't need to know which system stored the session.
 *
 * @route GET /api/sessions/:sessionId
 */
export const getSessionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : rawUser.id
    : undefined;

  const { sessionId } =
    (res.locals.validated?.params as SessionDetailParams) || {};

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  logger.debug('Fetching unified session detail', { supabaseId, sessionId });

  // ── 1. Try coach-assigned session ──
  const coachSession = await prisma.workout_session.findFirst({
    where: {
      id: sessionId,
      assigned_program_routine: {
        assigned_program: { user_id: supabaseId },
      },
      deleted_at: null,
    },
    include: {
      assigned_program_routine: {
        include: {
          assigned_program: { select: { name: true, coach_id: true } },
        },
      },
      performed_sets: {
        include: {
          assigned_program_routine_exercise: {
            include: {
              exercise: { select: { id: true, name: true } },
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

  if (coachSession) {
    const isCoach =
      coachSession.assigned_program_routine.assigned_program.coach_id !==
      supabaseId;

    const exerciseMap = new Map<string, UnifiedExerciseGroup>();
    for (const ps of coachSession.performed_sets) {
      const ex = ps.assigned_program_routine_exercise.exercise;
      if (!exerciseMap.has(ex.id)) {
        exerciseMap.set(ex.id, {
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [],
          totalVolumeKg: 0,
        });
      }
      const group = exerciseMap.get(ex.id)!;
      const vol = ps.reps * (ps.weight ?? 0);
      group.sets.push({
        id: ps.id,
        setNumber: ps.set_number,
        repsCompleted: ps.reps,
        weightKg: ps.weight,
        rpe: ps.overall_score,
      });
      group.totalVolumeKg += vol;
    }

    const exercises = Array.from(exerciseMap.values());
    const totalSets = coachSession.performed_sets.length;
    const totalReps = coachSession.performed_sets.reduce(
      (s, ps) => s + ps.reps,
      0
    );
    const totalVolumeKg = coachSession.performed_sets.reduce(
      (s, ps) => s + ps.reps * (ps.weight ?? 0),
      0
    );
    const durationMinutes =
      coachSession.completed_at && coachSession.started_at
        ? Math.round(
            (coachSession.completed_at.getTime() -
              coachSession.started_at.getTime()) /
              60000
          )
        : null;

    const detail: UnifiedSessionDetail = {
      id: coachSession.id,
      source: isCoach ? 'coach' : 'standalone',
      routineName: coachSession.assigned_program_routine.name,
      programName:
        coachSession.assigned_program_routine.assigned_program.name ?? null,
      startedAt:
        coachSession.started_at?.toISOString() ?? new Date().toISOString(),
      completedAt: coachSession.completed_at?.toISOString() ?? null,
      durationMinutes,
      notes: coachSession.feedback ?? null,
      exercises,
      totalSets,
      totalReps,
      totalVolumeKg,
    };

    logger.debug('Returning coach session detail', {
      sessionId,
      source: detail.source,
    });
    sendSuccess(res, { session: detail });
    return;
  }

  // ── 2. Try standalone session ──
  const standaloneSession = await prisma.standalone_session.findFirst({
    where: {
      id: sessionId,
      user_id: supabaseId,
      deleted_at: null,
    },
    include: {
      program_routine: {
        include: {
          routine: { select: { name: true } },
          program: { select: { name: true } },
          exercises: {
            where: { deleted_at: null },
            include: { exercise: { select: { id: true, name: true } } },
            orderBy: { order_in_routine: 'asc' },
          },
        },
      },
      performed_sets: {
        include: {
          exercise: {
            include: {
              exercise: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ routine_exercise_id: 'asc' }, { set_number: 'asc' }],
      },
    },
  });

  if (!standaloneSession) {
    throw new NotFoundException('SESSION_NOT_FOUND', 'Session not found');
  }

  const exerciseMap = new Map<string, UnifiedExerciseGroup>();
  for (const ps of standaloneSession.performed_sets) {
    const ex = ps.exercise.exercise;
    const exId = ex.id;
    if (!exerciseMap.has(exId)) {
      exerciseMap.set(exId, {
        exerciseId: exId,
        exerciseName: ex.name,
        sets: [],
        totalVolumeKg: 0,
      });
    }
    const group = exerciseMap.get(exId)!;
    const vol = ps.reps * (ps.weight ?? 0);
    group.sets.push({
      id: ps.id,
      setNumber: ps.set_number,
      repsCompleted: ps.reps,
      weightKg: ps.weight,
      rpe: null,
    });
    group.totalVolumeKg += vol;
  }

  const exercises = Array.from(exerciseMap.values());
  const totalSets = standaloneSession.performed_sets.length;
  const totalReps = standaloneSession.performed_sets.reduce(
    (s, ps) => s + ps.reps,
    0
  );
  const totalVolumeKg = standaloneSession.performed_sets.reduce(
    (s, ps) => s + ps.reps * (ps.weight ?? 0),
    0
  );
  const durationMinutes =
    standaloneSession.completed_at && standaloneSession.started_at
      ? Math.round(
          (standaloneSession.completed_at.getTime() -
            standaloneSession.started_at.getTime()) /
            60000
        )
      : null;

  const detail: UnifiedSessionDetail = {
    id: standaloneSession.id,
    source: 'standalone',
    routineName: standaloneSession.program_routine.routine.name,
    programName: standaloneSession.program_routine.program.name ?? null,
    startedAt: standaloneSession.started_at.toISOString(),
    completedAt: standaloneSession.completed_at?.toISOString() ?? null,
    durationMinutes,
    notes: standaloneSession.feedback ?? null,
    exercises,
    totalSets,
    totalReps,
    totalVolumeKg,
  };

  logger.debug('Returning standalone session detail', { sessionId });
  sendSuccess(res, { session: detail });
};
