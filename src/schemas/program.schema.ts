import { z } from 'zod';

/**
 * Create Program
 */
export const CreateProgramSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
});

/**
 * Assign Routine to Program
 */
export const AssignRoutineSchema = z.object({
  params: z.object({
    programId: z.string().cuid(),
  }),
  body: z.object({
    routineId: z.string().cuid(),
    dayNumber: z.number().int().positive(),
  }),
});

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
    notes: z.string().optional(),
  }),
});

export {};
