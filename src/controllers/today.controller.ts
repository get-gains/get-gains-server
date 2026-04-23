import { Request, Response } from 'express';
import prisma from '../config/database';
import type { AuthenticatedUser } from '../middleware/auth.middleware';
import { resolveToday } from '../utils/days';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { UnauthorizedException } from '../lib/errors';

type TodayWorkoutDetails = {
  isRestDay: boolean;
  programRoutineId?: string;
  dayOfWeek?: string;
  dayNumber?: number;
  programName?: string;
  routineName?: string;
  exerciseCount: number;
  estimatedMinutes: number;
};

type AssignmentWithTodayTree = {
  program: {
    name: string;
  };
  assigned_program_routines: Array<{
    id: string;
    days_of_week: string[];
    routine: {
      name: string;
      estimated_duration_minutes: number;
    };
    assigned_program_routine_exercises: Array<{ id: string }>;
  }>;
};

const toTodayWorkoutDetails = (
  assignment: AssignmentWithTodayTree | null,
  dayName: string,
  dayNumber: number
): TodayWorkoutDetails | null => {
  if (!assignment) {
    return null;
  }

  const routineForToday = assignment.assigned_program_routines.find((apr) =>
    apr.days_of_week.includes(dayName)
  );

  if (!routineForToday) {
    return {
      isRestDay: true,
      dayOfWeek: dayName,
      dayNumber,
      programName: assignment.program.name,
      exerciseCount: 0,
      estimatedMinutes: 0,
    };
  }

  return {
    isRestDay: false,
    programRoutineId: routineForToday.id,
    dayOfWeek: dayName,
    dayNumber,
    programName: assignment.program.name,
    routineName: routineForToday.routine.name,
    exerciseCount: routineForToday.assigned_program_routine_exercises.length,
    estimatedMinutes: routineForToday.routine.estimated_duration_minutes,
  };
};

const assignmentInclude = {
  program: {
    select: {
      name: true,
    },
  },
  assigned_program_routines: {
    include: {
      routine: {
        select: {
          name: true,
          estimated_duration_minutes: true,
        },
      },
      assigned_program_routine_exercises: {
        select: {
          id: true,
        },
      },
    },
  },
} as const;

/**
 * Unified home endpoint used by Flutter Home providers.
 *
 * Contract target: GET /api/today
 *
 * Always responds 200 for authenticated users and never requires an
 * active subscription. It returns enough state for home CTA decisions:
 * subscription status, coach linkage, and coach/standalone today cards.
 */
export const getTodayStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawUser = req.user;
  const supabaseId = rawUser
    ? 'supabase_auth_id' in rawUser
      ? rawUser.supabase_auth_id
      : (rawUser as AuthenticatedUser).id
    : undefined;

  if (!supabaseId) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const { dayName, dayNumber } = resolveToday();
  const now = new Date();

  const isSubscribed = req.subscription?.isSubscribed ?? false;
  const tier = req.subscription?.tier ?? 'FREE';

  const [coachProfile, coachRelation] = await Promise.all([
    prisma.coach.findUnique({
      where: { user_id: supabaseId },
      select: { user_id: true },
    }),
    prisma.subscribed_coach.findFirst({
      where: {
        user_id: supabaseId,
        ended_at: null,
      },
      select: {
        coach_id: true,
      },
      orderBy: {
        started_at: 'desc',
      },
    }),
  ]);

  const isCoach = Boolean(coachProfile) || (req.appUser?.is_coach ?? false);

  const hasCoach = Boolean(coachRelation);

  const [coachAssignment, standaloneAssignment] = await Promise.all([
    isSubscribed && coachRelation
      ? prisma.assigned_program.findFirst({
          where: {
            user_id: supabaseId,
            program: {
              user_id: coachRelation.coach_id,
            },
            OR: [{ end_date: null }, { end_date: { gt: now } }],
          },
          include: assignmentInclude,
          orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
        })
      : Promise.resolve(null),
    prisma.assigned_program.findFirst({
      where: {
        user_id: supabaseId,
        program: {
          user_id: supabaseId,
        },
        OR: [{ end_date: null }, { end_date: { gt: now } }],
      },
      include: assignmentInclude,
      orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
    }),
  ]);

  const coachToday =
    isSubscribed && hasCoach
      ? toTodayWorkoutDetails(coachAssignment, dayName, dayNumber)
      : null;
  const standaloneToday = toTodayWorkoutDetails(
    standaloneAssignment,
    dayName,
    dayNumber
  );

  logger.debug('Resolved unified today status', {
    supabaseId,
    isCoach,
    isSubscribed,
    hasCoach,
    hasCoachAssignment: Boolean(coachAssignment),
    hasStandaloneAssignment: Boolean(standaloneAssignment),
    coachRestDay: coachToday?.isRestDay,
    standaloneRestDay: standaloneToday?.isRestDay,
  });

  sendSuccess(res, {
    isCoach,
    isSubscribed,
    hasCoach,
    tier,
    coachToday,
    standaloneToday,
  });
};
