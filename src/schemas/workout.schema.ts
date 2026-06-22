import { z } from 'zod';

// ============== Exercise Schemas ==============

/**
 * Schema for getting exercises (query params)
 */
export const GetExercisesSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    onlyMine: z.preprocess(
      (v) => v === 'true' || v === true,
      z.boolean().optional().default(false)
    ),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetExercisesQuery = z.infer<typeof GetExercisesSchema>['query'];

/**
 * Schema for creating an exercise (coach only)
 */
export const CreateExerciseSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Exercise name is required').max(100),
    description: z.string().min(1, 'Description is required').max(2000),
    target_muscles: z.array(z.string()).optional().default([]),
    is_public: z.boolean().optional().default(true),
  }),
});

export type CreateExerciseInput = z.infer<typeof CreateExerciseSchema>['body'];

/**
 * Schema for updating an exercise (coach only, must own the exercise)
 */
export const UpdateExerciseSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(2000).optional(),
    target_muscles: z.array(z.string()).optional(),
    is_public: z.boolean().optional(),
  }),
});

export type UpdateExerciseParams = z.infer<
  typeof UpdateExerciseSchema
>['params'];
export type UpdateExerciseInput = z.infer<typeof UpdateExerciseSchema>['body'];

/**
 * Schema for deleting an exercise (coach only, must own the exercise)
 */
export const DeleteExerciseSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});

export type DeleteExerciseParams = z.infer<
  typeof DeleteExerciseSchema
>['params'];

// ============== Program Schemas ==============

/**
 * Schema for getting the authenticated user's assigned programs
 */
export const GetAssignedProgramsSchema = z.object({
  query: z.object({
    activeOnly: z.coerce.boolean().optional().default(true),
  }),
});

export type GetAssignedProgramsQuery = z.infer<
  typeof GetAssignedProgramsSchema
>['query'];

// ============== Routine Schemas ==============

/**
 * Schema for getting routines
 */
export const GetRoutinesSchema = z.object({
  query: z.object({
    programId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetRoutinesQuery = z.infer<typeof GetRoutinesSchema>['query'];

/**
 * Schema for getting a single assigned program routine
 */
export const GetRoutineByIdSchema = z.object({
  params: z.object({
    assignedProgramRoutineId: z
      .string()
      .min(1, 'Assigned program routine ID is required'),
  }),
});

export type GetRoutineByIdParams = z.infer<
  typeof GetRoutineByIdSchema
>['params'];

// ============== Programs Schema ==============

/**
 * Schema for getting user's assigned programs (client-facing, active only)
 */
export const GetProgramsSchema = z.object({
  query: z.object({}),
});

export type GetProgramsQuery = z.infer<typeof GetProgramsSchema>['query'];

// ============== Workout Session Schemas ==============

/**
 * Schema for starting a workout session (must belong to an assigned program routine)
 */
export const StartWorkoutSessionSchema = z.object({
  body: z.object({
    id: z.string().cuid2().optional(),
    assignedProgramRoutineId: z
      .string()
      .min(1, 'Assigned program routine ID is required'),
  }),
});

export type StartWorkoutSessionInput = z.infer<
  typeof StartWorkoutSessionSchema
>['body'];

/**
 * Schema for getting today's scheduled workout (uses days_of_week, no explicit ID needed)
 */
export const GetTodayWorkoutSchema = z.object({
  query: z.object({}),
});

export type GetTodayWorkoutQuery = z.infer<
  typeof GetTodayWorkoutSchema
>['query'];

/**
 * Schema for completing a workout session
 */
export const CompleteWorkoutSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
  body: z.object({
    feedback: z.string().max(1000).optional(),
  }),
});

export type CompleteWorkoutSessionParams = z.infer<
  typeof CompleteWorkoutSessionSchema
>['params'];
export type CompleteWorkoutSessionInput = z.infer<
  typeof CompleteWorkoutSessionSchema
>['body'];

/**
 * Schema for getting workout sessions (history)
 */
export const GetWorkoutSessionsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
  }),
});

export type GetWorkoutSessionsQuery = z.infer<
  typeof GetWorkoutSessionsSchema
>['query'];

/**
 * Schema for getting a single workout session
 */
export const GetWorkoutSessionByIdSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
});

export type GetWorkoutSessionByIdParams = z.infer<
  typeof GetWorkoutSessionByIdSchema
>['params'];

/**
 * Schema for getting active workout session
 */
export const GetActiveSessionSchema = z.object({});

// ============== Performed Set Schemas ==============

/**
 * Schema for logging a set
 */
export const LogSetSchema = z.object({
  body: z.object({
    workoutSessionId: z.string().min(1, 'Workout session ID is required'),
    assignedProgramRoutineExerciseId: z
      .string()
      .min(1, 'Assigned program routine exercise ID is required'),
    set_number: z.number().int().min(1),
    reps: z.number().int().min(0),
    weight: z.number().min(0),
    overallScore: z.number().int().min(0).max(100),
    recordedFramesKey: z.string().optional(),
    completedAt: z.iso.datetime(),
  }),
});

export type LogSetInput = z.infer<typeof LogSetSchema>['body'];

/**
 * Schema for updating a set
 */
export const UpdateSetSchema = z.object({
  params: z.object({
    setId: z.string().min(1, 'Set ID is required'),
  }),
  body: z.object({
    weight: z.number().min(0).optional(),
  }),
});

export type UpdateSetParams = z.infer<typeof UpdateSetSchema>['params'];
export type UpdateSetInput = z.infer<typeof UpdateSetSchema>['body'];

/**
 * Schema for deleting a set
 */
export const DeleteSetSchema = z.object({
  params: z.object({
    setId: z.string().min(1, 'Set ID is required'),
  }),
});

export type DeleteSetParams = z.infer<typeof DeleteSetSchema>['params'];

/**
 * Schema for batch syncing sets from offline
 */
export const BatchSyncSetsSchema = z.object({
  body: z.object({
    sets: z.array(
      z.object({
        localId: z.string().optional(),
        workoutSessionId: z.string().min(1),
        assignedProgramRoutineExerciseId: z.string().min(1),
        set_number: z.number().int().min(1),
        reps: z.number().int().min(0),
        weight: z.number().min(0),
        overallScore: z.number().int().min(0).max(100),
        recordedFramesKey: z.string().optional(),
        completedAt: z.iso.datetime(),
        createdAt: z.iso.datetime().optional(),
      })
    ),
  }),
});

export type BatchSyncSetsInput = z.infer<typeof BatchSyncSetsSchema>['body'];

// ============== Weekly Stats Schema ==============

/**
 * Schema for getting weekly workout stats
 */
export const GetWeeklyStatsSchema = z.object({
  query: z.object({
    // ISO date string for which week to query (defaults to current week)
    weekOf: z.iso.datetime().optional(),
  }),
});

export type GetWeeklyStatsQuery = z.infer<typeof GetWeeklyStatsSchema>['query'];
