import { z } from 'zod';
import { DayOfWeekSchema } from './day.schema';

// ============== DayOfWeek Enum (shared) ==============
export type { DayOfWeek } from './day.schema';

// ============== Client Program Schemas ==============

/**
 * Create a new program for a client.
 * POST /coach/clients/:clientId/programs
 */
export const CreateClientProgramSchema = z.object({
  params: z.object({
    clientId: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).default(''),
    notes: z.string().max(5000).optional(),
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
  }),
});

export type CreateClientProgramParams = z.infer<
  typeof CreateClientProgramSchema
>['params'];
export type CreateClientProgramInput = z.infer<
  typeof CreateClientProgramSchema
>['body'];

/**
 * Get the active program for a specific client.
 * GET /coach/clients/:clientId/program
 */
export const GetClientActiveProgramSchema = z.object({
  params: z.object({
    clientId: z.string().min(1),
  }),
});

export type GetClientActiveProgramParams = z.infer<
  typeof GetClientActiveProgramSchema
>['params'];

/**
 * Update program metadata (rename/notes).
 * PATCH /coach/programs/:programId
 */
export const UpdateClientProgramSchema = z.object({
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

export type UpdateClientProgramParams = z.infer<
  typeof UpdateClientProgramSchema
>['params'];
export type UpdateClientProgramInput = z.infer<
  typeof UpdateClientProgramSchema
>['body'];

/**
 * Soft-delete a program.
 * DELETE /coach/programs/:programId
 */
export const DeleteClientProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
});

export type DeleteClientProgramParams = z.infer<
  typeof DeleteClientProgramSchema
>['params'];

/**
 * Get program by ID.
 * GET /coach/programs/:programId
 */
export const GetProgramByIdSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
});

export type GetProgramByIdParams = z.infer<
  typeof GetProgramByIdSchema
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
 * Add a routine to a program — either from a template or inline.
 * POST /coach/programs/:programId/routines
 */
export const AddProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('template'),
      source_routine_id: z.string().cuid(),
      days_of_week: z.array(DayOfWeekSchema).min(1),
      order_in_program: z.number().int().min(0),
    }),
    z.object({
      mode: z.literal('inline'),
      name: z.string().min(1).max(200),
      description: z.string().max(5000).default(''),
      estimated_duration_minutes: z.number().int().min(1),
      days_of_week: z.array(DayOfWeekSchema).min(1),
      order_in_program: z.number().int().min(0),
      exercises: z.array(InlineExerciseSchema).optional().default([]),
    }),
  ]),
});

export type AddProgramRoutineParams = z.infer<
  typeof AddProgramRoutineSchema
>['params'];
export type AddProgramRoutineInput = z.infer<
  typeof AddProgramRoutineSchema
>['body'];

/**
 * Update a routine within a program.
 * PATCH /coach/programs/:programId/routines/:aprId
 */
export const UpdateProgramRoutineSchema = z.object({
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

export type UpdateProgramRoutineParams = z.infer<
  typeof UpdateProgramRoutineSchema
>['params'];
export type UpdateProgramRoutineInput = z.infer<
  typeof UpdateProgramRoutineSchema
>['body'];

/**
 * Soft-delete a routine from a program.
 * DELETE /coach/programs/:programId/routines/:aprId
 */
export const DeleteProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
  }),
});

export type DeleteProgramRoutineParams = z.infer<
  typeof DeleteProgramRoutineSchema
>['params'];

// ============== Program Routine Exercise Schemas ==============

/**
 * Add an exercise to a program routine.
 * POST /coach/programs/:programId/routines/:aprId/exercises
 */
export const AddProgramRoutineExerciseSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
  }),
  body: InlineExerciseSchema,
});

export type AddProgramRoutineExerciseParams = z.infer<
  typeof AddProgramRoutineExerciseSchema
>['params'];
export type AddProgramRoutineExerciseInput = z.infer<
  typeof AddProgramRoutineExerciseSchema
>['body'];

/**
 * Update an exercise within a program routine.
 * PATCH /coach/programs/:programId/routines/:aprId/exercises/:apreId
 */
export const UpdateProgramRoutineExerciseSchema = z.object({
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

export type UpdateProgramRoutineExerciseParams = z.infer<
  typeof UpdateProgramRoutineExerciseSchema
>['params'];
export type UpdateProgramRoutineExerciseInput = z.infer<
  typeof UpdateProgramRoutineExerciseSchema
>['body'];

/**
 * Delete an exercise from a program routine.
 * DELETE /coach/programs/:programId/routines/:aprId/exercises/:apreId
 */
export const DeleteProgramRoutineExerciseSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    aprId: z.string().cuid(),
    apreId: z.string().cuid(),
  }),
});

export type DeleteProgramRoutineExerciseParams = z.infer<
  typeof DeleteProgramRoutineExerciseSchema
>['params'];

// ============== Routine Template Schemas (Coach Library) ==============

export const CreateRoutineSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    estimated_duration_minutes: z.number().int().min(1),
  }),
});

export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>['body'];

export const GetCoachRoutinesSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetCoachRoutinesQuery = z.infer<
  typeof GetCoachRoutinesSchema
>['query'];

export const GetCoachRoutineByIdSchema = z.object({
  params: z.object({
    routineId: z.string().cuid(),
  }),
});

export type GetCoachRoutineByIdParams = z.infer<
  typeof GetCoachRoutineByIdSchema
>['params'];

export const UpdateRoutineSchema = z.object({
  params: z.object({
    routineId: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    estimated_duration_minutes: z.number().int().min(1).optional(),
  }),
});

export type UpdateRoutineParams = z.infer<typeof UpdateRoutineSchema>['params'];
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>['body'];

export const DeleteRoutineSchema = z.object({
  params: z.object({
    routineId: z.string().cuid(),
  }),
});

export type DeleteRoutineParams = z.infer<typeof DeleteRoutineSchema>['params'];
