import { z } from 'zod';

// ============== Program Schemas ==============

export const CreateProgramSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    customForUserId: z.string().cuid().optional(),
  }),
});

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>['body'];

export const GetCoachProgramsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    // When true, includes custom (one-off) programs; default false (reusable library only)
    includeCustom: z.coerce.boolean().optional().default(false),
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
    estimatedDurationMinutes: z.number().int().min(1),
    muscleGroupsTargeted: z.array(z.string()).optional().default([]),
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
    estimatedDurationMinutes: z.number().int().min(1).optional(),
    muscleGroupsTargeted: z.array(z.string()).optional(),
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

// ============== ProgramRoutine Junction Schemas ==============

export const AssignRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.object({
    routineId: z.string().cuid(),
    dayNumber: z.number().int().positive(),
  }),
});

export const UpdateProgramRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
    programRoutineId: z.string().cuid(),
  }),
  body: z.object({
    dayNumber: z.number().int().positive(),
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

// ============== RoutineExercise Schemas ==============

export const addRoutineExerciseSchema = z.object({
  params: z.object({
    routineId: z.string().cuid(),
  }),
  body: z.object({
    exerciseId: z.string().cuid(),
    sets: z.number().int().min(1),
    repsMin: z.number().int().min(1),
    repsMax: z.number().int().min(1),
    restSeconds: z.number().int().min(0),
    orderInRoutine: z.number().int().min(1),
    notes: z.string().nullable().optional(),
  }),
});

export type AddRoutineExerciseParams = z.infer<
  typeof addRoutineExerciseSchema
>['params'];
export type AddRoutineExerciseInput = z.infer<
  typeof addRoutineExerciseSchema
>['body'];

export const UpdateRoutineExerciseSchema = z.object({
  params: z.object({
    routineId: z.string().cuid(),
    routineExerciseId: z.string().cuid(),
  }),
  body: z.object({
    sets: z.number().int().min(1).optional(),
    repsMin: z.number().int().min(1).optional(),
    repsMax: z.number().int().min(1).optional(),
    restSeconds: z.number().int().min(0).optional(),
    orderInRoutine: z.number().int().min(1).optional(),
    notes: z.string().nullable().optional(),
  }),
});

export type UpdateRoutineExerciseParams = z.infer<
  typeof UpdateRoutineExerciseSchema
>['params'];
export type UpdateRoutineExerciseInput = z.infer<
  typeof UpdateRoutineExerciseSchema
>['body'];

export const RemoveRoutineExerciseSchema = z.object({
  params: z.object({
    routineId: z.string().cuid(),
    routineExerciseId: z.string().cuid(),
  }),
});

export type RemoveRoutineExerciseParams = z.infer<
  typeof RemoveRoutineExerciseSchema
>['params'];
