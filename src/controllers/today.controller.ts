import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';

// ─── Normalized shape returned by both helpers ───────────────────────────────

export interface TodayWorkoutDetails {
  isRestDay: boolean;
  programRoutineId: string | null;
  dayNumber: number | null;
  programName: string | null;
  routineName: string | null;
  exerciseCount: number;
  estimatedMinutes: number;
}

// ─── Helper: coach today ──────────────────────────────────────────────────────
// Matches data stored when coaches assign programs (UTC 3-letter day names).

export const queryCoachTodayForUser = async (
  supabaseId: string
): Promise<TodayWorkoutDetails | null> => {
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todayName = DAY_NAMES[new Date().getUTCDay()];

  const assignments = await prisma.assigned_program.findMany({
    where: {
      user_id: supabaseId,
      OR: [{ end_date: null }, { end_date: { gt: new Date() } }],
    },
    include: {
      program: { select: { name: true } },
      assigned_program_routines: {
        include: {
          routine: { select: { name: true, estimated_duration_minutes: true } },
          assigned_program_routine_exercises: { select: { id: true } },
        },
        orderBy: { created_at: 'asc' },
      },
    },
    orderBy: { start_date: 'desc' },
  });

  if (assignments.length === 0) return null;

  const assignment = assignments[0];
  const todayRoutines = assignment.assigned_program_routines.filter((apr) =>
    apr.days_of_week.includes(todayName)
  );

  if (todayRoutines.length === 0) {
    return {
      isRestDay: true,
      programRoutineId: null,
      dayNumber: null,
      programName: assignment.program.name,
      routineName: null,
      exerciseCount: 0,
      estimatedMinutes: 0,
    };
  }

  const todayRoutine = todayRoutines[0];
  const dayNumber =
    assignment.assigned_program_routines.findIndex(
      (r) => r.id === todayRoutine.id
    ) + 1;

  return {
    isRestDay: false,
    programRoutineId: todayRoutine.id,
    dayNumber,
    programName: assignment.program.name,
    routineName: todayRoutine.routine.name,
    exerciseCount: todayRoutine.assigned_program_routine_exercises.length,
    estimatedMinutes: todayRoutine.routine.estimated_duration_minutes,
  };
};

// ─── Helper: standalone today ─────────────────────────────────────────────────
// Matches data stored when users self-assign programs (full day name, local time).

export const queryStandaloneTodayForUser = async (
  supabaseId: string
): Promise<TodayWorkoutDetails | null> => {
  const TODAY = new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase(); // 'MONDAY', 'TUESDAY', ...

  const assignment = await prisma.assigned_program.findFirst({
    where: { user_id: supabaseId },
    orderBy: { created_at: 'desc' },
    include: {
      program: { select: { name: true } },
      assigned_program_routines: {
        include: {
          routine: { select: { name: true, estimated_duration_minutes: true } },
          assigned_program_routine_exercises: { select: { id: true } },
        },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!assignment) return null;

  const todayRoutines = assignment.assigned_program_routines.filter((apr) =>
    apr.days_of_week.includes(TODAY)
  );

  if (todayRoutines.length === 0) {
    return {
      isRestDay: true,
      programRoutineId: null,
      dayNumber: null,
      programName: assignment.program.name,
      routineName: null,
      exerciseCount: 0,
      estimatedMinutes: 0,
    };
  }

  const todayRoutine = todayRoutines[0];
  const dayNumber =
    assignment.assigned_program_routines.findIndex(
      (r) => r.id === todayRoutine.id
    ) + 1;

  return {
    isRestDay: false,
    programRoutineId: todayRoutine.id,
    dayNumber,
    programName: assignment.program.name,
    routineName: todayRoutine.routine.name,
    exerciseCount: todayRoutine.assigned_program_routine_exercises.length,
    estimatedMinutes: todayRoutine.routine.estimated_duration_minutes,
  };
};

// ─── Controller: GET /api/today ───────────────────────────────────────────────

export const getTodayStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser!;
    const subInfo = req.subscription;

    // 1+3. Coach check and standalone today are independent — run in parallel
    const [subscribedCoach, standaloneToday] = await Promise.all([
      prisma.subscribed_coach.findFirst({
        where: { user_id: appUser.supabase_auth_id, ended_at: null },
      }),
      queryStandaloneTodayForUser(appUser.supabase_auth_id),
    ]);
    const hasCoach = !!subscribedCoach;

    // 2. Coach today — only when subscribed AND has coach
    let coachToday: TodayWorkoutDetails | null = null;
    if (subInfo?.isSubscribed && hasCoach) {
      coachToday = await queryCoachTodayForUser(appUser.supabase_auth_id);
    }

    sendSuccess(res, {
      isSubscribed: subInfo?.isSubscribed ?? false,
      hasCoach,
      subscription: subInfo?.subscription ?? null,
      coachToday,
      standaloneToday,
    });
  } catch (error) {
    logger.error('Error fetching today status', error);
    sendSingleError(res, 'Failed to fetch today status', 500);
  }
};
