import { z } from 'zod';
import { DAY_NAMES } from '../utils/days';

// ============== DayOfWeek Enum (shared) ==============

const DayOfWeek = z.enum(DAY_NAMES);

export type DayOfWeek = z.infer<typeof DayOfWeek>;

// ============== Program Schemas ==============

export const CreateProgramSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
});

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>['body'];

export const GetCoachProgramsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetCoachProgramsQuery = z.infer<
  typeof GetCoachProgramsSchema
>['query'];

export const GetCoachProgramByIdSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
});

export type GetCoachProgramByIdParams = z.infer<
  typeof GetCoachProgramByIdSchema
>['params'];

export const UpdateProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  }),
});

export type UpdateProgramParams = z.infer<typeof UpdateProgramSchema>['params'];
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>['body'];

export const DeleteProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
});

export type DeleteProgramParams = z.infer<typeof DeleteProgramSchema>['params'];

// ============== Routine Schemas ==============

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

// ============== ProgramRoutine Schemas ==============

export const AssignRoutineToProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.object({
    routine_id: z.string().cuid(),
    day_of_week: DayOfWeek,
  }),
});

export type AssignRoutineToProgramParams = z.infer<
  typeof AssignRoutineToProgramSchema
>['params'];
export type AssignRoutineToProgramInput = z.infer<
  typeof AssignRoutineToProgramSchema
>['body'];

export const UpdateProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    programRoutineId: z.string().cuid(),
  }),
  body: z.object({
    day_of_week: DayOfWeek,
  }),
});

export type UpdateProgramRoutineParams = z.infer<
  typeof UpdateProgramRoutineSchema
>['params'];
export type UpdateProgramRoutineInput = z.infer<
  typeof UpdateProgramRoutineSchema
>['body'];

export const RemoveProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    programRoutineId: z.string().cuid(),
  }),
});

export type RemoveProgramRoutineParams = z.infer<
  typeof RemoveProgramRoutineSchema
>['params'];

// ============== Assignment Schema ==============

const AssignmentExerciseSchema = z.object({
  exercise_id: z.string().cuid(),
  sets: z.number().int().min(1),
  reps_min: z.number().int().min(1),
  reps_max: z.number().int().min(1),
  rest_seconds: z.number().int().min(0),
  order_in_routine: z.number().int().min(1),
});

const AssignmentRoutineSchema = z.object({
  routine_id: z.string().cuid(),
  days_of_week: z.array(DayOfWeek).min(1),
  exercises: z.array(AssignmentExerciseSchema).min(1),
});

export const AssignProgramSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.object({
    user_id: z.string(),
    notes: z.string().optional(),
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
    routines: z.array(AssignmentRoutineSchema).min(1),
  }),
});

export type AssignProgramParams = z.infer<typeof AssignProgramSchema>['params'];
export type AssignProgramInput = z.infer<typeof AssignProgramSchema>['body'];
