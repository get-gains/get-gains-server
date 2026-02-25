import { z } from 'zod';

// ============== Exercise Schemas ==============

/**
 * Schema for getting exercises (query params)
 */
export const GetExercisesSchema = z.object({
  query: z.object({
    muscleGroup: z.string().optional(),
    search: z.string().optional(),
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
    primaryMuscleGroup: z.string().min(1, 'Primary muscle group is required'),
    targetMuscles: z.array(z.string()).optional().default([]),
    equipmentNeeded: z.array(z.string()).optional().default([]),
  }),
});

export type CreateExerciseInput = z.infer<typeof CreateExerciseSchema>['body'];

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
 * Schema for getting a single routine
 */
export const GetRoutineByIdSchema = z.object({
  params: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
  }),
});

export type GetRoutineByIdParams = z.infer<
  typeof GetRoutineByIdSchema
>['params'];

// ============== Workout Session Schemas ==============

/**
 * Schema for starting a workout session
 */
export const StartWorkoutSessionSchema = z.object({
  body: z.object({
    assignedProgramId: z.string().optional(),
  }),
});

export type StartWorkoutSessionInput = z.infer<
  typeof StartWorkoutSessionSchema
>['body'];

/**
 * Schema for getting today's scheduled workout
 */
export const GetTodayWorkoutSchema = z.object({
  query: z.object({
    assignedProgramId: z.string().optional(),
  }),
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
    notes: z.string().max(1000).optional(),
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
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
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
    routineExerciseId: z.string().min(1, 'Routine exercise ID is required'),
    setNumber: z.number().int().min(1, 'Set number must be at least 1'),
    repsCompleted: z.number().int().min(0, 'Reps must be at least 0'),
    weightKg: z.number().min(0).optional(),
    rpe: z.number().int().min(1).max(10).optional(),
    notes: z.string().max(500).optional(),
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
    repsCompleted: z.number().int().min(0).optional(),
    weightKg: z.number().min(0).optional(),
    rpe: z.number().int().min(1).max(10).optional(),
    notes: z.string().max(500).optional(),
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
        routineExerciseId: z.string().min(1),
        setNumber: z.number().int().min(1),
        repsCompleted: z.number().int().min(0),
        weightKg: z.number().min(0).optional(),
        rpe: z.number().int().min(1).max(10).optional(),
        notes: z.string().max(500).optional(),
        createdAt: z.string().datetime().optional(),
      })
    ),
  }),
});

export type BatchSyncSetsInput = z.infer<typeof BatchSyncSetsSchema>['body'];
