import { z } from 'zod';
import { DayOfWeekSchema } from './day.schema';

// ============== DayOfWeek Enum (shared) ==============
export type { DayOfWeek } from './day.schema';

// ============== Self Program Schemas ==============

/**
 * Create a new program for a user themselves.
 * POST /user/programs
 */
export const CreateSelfProgramSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).default(''),
    notes: z.string().max(5000).optional(),
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
  }),
});

export type CreateSelfProgramInput = z.infer<
  typeof CreateSelfProgramSchema
>['body'];

/**
 * Get self programs list.
 * GET /user/programs
 */
export const GetSelfProgramsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetSelfProgramsQuery = z.infer<
  typeof GetSelfProgramsSchema
>['query'];

/**
 * Update self program metadata.
 * PATCH /user/programs/:programId
 */
export const UpdateSelfProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      notes: z.string().max(5000).nullable().optional(),
      is_active: z.boolean().optional(),
      start_date: z.coerce.date().nullable().optional(),
      end_date: z.coerce.date().nullable().optional(),
    })
    .refine(
      (b) =>
        b.name !== undefined ||
        b.description !== undefined ||
        b.notes !== undefined ||
        b.is_active !== undefined ||
        b.start_date !== undefined ||
        b.end_date !== undefined,
      { message: 'At least one field must be provided' }
    ),
});

export type UpdateSelfProgramParams = z.infer<
  typeof UpdateSelfProgramSchema
>['params'];
export type UpdateSelfProgramInput = z.infer<
  typeof UpdateSelfProgramSchema
>['body'];

/**
 * Soft-delete a self program.
 * DELETE /user/programs/:programId
 */
export const DeleteSelfProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
});

export type DeleteSelfProgramParams = z.infer<
  typeof DeleteSelfProgramSchema
>['params'];

/**
 * Get self program by ID.
 * GET /user/programs/:programId
 */
export const GetSelfProgramByIdSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
});

export type GetSelfProgramByIdParams = z.infer<
  typeof GetSelfProgramByIdSchema
>['params'];

// ============== Program Routine Schemas ==============

/**
 * Inline exercise definition for creating a routine.
 */
const InlineExerciseSchema = z.object({
  exercise_id: z.string().cuid(),
  sets: z.number().int().min(1),
  reps_min: z.number().int().min(1),
  reps_max: z.number().int().min(1),
  rest_seconds: z.number().int().min(0),
  order_in_routine: z.number().int().min(1),
});

/**
 * Add a routine to a self program.
 * POST /user/programs/:programId/routines
 */
export const AddSelfProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).default(''),
    estimated_duration_minutes: z.number().int().min(1),
    days_of_week: z.array(DayOfWeekSchema).min(1),
    order_in_program: z.number().int().min(0),
    exercises: z.array(InlineExerciseSchema).optional().default([]),
  }),
});

export type AddSelfProgramRoutineParams = z.infer<
  typeof AddSelfProgramRoutineSchema
>['params'];
export type AddSelfProgramRoutineInput = z.infer<
  typeof AddSelfProgramRoutineSchema
>['body'];

/**
 * Update a routine within a self program.
 * PATCH /user/programs/:programId/routines/:aprId
 */
export const UpdateSelfProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      estimated_duration_minutes: z.number().int().min(1).optional(),
      days_of_week: z.array(DayOfWeekSchema).min(1).optional(),
      order_in_program: z.number().int().min(0).optional(),
    })
    .refine(
      (b) =>
        b.name !== undefined ||
        b.description !== undefined ||
        b.estimated_duration_minutes !== undefined ||
        b.days_of_week !== undefined ||
        b.order_in_program !== undefined,
      { message: 'At least one field must be provided' }
    ),
});

export type UpdateSelfProgramRoutineParams = z.infer<
  typeof UpdateSelfProgramRoutineSchema
>['params'];
export type UpdateSelfProgramRoutineInput = z.infer<
  typeof UpdateSelfProgramRoutineSchema
>['body'];

/**
 * Soft-delete a routine from a self program.
 * DELETE /user/programs/:programId/routines/:aprId
 */
export const DeleteSelfProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
  }),
});

export type DeleteSelfProgramRoutineParams = z.infer<
  typeof DeleteSelfProgramRoutineSchema
>['params'];

// ============== Program Routine Exercise Schemas ==============

/**
 * Add an exercise to a self program routine.
 * POST /user/programs/:programId/routines/:aprId/exercises
 */
export const AddSelfProgramRoutineExerciseSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
  }),
  body: InlineExerciseSchema,
});

export type AddSelfProgramRoutineExerciseParams = z.infer<
  typeof AddSelfProgramRoutineExerciseSchema
>['params'];
export type AddSelfProgramRoutineExerciseInput = z.infer<
  typeof AddSelfProgramRoutineExerciseSchema
>['body'];

/**
 * Update an exercise within a self program routine.
 * PATCH /user/programs/:programId/routines/:aprId/exercises/:apreId
 */
export const UpdateSelfProgramRoutineExerciseSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
    apreId: z.string().cuid(),
  }),
  body: z
    .object({
      exercise_id: z.string().cuid().optional(),
      sets: z.number().int().min(1).optional(),
      reps_min: z.number().int().min(1).optional(),
      reps_max: z.number().int().min(1).optional(),
      rest_seconds: z.number().int().min(0).optional(),
      order_in_routine: z.number().int().min(1).optional(),
    })
    .refine(
      (b) =>
        b.exercise_id !== undefined ||
        b.sets !== undefined ||
        b.reps_min !== undefined ||
        b.reps_max !== undefined ||
        b.rest_seconds !== undefined ||
        b.order_in_routine !== undefined,
      { message: 'At least one field must be provided' }
    ),
});

export type UpdateSelfProgramRoutineExerciseParams = z.infer<
  typeof UpdateSelfProgramRoutineExerciseSchema
>['params'];
export type UpdateSelfProgramRoutineExerciseInput = z.infer<
  typeof UpdateSelfProgramRoutineExerciseSchema
>['body'];

/**
 * Delete an exercise from a self program routine.
 * DELETE /user/programs/:programId/routines/:aprId/exercises/:apreId
 */
export const DeleteSelfProgramRoutineExerciseSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
    apreId: z.string().cuid(),
  }),
});

export type DeleteSelfProgramRoutineExerciseParams = z.infer<
  typeof DeleteSelfProgramRoutineExerciseSchema
>['params'];
