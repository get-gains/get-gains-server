import { z } from 'zod';
import { DayOfWeekSchema } from './day.schema';

export type { DayOfWeek } from './day.schema';

// ============== Personal Exercise Schemas ==============

export const CreatePersonalExerciseSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
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
  params: z.object({ exerciseId: z.string().cuid() }),
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
  params: z.object({ exerciseId: z.string().cuid() }),
});

export type DeletePersonalExerciseParams = z.infer<
  typeof DeletePersonalExerciseSchema
>['params'];

// ============== Personal Routine Schemas ==============

export const CreatePersonalRoutineSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
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
  params: z.object({ routineId: z.string().cuid() }),
});

export type GetPersonalRoutineByIdParams = z.infer<
  typeof GetPersonalRoutineByIdSchema
>['params'];

export const UpdatePersonalRoutineSchema = z.object({
  params: z.object({ routineId: z.string().cuid() }),
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
  params: z.object({ routineId: z.string().cuid() }),
});

export type DeletePersonalRoutineParams = z.infer<
  typeof DeletePersonalRoutineSchema
>['params'];

// ============== Personal Program Schemas ==============

export const CreatePersonalProgramSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
});

export type CreatePersonalProgramInput = z.infer<
  typeof CreatePersonalProgramSchema
>['body'];

export const GetPersonalProgramsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetPersonalProgramsQuery = z.infer<
  typeof GetPersonalProgramsSchema
>['query'];

export const GetPersonalProgramByIdSchema = z.object({
  params: z.object({ programId: z.string().cuid() }),
});

export type GetPersonalProgramByIdParams = z.infer<
  typeof GetPersonalProgramByIdSchema
>['params'];

export const UpdatePersonalProgramSchema = z.object({
  params: z.object({ programId: z.string().cuid() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  }),
});

export type UpdatePersonalProgramParams = z.infer<
  typeof UpdatePersonalProgramSchema
>['params'];
export type UpdatePersonalProgramInput = z.infer<
  typeof UpdatePersonalProgramSchema
>['body'];

export const DeletePersonalProgramSchema = z.object({
  params: z.object({ programId: z.string().cuid() }),
});

export type DeletePersonalProgramParams = z.infer<
  typeof DeletePersonalProgramSchema
>['params'];

// ============== Standalone Assignment Schemas ==============

const StandaloneAssignmentExerciseSchema = z.object({
  exercise_id: z.string().cuid(),
  sets: z.number().int().min(1),
  reps_min: z.number().int().min(1),
  reps_max: z.number().int().min(1),
  rest_seconds: z.number().int().min(0),
  order_in_routine: z.number().int().min(1),
});

const StandaloneAssignmentRoutineSchema = z.object({
  source_routine_id: z.string().cuid().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  estimated_duration_minutes: z.number().int().min(1),
  order_in_program: z.number().int().min(1),
  days_of_week: z.array(DayOfWeekSchema).min(1),
  exercises: z.array(StandaloneAssignmentExerciseSchema).min(1),
});

export const CreateStandaloneAssignmentSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    notes: z.string().optional(),
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
    routines: z.array(StandaloneAssignmentRoutineSchema).min(1),
  }),
});

export type CreateStandaloneAssignmentInput = z.infer<
  typeof CreateStandaloneAssignmentSchema
>['body'];

export const GetStandaloneAssignmentsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetStandaloneAssignmentsQuery = z.infer<
  typeof GetStandaloneAssignmentsSchema
>['query'];

export const GetStandaloneAssignmentByIdSchema = z.object({
  params: z.object({
    assignedProgramId: z.string().cuid(),
  }),
});

export type GetStandaloneAssignmentByIdParams = z.infer<
  typeof GetStandaloneAssignmentByIdSchema
>['params'];

// ============== Today's Workout Schema ==============

export const GetStandaloneTodaySchema = z.object({
  query: z.object({}).optional(),
});

export type GetStandaloneTodayQuery = z.infer<
  typeof GetStandaloneTodaySchema
>['query'];

// ============== Standalone Session Schemas ==============

export const StartStandaloneSessionSchema = z.object({
  body: z.object({
    assigned_program_routine_id: z.string().cuid(),
  }),
});

export type StartStandaloneSessionInput = z.infer<
  typeof StartStandaloneSessionSchema
>['body'];

export const CompleteStandaloneSessionSchema = z.object({
  params: z.object({ sessionId: z.string().cuid() }),
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
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

export type GetStandaloneSessionsQuery = z.infer<
  typeof GetStandaloneSessionsSchema
>['query'];

export const GetStandaloneSessionByIdSchema = z.object({
  params: z.object({ sessionId: z.string().cuid() }),
});

export type GetStandaloneSessionByIdParams = z.infer<
  typeof GetStandaloneSessionByIdSchema
>['params'];

// ============== Weekly Stats Schema ==============

export const GetStandaloneWeeklyStatsSchema = z.object({
  query: z.object({
    weekOf: z.string().datetime().optional(),
  }),
});

export type GetStandaloneWeeklyStatsQuery = z.infer<
  typeof GetStandaloneWeeklyStatsSchema
>['query'];
