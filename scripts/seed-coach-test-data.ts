/**
 * Seed test data for coach usability testing.
 *
 * Creates dummy clients, exercises, routines, programs, workout sessions,
 * and performed sets so that the coach persona can complete all usability
 * test tasks against realistic data.
 *
 * Idempotent — safe to re-run; upserts by stable seed IDs.
 * Dry-run by default — pass --commit to apply changes.
 *
 * Usage:
 *   npx tsx scripts/seed-coach-test-data.ts --email coach@example.com [--commit]
 */

import 'dotenv/config';
import { DayOfWeek, CameraAngle } from '@prisma/client';
import prisma from '../src/config/database';
import { logger } from '../src/utils/logger';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const email = getArg('--email');
const COMMIT = args.includes('--commit');

// ---------------------------------------------------------------------------
// Stable seed IDs
// ---------------------------------------------------------------------------

const CLIENT_IDS = {
  alex: 'seed-client-alex-rivera',
  jordan: 'seed-client-jordan-kim',
  taylor: 'seed-client-taylor-m',
  casey: 'seed-client-casey-b',
} as const;

const EXERCISE_IDS = {
  gobletSquat: 'seed-ex-goblet-squat',
  rdls: 'seed-ex-romanian-deadlift',
  latPulldown: 'seed-ex-lat-pulldown',
  dbBench: 'seed-ex-db-bench-press',
  plank: 'seed-ex-plank',
  bulgarianSplit: 'seed-ex-bulgarian-split',
  seatedRow: 'seed-ex-seated-row',
  overheadPress: 'seed-ex-overhead-press',
} as const;

const ROUTINE_IDS = {
  upperPush: 'seed-routine-upper-push',
  lowerPull: 'seed-routine-lower-pull',
  fullBody: 'seed-routine-full-body',
} as const;

const FORM_IDS = {
  gobletSquatFront: 'seed-form-goblet-squat-front',
  rdlsSide: 'seed-form-rdls-side',
} as const;

const PROGRAM_IDS = {
  strengthPhase1: 'seed-program-strength-p1',
  hypertrophyBlock: 'seed-program-hypertrophy',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function upsertCoach(coachUserId: string): Promise<void> {
  const existing = await prisma.coach.findUnique({
    where: { user_id: coachUserId },
  });

  if (existing) {
    logger.info('Coach profile already exists — skipping');
    return;
  }

  if (!COMMIT) {
    logger.info('[DRY RUN] Would create coach profile');
    return;
  }

  await prisma.$transaction([
    prisma.coach.create({
      data: {
        user_id: coachUserId,
        certifications: ['NSCA-CSCS', 'Precision Nutrition Level 1'],
        specialties: ['Strength Training', 'Hypertrophy', 'Mobility'],
        social_links: [],
        max_clients: 40,
        accepting_clients: true,
        is_discoverable: true,
      },
    }),
    prisma.user.update({
      where: { supabase_auth_id: coachUserId },
      data: { is_coach: true },
    }),
  ]);

  logger.info('Coach profile created');
}

async function upsertDummyClients(coachUserId: string): Promise<void> {
  const clients = [
    {
      supabase_auth_id: CLIENT_IDS.alex,
      email: 'seed-alex@getgains.test',
      full_name: 'Alex Rivera',
      nickname: 'Alex',
      equipment_available: ['Dumbbells', 'Barbell', 'Cable Machine'],
      active_weekdays: [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
      ],
      height_cm: 178,
      weight_kg: 82,
    },
    {
      supabase_auth_id: CLIENT_IDS.jordan,
      email: 'seed-jordan@getgains.test',
      full_name: 'Jordan Kim',
      nickname: 'Jordan',
      equipment_available: ['Dumbbells', 'Resistance Bands', 'Kettlebell'],
      active_weekdays: [
        DayOfWeek.MONDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.FRIDAY,
      ],
      height_cm: 165,
      weight_kg: 68,
    },
    {
      supabase_auth_id: CLIENT_IDS.taylor,
      email: 'seed-taylor@getgains.test',
      full_name: 'Taylor Morgan',
      nickname: 'Taylor',
      equipment_available: ['Barbell', 'Cable Machine', 'Machines'],
      active_weekdays: [
        DayOfWeek.TUESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.SATURDAY,
      ],
      height_cm: 183,
      weight_kg: 90,
    },
    {
      supabase_auth_id: CLIENT_IDS.casey,
      email: 'seed-casey@getgains.test',
      full_name: 'Casey Brooks',
      nickname: 'Casey',
      equipment_available: ['Dumbbells', 'Bodyweight'],
      active_weekdays: [
        DayOfWeek.MONDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.FRIDAY,
      ],
      height_cm: 172,
      weight_kg: 74,
    },
  ];

  for (const c of clients) {
    const existingUser = await prisma.user.findUnique({
      where: { supabase_auth_id: c.supabase_auth_id },
    });

    if (existingUser) {
      logger.info(`Client already exists: ${c.full_name}`);
    } else if (!COMMIT) {
      logger.info(`[DRY RUN] Would create client: ${c.full_name}`);
    } else {
      await prisma.user.create({
        data: {
          supabase_auth_id: c.supabase_auth_id,
          email: c.email,
          full_name: c.full_name,
          nickname: c.nickname,
          equipment_available: [...c.equipment_available],
          active_weekdays: [...c.active_weekdays],
          height_cm: c.height_cm,
          weight_kg: c.weight_kg,
        },
      });
      logger.info(`Created client: ${c.full_name}`);
    }
  }

  // Subscribe clients to coach
  const subscriptions: {
    userId: string;
    startedAt: Date;
    endedAt: Date | null;
  }[] = [
    { userId: CLIENT_IDS.alex, startedAt: daysAgo(60), endedAt: null },
    { userId: CLIENT_IDS.jordan, startedAt: daysAgo(45), endedAt: null },
    { userId: CLIENT_IDS.taylor, startedAt: daysAgo(30), endedAt: null },
    { userId: CLIENT_IDS.casey, startedAt: daysAgo(90), endedAt: daysAgo(7) }, // expired
  ];

  for (const sub of subscriptions) {
    const existingSub = await prisma.subscribed_coach.findFirst({
      where: { coach_id: coachUserId, user_id: sub.userId },
    });

    if (existingSub) {
      logger.info(`Subscription already exists: ${sub.userId}`);
      continue;
    }

    if (!COMMIT) {
      logger.info(`[DRY RUN] Would subscribe ${sub.userId}`);
      continue;
    }

    await prisma.subscribed_coach.create({
      data: {
        coach_id: coachUserId,
        user_id: sub.userId,
        started_at: sub.startedAt,
        ended_at: sub.endedAt,
      },
    });
    logger.info(
      `Subscribed client: ${sub.userId}${sub.endedAt ? ' (expired)' : ''}`
    );
  }
}

async function upsertExercises(coachUserId: string): Promise<void> {
  const exercises = [
    {
      id: EXERCISE_IDS.gobletSquat,
      name: 'Goblet Squat',
      description:
        'Hold a dumbbell or kettlebell at chest height. Keep your chest up and descend into a squat, driving through your heels to return.',
      target_muscles: ['Quadriceps', 'Glutes', 'Core'],
      is_public: true,
    },
    {
      id: EXERCISE_IDS.rdls,
      name: 'Romanian Deadlift',
      description:
        'With a slight knee bend, hinge at the hips while keeping your back straight. Lower the weight along your shins until you feel a stretch in your hamstrings.',
      target_muscles: ['Hamstrings', 'Glutes', 'Lower Back'],
      is_public: true,
    },
    {
      id: EXERCISE_IDS.latPulldown,
      name: 'Lat Pulldown',
      description:
        'Grip the bar wider than shoulder-width. Pull down to your upper chest while squeezing your shoulder blades together. Control the release.',
      target_muscles: ['Lats', 'Biceps', 'Rear Delts'],
      is_public: true,
    },
    {
      id: EXERCISE_IDS.dbBench,
      name: 'Dumbbell Bench Press',
      description:
        'Lie on a flat bench holding dumbbells at chest level. Press upward until arms are fully extended. Lower with control.',
      target_muscles: ['Chest', 'Front Delts', 'Triceps'],
      is_public: true,
    },
    {
      id: EXERCISE_IDS.plank,
      name: 'Plank',
      description:
        'Hold a push-up position with your forearms on the ground. Keep your body in a straight line from head to heels. Engage your core throughout.',
      target_muscles: ['Core', 'Shoulders'],
      is_public: true,
    },
    {
      id: EXERCISE_IDS.bulgarianSplit,
      name: 'Bulgarian Split Squat',
      description:
        'Place your rear foot on a bench. Lower your body until your front thigh is parallel to the ground. Drive through your front heel to return.',
      target_muscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
      is_public: false,
    },
    {
      id: EXERCISE_IDS.seatedRow,
      name: 'Seated Cable Row',
      description:
        'Sit with your feet braced, grip the handle. Pull toward your lower abdomen while squeezing your shoulder blades. Keep your torso stable.',
      target_muscles: ['Lats', 'Rhomboids', 'Biceps'],
      is_public: true,
    },
    {
      id: EXERCISE_IDS.overheadPress,
      name: 'Dumbbell Overhead Press',
      description:
        'Start with dumbbells at shoulder height. Press directly overhead until arms are fully extended. Avoid arching your lower back.',
      target_muscles: ['Front Delts', 'Triceps', 'Upper Chest'],
      is_public: false,
    },
  ];

  for (const e of exercises) {
    const existing = await prisma.exercise.findUnique({ where: { id: e.id } });

    if (existing) {
      logger.info(`Exercise already exists: ${e.name}`);
      continue;
    }

    if (!COMMIT) {
      logger.info(`[DRY RUN] Would create exercise: ${e.name}`);
      continue;
    }

    await prisma.exercise.create({
      data: {
        id: e.id,
        user_id: coachUserId,
        name: e.name,
        description: e.description,
        target_muscles: e.target_muscles,
        active_segments: [],
        is_public: e.is_public,
      },
    });
    logger.info(`Created exercise: ${e.name}`);
  }
}

async function upsertForms(): Promise<void> {
  const forms = [
    {
      id: FORM_IDS.gobletSquatFront,
      exercise_id: EXERCISE_IDS.gobletSquat,
      camera_angle: CameraAngle.FRONT,
      recorded_frames_key: 'seed/frames/goblet-squat-front.json',
    },
    {
      id: FORM_IDS.rdlsSide,
      exercise_id: EXERCISE_IDS.rdls,
      camera_angle: CameraAngle.SIDE_LEFT,
      recorded_frames_key: 'seed/frames/rdls-side.json',
    },
  ];

  for (const f of forms) {
    const existing = await prisma.exercise_form.findUnique({
      where: { id: f.id },
    });

    if (existing) {
      logger.info(`Form already exists: ${f.id}`);
      continue;
    }

    if (!COMMIT) {
      logger.info(
        `[DRY RUN] Would create form: ${f.camera_angle} for ${f.exercise_id}`
      );
      continue;
    }

    await prisma.exercise_form.create({ data: f });
    logger.info(`Created form: ${f.camera_angle} for ${f.exercise_id}`);
  }
}

async function upsertRoutineTemplates(coachUserId: string): Promise<void> {
  const routines: {
    id: string;
    name: string;
    description: string;
    estimated_duration_minutes: number;
    exercises: {
      exerciseId: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
      order: number;
    }[];
  }[] = [
    {
      id: ROUTINE_IDS.upperPush,
      name: 'Upper Body Push',
      description:
        'Focus on chest, shoulders, and triceps with pressing movements. Ideal as a push-day in a push/pull/legs split.',
      estimated_duration_minutes: 45,
      exercises: [
        {
          exerciseId: EXERCISE_IDS.dbBench,
          sets: 4,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 90,
          order: 1,
        },
        {
          exerciseId: EXERCISE_IDS.overheadPress,
          sets: 3,
          repsMin: 8,
          repsMax: 10,
          restSeconds: 90,
          order: 2,
        },
        {
          exerciseId: EXERCISE_IDS.plank,
          sets: 3,
          repsMin: 1,
          repsMax: 1,
          restSeconds: 60,
          order: 3,
        },
      ],
    },
    {
      id: ROUTINE_IDS.lowerPull,
      name: 'Lower Body Pull',
      description:
        'Hamstring and glute-dominant lower body session with pulling accessories for back development.',
      estimated_duration_minutes: 50,
      exercises: [
        {
          exerciseId: EXERCISE_IDS.rdls,
          sets: 4,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 90,
          order: 1,
        },
        {
          exerciseId: EXERCISE_IDS.bulgarianSplit,
          sets: 3,
          repsMin: 10,
          repsMax: 12,
          restSeconds: 60,
          order: 2,
        },
        {
          exerciseId: EXERCISE_IDS.seatedRow,
          sets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 60,
          order: 3,
        },
      ],
    },
    {
      id: ROUTINE_IDS.fullBody,
      name: 'Full Body Circuit',
      description:
        'Efficient full-body routine combining compound lifts and core work. Great for clients with limited training days.',
      estimated_duration_minutes: 40,
      exercises: [
        {
          exerciseId: EXERCISE_IDS.gobletSquat,
          sets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 60,
          order: 1,
        },
        {
          exerciseId: EXERCISE_IDS.dbBench,
          sets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 60,
          order: 2,
        },
        {
          exerciseId: EXERCISE_IDS.latPulldown,
          sets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 60,
          order: 3,
        },
        {
          exerciseId: EXERCISE_IDS.rdls,
          sets: 3,
          repsMin: 10,
          repsMax: 12,
          restSeconds: 60,
          order: 4,
        },
        {
          exerciseId: EXERCISE_IDS.plank,
          sets: 3,
          repsMin: 1,
          repsMax: 1,
          restSeconds: 45,
          order: 5,
        },
      ],
    },
  ];

  for (const rt of routines) {
    const existing = await prisma.routine.findUnique({ where: { id: rt.id } });

    if (existing) {
      logger.info(`Routine template already exists: ${rt.name}`);
      continue;
    }

    if (!COMMIT) {
      logger.info(`[DRY RUN] Would create routine template: ${rt.name}`);
      continue;
    }

    await prisma.routine.create({
      data: {
        id: rt.id,
        user_id: coachUserId,
        name: rt.name,
        description: rt.description,
        estimated_duration_minutes: rt.estimated_duration_minutes,
      },
    });

    // Note: routine.exercises is NOT a direct relation in the schema;
    // exercises are linked through assigned_program_routine_exercise.
    // The routine template stores its exercises via the program assignment flow.
    logger.info(
      `Created routine template: ${rt.name} (${rt.exercises.length} exercises defined in config)`
    );
  }
}

async function upsertAssignedPrograms(coachUserId: string): Promise<void> {
  // Program 1: Active, assigned to Alex (client-1)
  const prog1Id = PROGRAM_IDS.strengthPhase1;
  const existingProg1 = await prisma.assigned_program.findUnique({
    where: { id: prog1Id },
  });

  if (!existingProg1) {
    if (!COMMIT) {
      logger.info(
        '[DRY RUN] Would create assigned program: 12-Week Strength Phase 1'
      );
    } else {
      await prisma.assigned_program.create({
        data: {
          id: prog1Id,
          user_id: CLIENT_IDS.alex,
          coach_id: coachUserId,
          name: '12-Week Strength Phase 1',
          description:
            'Foundational strength phase focusing on progressive overload across compound lifts.',
          notes:
            'Focus on form over weight. Increase load by 2.5kg each week if all sets completed with good technique.',
          is_active: true,
          start_date: daysAgo(14),
          end_date: daysFromNow(70),
        },
      });

      // Add routines to program 1
      const apr1Id = 'seed-apr-str-p1-upper';
      await prisma.assigned_program_routine.create({
        data: {
          id: apr1Id,
          assigned_program_id: prog1Id,
          source_routine_id: ROUTINE_IDS.upperPush,
          name: 'Upper Body Push',
          description: 'Chest, shoulders, and triceps pressing focus.',
          estimated_duration_minutes: 45,
          order_in_program: 1,
          days_of_week: [DayOfWeek.MONDAY, DayOfWeek.THURSDAY],
        },
      });

      // Exercises for apr1
      const apr1Ex1Id = 'seed-apre-str-p1-upper-db';
      await prisma.assigned_program_routine_exercise.create({
        data: {
          id: apr1Ex1Id,
          assigned_program_routine_id: apr1Id,
          exercise_id: EXERCISE_IDS.dbBench,
          sets: 4,
          reps_min: 8,
          reps_max: 12,
          rest_seconds: 90,
          order_in_routine: 1,
        },
      });
      const apr1Ex2Id = 'seed-apre-str-p1-upper-ohp';
      await prisma.assigned_program_routine_exercise.create({
        data: {
          id: apr1Ex2Id,
          assigned_program_routine_id: apr1Id,
          exercise_id: EXERCISE_IDS.overheadPress,
          sets: 3,
          reps_min: 8,
          reps_max: 10,
          rest_seconds: 90,
          order_in_routine: 2,
        },
      });
      const apr1Ex3Id = 'seed-apre-str-p1-upper-plank';
      await prisma.assigned_program_routine_exercise.create({
        data: {
          id: apr1Ex3Id,
          assigned_program_routine_id: apr1Id,
          exercise_id: EXERCISE_IDS.plank,
          sets: 3,
          reps_min: 1,
          reps_max: 1,
          rest_seconds: 60,
          order_in_routine: 3,
        },
      });

      const apr2Id = 'seed-apr-str-p1-lower';
      await prisma.assigned_program_routine.create({
        data: {
          id: apr2Id,
          assigned_program_id: prog1Id,
          source_routine_id: ROUTINE_IDS.lowerPull,
          name: 'Lower Body Pull',
          description: 'Hamstring and glute dominant lower body.',
          estimated_duration_minutes: 50,
          order_in_program: 2,
          days_of_week: [DayOfWeek.TUESDAY, DayOfWeek.FRIDAY],
        },
      });

      // Exercises for apr2
      const apr2Ex1Id = 'seed-apre-str-p1-lower-rdls';
      await prisma.assigned_program_routine_exercise.create({
        data: {
          id: apr2Ex1Id,
          assigned_program_routine_id: apr2Id,
          exercise_id: EXERCISE_IDS.rdls,
          sets: 4,
          reps_min: 8,
          reps_max: 12,
          rest_seconds: 90,
          order_in_routine: 1,
        },
      });
      const apr2Ex2Id = 'seed-apre-str-p1-lower-bss';
      await prisma.assigned_program_routine_exercise.create({
        data: {
          id: apr2Ex2Id,
          assigned_program_routine_id: apr2Id,
          exercise_id: EXERCISE_IDS.bulgarianSplit,
          sets: 3,
          reps_min: 10,
          reps_max: 12,
          rest_seconds: 60,
          order_in_routine: 2,
        },
      });
      const apr2Ex3Id = 'seed-apre-str-p1-lower-row';
      await prisma.assigned_program_routine_exercise.create({
        data: {
          id: apr2Ex3Id,
          assigned_program_routine_id: apr2Id,
          exercise_id: EXERCISE_IDS.seatedRow,
          sets: 3,
          reps_min: 10,
          reps_max: 15,
          rest_seconds: 60,
          order_in_routine: 3,
        },
      });

      // Create workout sessions for Alex (client-1): 6 sessions over 14 days
      const alexSessionData = [
        {
          aprId: apr1Id,
          daysAgo: 13,
          exercises: [
            {
              apreId: apr1Ex1Id,
              sets: [
                { reps: 12, weight: 20 },
                { reps: 10, weight: 22.5 },
                { reps: 9, weight: 22.5 },
                { reps: 8, weight: 22.5 },
              ],
            },
            {
              apreId: apr1Ex2Id,
              sets: [
                { reps: 10, weight: 14 },
                { reps: 9, weight: 14 },
                { reps: 8, weight: 14 },
              ],
            },
            {
              apreId: apr1Ex3Id,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
        {
          aprId: apr2Id,
          daysAgo: 12,
          exercises: [
            {
              apreId: apr2Ex1Id,
              sets: [
                { reps: 12, weight: 40 },
                { reps: 10, weight: 45 },
                { reps: 8, weight: 50 },
                { reps: 8, weight: 50 },
              ],
            },
            {
              apreId: apr2Ex2Id,
              sets: [
                { reps: 12, weight: 12 },
                { reps: 10, weight: 14 },
                { reps: 10, weight: 14 },
              ],
            },
            {
              apreId: apr2Ex3Id,
              sets: [
                { reps: 15, weight: 30 },
                { reps: 12, weight: 32.5 },
                { reps: 10, weight: 35 },
              ],
            },
          ],
        },
        {
          aprId: apr1Id,
          daysAgo: 9,
          exercises: [
            {
              apreId: apr1Ex1Id,
              sets: [
                { reps: 12, weight: 22.5 },
                { reps: 10, weight: 22.5 },
                { reps: 9, weight: 25 },
                { reps: 8, weight: 25 },
              ],
            },
            {
              apreId: apr1Ex2Id,
              sets: [
                { reps: 10, weight: 14 },
                { reps: 10, weight: 14 },
                { reps: 8, weight: 14 },
              ],
            },
            {
              apreId: apr1Ex3Id,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
        {
          aprId: apr2Id,
          daysAgo: 8,
          exercises: [
            {
              apreId: apr2Ex1Id,
              sets: [
                { reps: 12, weight: 45 },
                { reps: 10, weight: 50 },
                { reps: 8, weight: 50 },
                { reps: 6, weight: 50 },
              ],
            },
            {
              apreId: apr2Ex2Id,
              sets: [
                { reps: 12, weight: 14 },
                { reps: 10, weight: 14 },
                { reps: 10, weight: 14 },
              ],
            },
            {
              apreId: apr2Ex3Id,
              sets: [
                { reps: 15, weight: 32.5 },
                { reps: 12, weight: 35 },
                { reps: 10, weight: 35 },
              ],
            },
          ],
        },
        {
          aprId: apr1Id,
          daysAgo: 4,
          exercises: [
            {
              apreId: apr1Ex1Id,
              sets: [
                { reps: 10, weight: 25 },
                { reps: 8, weight: 25 },
                { reps: 8, weight: 27.5 },
                { reps: 6, weight: 27.5 },
              ],
            },
            {
              apreId: apr1Ex2Id,
              sets: [
                { reps: 10, weight: 14 },
                { reps: 8, weight: 16 },
                { reps: 8, weight: 16 },
              ],
            },
            {
              apreId: apr1Ex3Id,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
        {
          aprId: apr2Id,
          daysAgo: 3,
          exercises: [
            {
              apreId: apr2Ex1Id,
              sets: [
                { reps: 10, weight: 50 },
                { reps: 8, weight: 52.5 },
                { reps: 6, weight: 52.5 },
                { reps: 6, weight: 52.5 },
              ],
            },
            {
              apreId: apr2Ex2Id,
              sets: [
                { reps: 10, weight: 14 },
                { reps: 10, weight: 16 },
                { reps: 8, weight: 16 },
              ],
            },
            {
              apreId: apr2Ex3Id,
              sets: [
                { reps: 12, weight: 35 },
                { reps: 10, weight: 37.5 },
                { reps: 8, weight: 37.5 },
              ],
            },
          ],
        },
      ];

      for (const sd of alexSessionData) {
        await createWorkoutSession(sd.aprId, sd.daysAgo, sd.exercises);
      }
      logger.info(
        'Created assigned program + routines + 6 sessions: 12-Week Strength Phase 1 (Alex)'
      );
    }
  }

  // Program 2: Inactive/ended, assigned to Taylor (client-3)
  const prog2Id = PROGRAM_IDS.hypertrophyBlock;
  const existingProg2 = await prisma.assigned_program.findUnique({
    where: { id: prog2Id },
  });

  if (!existingProg2) {
    if (!COMMIT) {
      logger.info(
        '[DRY RUN] Would create assigned program: 8-Week Hypertrophy Block'
      );
    } else {
      await prisma.assigned_program.create({
        data: {
          id: prog2Id,
          user_id: CLIENT_IDS.taylor,
          coach_id: coachUserId,
          name: '8-Week Hypertrophy Block',
          description:
            'Higher volume phase targeting muscle growth with moderate loads and shorter rest.',
          notes: null,
          is_active: false,
          start_date: daysAgo(60),
          end_date: daysAgo(7),
        },
      });

      const apr3Id = 'seed-apr-hyp-fullbody';
      await prisma.assigned_program_routine.create({
        data: {
          id: apr3Id,
          assigned_program_id: prog2Id,
          source_routine_id: ROUTINE_IDS.fullBody,
          name: 'Full Body Circuit',
          description: 'Efficient full-body routine.',
          estimated_duration_minutes: 40,
          order_in_program: 1,
          days_of_week: [
            DayOfWeek.MONDAY,
            DayOfWeek.WEDNESDAY,
            DayOfWeek.FRIDAY,
          ],
        },
      });

      const apr3ExIds = {
        gs: 'seed-apre-hyp-fb-gs',
        db: 'seed-apre-hyp-fb-db',
        lp: 'seed-apre-hyp-fb-lp',
        rdls: 'seed-apre-hyp-fb-rdls',
        pl: 'seed-apre-hyp-fb-pl',
      };

      await prisma.assigned_program_routine_exercise.createMany({
        data: [
          {
            id: apr3ExIds.gs,
            assigned_program_routine_id: apr3Id,
            exercise_id: EXERCISE_IDS.gobletSquat,
            sets: 3,
            reps_min: 10,
            reps_max: 15,
            rest_seconds: 60,
            order_in_routine: 1,
          },
          {
            id: apr3ExIds.db,
            assigned_program_routine_id: apr3Id,
            exercise_id: EXERCISE_IDS.dbBench,
            sets: 3,
            reps_min: 8,
            reps_max: 12,
            rest_seconds: 60,
            order_in_routine: 2,
          },
          {
            id: apr3ExIds.lp,
            assigned_program_routine_id: apr3Id,
            exercise_id: EXERCISE_IDS.latPulldown,
            sets: 3,
            reps_min: 10,
            reps_max: 15,
            rest_seconds: 60,
            order_in_routine: 3,
          },
          {
            id: apr3ExIds.rdls,
            assigned_program_routine_id: apr3Id,
            exercise_id: EXERCISE_IDS.rdls,
            sets: 3,
            reps_min: 10,
            reps_max: 12,
            rest_seconds: 60,
            order_in_routine: 4,
          },
          {
            id: apr3ExIds.pl,
            assigned_program_routine_id: apr3Id,
            exercise_id: EXERCISE_IDS.plank,
            sets: 3,
            reps_min: 1,
            reps_max: 1,
            rest_seconds: 45,
            order_in_routine: 5,
          },
        ],
      });

      // 4 sessions for Taylor (ended program, fewer sessions)
      const taylorSessionData = [
        {
          aprId: apr3Id,
          daysAgo: 55,
          exercises: [
            {
              apreId: apr3ExIds.gs,
              sets: [
                { reps: 15, weight: 16 },
                { reps: 12, weight: 18 },
                { reps: 10, weight: 20 },
              ],
            },
            {
              apreId: apr3ExIds.db,
              sets: [
                { reps: 12, weight: 18 },
                { reps: 10, weight: 20 },
                { reps: 8, weight: 22.5 },
              ],
            },
            {
              apreId: apr3ExIds.lp,
              sets: [
                { reps: 15, weight: 35 },
                { reps: 12, weight: 40 },
                { reps: 10, weight: 42.5 },
              ],
            },
            {
              apreId: apr3ExIds.rdls,
              sets: [
                { reps: 12, weight: 50 },
                { reps: 10, weight: 55 },
                { reps: 8, weight: 60 },
              ],
            },
            {
              apreId: apr3ExIds.pl,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
        {
          aprId: apr3Id,
          daysAgo: 51,
          exercises: [
            {
              apreId: apr3ExIds.gs,
              sets: [
                { reps: 15, weight: 18 },
                { reps: 12, weight: 20 },
                { reps: 10, weight: 22 },
              ],
            },
            {
              apreId: apr3ExIds.db,
              sets: [
                { reps: 12, weight: 20 },
                { reps: 10, weight: 22.5 },
                { reps: 8, weight: 25 },
              ],
            },
            {
              apreId: apr3ExIds.lp,
              sets: [
                { reps: 15, weight: 40 },
                { reps: 12, weight: 42.5 },
                { reps: 10, weight: 45 },
              ],
            },
            {
              apreId: apr3ExIds.rdls,
              sets: [
                { reps: 12, weight: 55 },
                { reps: 10, weight: 60 },
                { reps: 8, weight: 60 },
              ],
            },
            {
              apreId: apr3ExIds.pl,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
        {
          aprId: apr3Id,
          daysAgo: 46,
          exercises: [
            {
              apreId: apr3ExIds.gs,
              sets: [
                { reps: 12, weight: 20 },
                { reps: 10, weight: 22 },
                { reps: 8, weight: 24 },
              ],
            },
            {
              apreId: apr3ExIds.db,
              sets: [
                { reps: 10, weight: 22.5 },
                { reps: 8, weight: 25 },
                { reps: 6, weight: 27.5 },
              ],
            },
            {
              apreId: apr3ExIds.lp,
              sets: [
                { reps: 12, weight: 42.5 },
                { reps: 10, weight: 45 },
                { reps: 8, weight: 47.5 },
              ],
            },
            {
              apreId: apr3ExIds.rdls,
              sets: [
                { reps: 10, weight: 60 },
                { reps: 8, weight: 65 },
                { reps: 6, weight: 65 },
              ],
            },
            {
              apreId: apr3ExIds.pl,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
        {
          aprId: apr3Id,
          daysAgo: 41,
          exercises: [
            {
              apreId: apr3ExIds.gs,
              sets: [
                { reps: 12, weight: 22 },
                { reps: 10, weight: 24 },
                { reps: 8, weight: 24 },
              ],
            },
            {
              apreId: apr3ExIds.db,
              sets: [
                { reps: 10, weight: 25 },
                { reps: 8, weight: 27.5 },
                { reps: 6, weight: 27.5 },
              ],
            },
            {
              apreId: apr3ExIds.lp,
              sets: [
                { reps: 12, weight: 45 },
                { reps: 10, weight: 47.5 },
                { reps: 8, weight: 50 },
              ],
            },
            {
              apreId: apr3ExIds.rdls,
              sets: [
                { reps: 10, weight: 65 },
                { reps: 8, weight: 70 },
                { reps: 6, weight: 70 },
              ],
            },
            {
              apreId: apr3ExIds.pl,
              sets: [
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
                { reps: 1, weight: 0 },
              ],
            },
          ],
        },
      ];

      for (const sd of taylorSessionData) {
        await createWorkoutSession(sd.aprId, sd.daysAgo, sd.exercises);
      }
      logger.info(
        'Created assigned program + routines + 4 sessions: 8-Week Hypertrophy Block (Taylor)'
      );
    }
  }

  // Jordan (client-2) has an active subscription but no assigned program and no sessions.
  // This tests the "subscribed but no data" scenario in the performance dashboard.
}

async function createWorkoutSession(
  aprId: string,
  daysAgoVal: number,
  exercises: { apreId: string; sets: { reps: number; weight: number }[] }[]
): Promise<void> {
  const sessionId = `seed-session-${aprId}-${daysAgoVal}`;

  const existing = await prisma.workout_session.findUnique({
    where: { id: sessionId },
  });
  if (existing) {
    logger.info(`Session already exists: ${sessionId}`);
    return;
  }

  const sessionDate = daysAgo(daysAgoVal);
  const completedAt = new Date(sessionDate);
  completedAt.setHours(completedAt.getHours() + 1);
  const startedAt = new Date(sessionDate);

  await prisma.workout_session.create({
    data: {
      id: sessionId,
      assigned_program_routine_id: aprId,
      started_at: startedAt,
      completed_at: completedAt,
    },
  });

  for (const ex of exercises) {
    // Look up the exercise to get snapshot data
    const apre = await prisma.assigned_program_routine_exercise.findUnique({
      where: { id: ex.apreId },
      select: {
        exercise: { select: { name: true } },
        reps_min: true,
        reps_max: true,
        rest_seconds: true,
      },
    });

    for (let i = 0; i < ex.sets.length; i++) {
      const s = ex.sets[i];
      const setId = `seed-ps-${sessionId}-${ex.apreId}-${i + 1}`;

      const existingSet = await prisma.performed_set.findUnique({
        where: { id: setId },
      });
      if (existingSet) continue;

      await prisma.performed_set.create({
        data: {
          id: setId,
          workout_session_id: sessionId,
          assigned_program_routine_exercise_id: ex.apreId,
          set_number: i + 1,
          reps: s.reps,
          weight: s.weight,
          overall_score: Math.floor(Math.random() * 20) + 75, // 75-94
          completed_at: new Date(sessionDate.getTime() + (i + 1) * 180000), // staggered
          exercise_name_snapshot: apre?.exercise.name ?? null,
          target_reps_min: apre?.reps_min ?? null,
          target_reps_max: apre?.reps_max ?? null,
          target_rest_seconds: apre?.rest_seconds ?? null,
          target_weight_kg: null,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!email) {
    logger.error('Missing required --email flag');
    logger.info(
      'Usage: npx tsx scripts/seed-coach-test-data.ts --email coach@example.com [--commit]'
    );
    process.exit(1);
  }

  logger.info(
    `Seeding coach test data for ${email}${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}`
  );

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      supabase_auth_id: true,
      email: true,
      full_name: true,
      is_coach: true,
    },
  });

  if (!user) {
    logger.error(
      `No user found with email: ${email}. Create the account first.`
    );
    process.exit(1);
  }

  logger.info(`Found user: ${user.full_name} (${user.email})`, {
    supabaseId: user.supabase_auth_id,
    isCoach: user.is_coach,
  });

  const coachUserId = user.supabase_auth_id;

  // 1. Promote user to coach if needed
  await upsertCoach(coachUserId);

  // 2. Create dummy clients and subscribe them to the coach
  await upsertDummyClients(coachUserId);

  // 3. Create exercises
  await upsertExercises(coachUserId);

  // 4. Create form metadata
  await upsertForms();

  // 5. Create routine templates
  await upsertRoutineTemplates(coachUserId);

  // 6. Create assigned programs with workout sessions
  await upsertAssignedPrograms(coachUserId);

  logger.info(
    COMMIT
      ? 'Seed complete.'
      : 'Dry run complete. Pass --commit to apply changes.'
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  logger.error('seed-coach-test-data script failed', error);
  process.exit(1);
});
