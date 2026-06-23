import { z } from 'zod';

// ============== Personal Exercise Schemas (shared `exercise` table) ==============

export const CreatePersonalExerciseSchema = z.object({
  body: z.object({
    id: z.string().cuid2().optional(),
    name: z.string().min(1),
    description: z.string().optional().default(''),
    target_muscles: z.array(z.string()).optional().default([]),
    is_public: z.boolean().optional().default(false),
  }),
});

export type CreatePersonalExerciseInput = z.infer<
  typeof CreatePersonalExerciseSchema
>['body'];

export const GetPersonalExercisesSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    search: z.string().optional(),
  }),
});

export type GetPersonalExercisesQuery = z.infer<
  typeof GetPersonalExercisesSchema
>['query'];

export const UpdatePersonalExerciseSchema = z.object({
  params: z.object({ exerciseId: z.string().cuid2() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    target_muscles: z.array(z.string()).optional(),
    is_public: z.boolean().optional(),
  }),
});

export type UpdatePersonalExerciseParams = z.infer<
  typeof UpdatePersonalExerciseSchema
>['params'];
export type UpdatePersonalExerciseInput = z.infer<
  typeof UpdatePersonalExerciseSchema
>['body'];

export const DeletePersonalExerciseSchema = z.object({
  params: z.object({ exerciseId: z.string().cuid2() }),
});

export type DeletePersonalExerciseParams = z.infer<
  typeof DeletePersonalExerciseSchema
>['params'];

// ============== Personal Routine Schemas (shared `routine` table) ==============

export const CreatePersonalRoutineSchema = z.object({
  body: z.object({
    id: z.string().cuid2().optional(),
    name: z.string().min(1),
    description: z.string().optional().default(''),
    estimated_duration_minutes: z.number().int().min(1),
  }),
});

export type CreatePersonalRoutineInput = z.infer<
  typeof CreatePersonalRoutineSchema
>['body'];

export const GetPersonalRoutinesSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetPersonalRoutinesQuery = z.infer<
  typeof GetPersonalRoutinesSchema
>['query'];

export const GetPersonalRoutineByIdSchema = z.object({
  params: z.object({ routineId: z.string().cuid2() }),
});

export type GetPersonalRoutineByIdParams = z.infer<
  typeof GetPersonalRoutineByIdSchema
>['params'];

export const UpdatePersonalRoutineSchema = z.object({
  params: z.object({ routineId: z.string().cuid2() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    estimated_duration_minutes: z.number().int().min(1).optional(),
  }),
});

export type UpdatePersonalRoutineParams = z.infer<
  typeof UpdatePersonalRoutineSchema
>['params'];
export type UpdatePersonalRoutineInput = z.infer<
  typeof UpdatePersonalRoutineSchema
>['body'];

export const DeletePersonalRoutineSchema = z.object({
  params: z.object({ routineId: z.string().cuid2() }),
});

export type DeletePersonalRoutineParams = z.infer<
  typeof DeletePersonalRoutineSchema
>['params'];

// ============== Standalone Program Schemas ==============

export const CreateStandaloneProgramSchema = z.object({
  body: z.object({
    id: z.string().cuid2().optional(),
    name: z.string().min(1),
    description: z.string().optional().default(''),
  }),
});

export type CreateStandaloneProgramInput = z.infer<
  typeof CreateStandaloneProgramSchema
>['body'];

export const GetStandaloneProgramsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetStandaloneProgramsQuery = z.infer<
  typeof GetStandaloneProgramsSchema
>['query'];

export const GetStandaloneProgramByIdSchema = z.object({
  params: z.object({ programId: z.string().cuid2() }),
});

export type GetStandaloneProgramByIdParams = z.infer<
  typeof GetStandaloneProgramByIdSchema
>['params'];

export const UpdateStandaloneProgramSchema = z.object({
  params: z.object({ programId: z.string().cuid2() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  }),
});

export type UpdateStandaloneProgramParams = z.infer<
  typeof UpdateStandaloneProgramSchema
>['params'];
export type UpdateStandaloneProgramInput = z.infer<
  typeof UpdateStandaloneProgramSchema
>['body'];

export const DeleteStandaloneProgramSchema = z.object({
  params: z.object({ programId: z.string().cuid2() }),
});

export type DeleteStandaloneProgramParams = z.infer<
  typeof DeleteStandaloneProgramSchema
>['params'];

// ============== Program Routine Schemas ==============

export const AddStandaloneProgramRoutineSchema = z.object({
  params: z.object({ programId: z.string().cuid2() }),
  body: z.object({
    id: z.string().cuid2().optional(),
    routine_id: z.string().cuid2(),
    order_in_program: z.number().int().min(1),
  }),
});

export type AddStandaloneProgramRoutineInput = z.infer<
  typeof AddStandaloneProgramRoutineSchema
>['body'];
export type AddStandaloneProgramRoutineParams = z.infer<
  typeof AddStandaloneProgramRoutineSchema
>['params'];

export const UpdateStandaloneProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid2(),
    programRoutineId: z.string().cuid2(),
  }),
  body: z.object({
    order_in_program: z.number().int().min(1),
  }),
});

export type UpdateStandaloneProgramRoutineParams = z.infer<
  typeof UpdateStandaloneProgramRoutineSchema
>['params'];
export type UpdateStandaloneProgramRoutineInput = z.infer<
  typeof UpdateStandaloneProgramRoutineSchema
>['body'];

export const DeleteStandaloneProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid2(),
    programRoutineId: z.string().cuid2(),
  }),
});

export type DeleteStandaloneProgramRoutineParams = z.infer<
  typeof DeleteStandaloneProgramRoutineSchema
>['params'];

// ============== Routine Exercise Schemas ==============

export const AddStandaloneRoutineExerciseSchema = z.object({
  params: z.object({ routineId: z.string().cuid2() }),
  body: z.object({
    id: z.string().cuid2().optional(),
    exercise_id: z.string().cuid2(),
    sets: z.number().int().min(1),
    reps_min: z.number().int().min(1),
    reps_max: z.number().int().min(1),
    rest_seconds: z.number().int().min(0),
    order_in_routine: z.number().int().min(1),
  }),
});

export type AddStandaloneRoutineExerciseInput = z.infer<
  typeof AddStandaloneRoutineExerciseSchema
>['body'];
export type AddStandaloneRoutineExerciseParams = z.infer<
  typeof AddStandaloneRoutineExerciseSchema
>['params'];

export const UpdateStandaloneRoutineExerciseSchema = z.object({
  params: z.object({
    routineId: z.string().cuid2(),
    routineExerciseId: z.string().cuid2(),
  }),
  body: z.object({
    sets: z.number().int().min(1).optional(),
    reps_min: z.number().int().min(1).optional(),
    reps_max: z.number().int().min(1).optional(),
    rest_seconds: z.number().int().min(0).optional(),
    order_in_routine: z.number().int().min(1).optional(),
  }),
});

export type UpdateStandaloneRoutineExerciseParams = z.infer<
  typeof UpdateStandaloneRoutineExerciseSchema
>['params'];
export type UpdateStandaloneRoutineExerciseInput = z.infer<
  typeof UpdateStandaloneRoutineExerciseSchema
>['body'];

export const DeleteStandaloneRoutineExerciseSchema = z.object({
  params: z.object({
    routineId: z.string().cuid2(),
    routineExerciseId: z.string().cuid2(),
  }),
});

export type DeleteStandaloneRoutineExerciseParams = z.infer<
  typeof DeleteStandaloneRoutineExerciseSchema
>['params'];

// ============== Program Builder (bulk creation) Schema ==============

const BuilderExerciseSchema = z.object({
  exercise_id: z.string().cuid2(),
  sets: z.number().int().min(1),
  reps_min: z.number().int().min(1),
  reps_max: z.number().int().min(1),
  rest_seconds: z.number().int().min(0),
  order_in_routine: z.number().int().min(1),
});

const BuilderRoutineSchema = z.object({
  routine_id: z.string().cuid2(),
  order_in_program: z.number().int().min(1),
  exercises: z.array(BuilderExerciseSchema).min(1),
});

export const BuildStandaloneProgramSchema = z.object({
  body: z.object({
    id: z.string().cuid2().optional(),
    name: z.string().min(1),
    description: z.string().min(1),
    routines: z.array(BuilderRoutineSchema).min(1),
  }),
});

export type BuildStandaloneProgramInput = z.infer<
  typeof BuildStandaloneProgramSchema
>['body'];

// ============== Activate / Deactivate ==============

export const ActivateStandaloneProgramSchema = z.object({
  params: z.object({ programId: z.string().cuid2() }),
});

export type ActivateStandaloneProgramParams = z.infer<
  typeof ActivateStandaloneProgramSchema
>['params'];

// ============== Session Schemas ==============

export const StartStandaloneSessionSchema = z.object({
  body: z.object({
    id: z.string().cuid2().optional(),
    program_routine_id: z.string().cuid2(),
  }),
});

export type StartStandaloneSessionInput = z.infer<
  typeof StartStandaloneSessionSchema
>['body'];

export const CompleteStandaloneSessionSchema = z.object({
  params: z.object({ sessionId: z.string().cuid2() }),
  body: z.object({
    feedback: z.string().optional(),
  }),
});

export type CompleteStandaloneSessionParams = z.infer<
  typeof CompleteStandaloneSessionSchema
>['params'];
export type CompleteStandaloneSessionInput = z.infer<
  typeof CompleteStandaloneSessionSchema
>['body'];

export const GetStandaloneSessionsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetStandaloneSessionsQuery = z.infer<
  typeof GetStandaloneSessionsSchema
>['query'];

export const GetStandaloneSessionByIdSchema = z.object({
  params: z.object({ sessionId: z.string().cuid2() }),
});

export type GetStandaloneSessionByIdParams = z.infer<
  typeof GetStandaloneSessionByIdSchema
>['params'];

// ============== Performed Set Schemas ==============

export const LogStandaloneSetSchema = z.object({
  params: z.object({ sessionId: z.string().cuid2() }),
  body: z.object({
    id: z.string().cuid2().optional(),
    routine_exercise_id: z.string().cuid2(),
    set_number: z.number().int().min(1),
    reps: z.number().int().min(0),
    weight: z.number().min(0),
  }),
});

export type LogStandaloneSetInput = z.infer<
  typeof LogStandaloneSetSchema
>['body'];
export type LogStandaloneSetParams = z.infer<
  typeof LogStandaloneSetSchema
>['params'];

export const UpdateStandaloneSetSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid2(),
    setId: z.string().cuid2(),
  }),
  body: z.object({
    reps: z.number().int().min(0).optional(),
    weight: z.number().min(0).optional(),
  }),
});

export type UpdateStandaloneSetParams = z.infer<
  typeof UpdateStandaloneSetSchema
>['params'];
export type UpdateStandaloneSetInput = z.infer<
  typeof UpdateStandaloneSetSchema
>['body'];

export const DeleteStandaloneSetSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid2(),
    setId: z.string().cuid2(),
  }),
});

export type DeleteStandaloneSetParams = z.infer<
  typeof DeleteStandaloneSetSchema
>['params'];

// ============== Stats Schemas ==============

export const GetStandaloneStatsSchema = z.object({
  query: z.object({}).optional(),
});

export type GetStandaloneStatsQuery = z.infer<
  typeof GetStandaloneStatsSchema
>['query'];

export const GetStandaloneExerciseStatSchema = z.object({
  params: z.object({ exerciseId: z.string().cuid2() }),
});

export type GetStandaloneExerciseStatParams = z.infer<
  typeof GetStandaloneExerciseStatSchema
>['params'];
