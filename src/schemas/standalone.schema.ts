import { z } from 'zod';

// ============== Personal Exercise Schemas ==============

export const CreatePersonalExerciseSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Exercise name is required').max(100),
    description: z.string().min(1, 'Description is required').max(2000),
    primaryMuscleGroup: z.string().min(1, 'Primary muscle group is required'),
    targetMuscles: z.array(z.string()).optional().default([]),
    equipmentNeeded: z.array(z.string()).optional().default([]),
    isPublic: z.boolean().optional().default(false),
  }),
});

export type CreatePersonalExerciseInput = z.infer<
  typeof CreatePersonalExerciseSchema
>['body'];

export const GetPersonalExercisesSchema = z.object({
  query: z.object({
    muscleGroup: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetPersonalExercisesQuery = z.infer<
  typeof GetPersonalExercisesSchema
>['query'];

export const UpdatePersonalExerciseSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(2000).optional(),
    primaryMuscleGroup: z.string().min(1).optional(),
    targetMuscles: z.array(z.string()).optional(),
    equipmentNeeded: z.array(z.string()).optional(),
    isPublic: z.boolean().optional(),
  }),
});

export type UpdatePersonalExerciseParams = z.infer<
  typeof UpdatePersonalExerciseSchema
>['params'];
export type UpdatePersonalExerciseInput = z.infer<
  typeof UpdatePersonalExerciseSchema
>['body'];

export const DeletePersonalExerciseSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});

export type DeletePersonalExerciseParams = z.infer<
  typeof DeletePersonalExerciseSchema
>['params'];

// ============== Personal Routine Schemas ==============

export const CreatePersonalRoutineSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    estimatedDurationMinutes: z.number().int().min(1),
    muscleGroupsTargeted: z.array(z.string()).optional().default([]),
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
  params: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
  }),
});

export type GetPersonalRoutineByIdParams = z.infer<
  typeof GetPersonalRoutineByIdSchema
>['params'];

export const UpdatePersonalRoutineSchema = z.object({
  params: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    estimatedDurationMinutes: z.number().int().min(1).optional(),
    muscleGroupsTargeted: z.array(z.string()).optional(),
  }),
});

export type UpdatePersonalRoutineParams = z.infer<
  typeof UpdatePersonalRoutineSchema
>['params'];
export type UpdatePersonalRoutineInput = z.infer<
  typeof UpdatePersonalRoutineSchema
>['body'];

export const DeletePersonalRoutineSchema = z.object({
  params: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
  }),
});

export type DeletePersonalRoutineParams = z.infer<
  typeof DeletePersonalRoutineSchema
>['params'];

// ============== Routine Exercise Junction Schemas ==============

export const AddExerciseToRoutineSchema = z.object({
  params: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
  }),
  body: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
    sets: z.number().int().min(1),
    repsMin: z.number().int().min(1),
    repsMax: z.number().int().min(1),
    restSeconds: z.number().int().min(0),
    orderInRoutine: z.number().int().min(1),
    notes: z.string().optional(),
  }),
});

export type AddExerciseToRoutineParams = z.infer<
  typeof AddExerciseToRoutineSchema
>['params'];
export type AddExerciseToRoutineInput = z.infer<
  typeof AddExerciseToRoutineSchema
>['body'];

export const UpdateRoutineExerciseSchema = z.object({
  params: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
    routineExerciseId: z.string().min(1, 'Routine exercise ID is required'),
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
    routineId: z.string().min(1, 'Routine ID is required'),
    routineExerciseId: z.string().min(1, 'Routine exercise ID is required'),
  }),
});

export type RemoveRoutineExerciseParams = z.infer<
  typeof RemoveRoutineExerciseSchema
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
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
});

export type GetPersonalProgramByIdParams = z.infer<
  typeof GetPersonalProgramByIdSchema
>['params'];

export const UpdatePersonalProgramSchema = z.object({
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
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
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
});

export type DeletePersonalProgramParams = z.infer<
  typeof DeletePersonalProgramSchema
>['params'];

// ============== Program Routine Junction Schemas ==============

export const AssignRoutineToProgramSchema = z.object({
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
  body: z.object({
    routineId: z.string().min(1, 'Routine ID is required'),
    dayNumber: z.number().int().positive(),
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
    programId: z.string().min(1, 'Program ID is required'),
    programRoutineId: z.string().min(1, 'Program routine ID is required'),
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
    programId: z.string().min(1, 'Program ID is required'),
    programRoutineId: z.string().min(1, 'Program routine ID is required'),
  }),
});

export type RemoveProgramRoutineParams = z.infer<
  typeof RemoveProgramRoutineSchema
>['params'];

// ============== Self-Assignment Schemas ==============

export const ActivateProgramSchema = z.object({
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
  body: z.object({
    startDate: z.string().datetime().optional(),
  }),
});

export type ActivateProgramParams = z.infer<
  typeof ActivateProgramSchema
>['params'];
export type ActivateProgramInput = z.infer<
  typeof ActivateProgramSchema
>['body'];

export const DeactivateProgramSchema = z.object({
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
});

export type DeactivateProgramParams = z.infer<
  typeof DeactivateProgramSchema
>['params'];

// ============== Today's Workout Schema ==============

export const GetStandaloneTodaySchema = z.object({
  query: z.object({
    assignedProgramId: z.string().optional(),
  }),
});

export type GetStandaloneTodayQuery = z.infer<
  typeof GetStandaloneTodaySchema
>['query'];

// ============== Standalone Session Schemas ==============

export const StartStandaloneSessionSchema = z.object({
  body: z.object({
    assignedProgramId: z.string().optional(),
  }),
});

export type StartStandaloneSessionInput = z.infer<
  typeof StartStandaloneSessionSchema
>['body'];

export const CompleteStandaloneSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
  body: z.object({
    notes: z.string().max(1000).optional(),
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
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
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
