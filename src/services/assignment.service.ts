import prisma from '../config/database';
import { logger } from '../utils/logger';
import type { Prisma } from '@prisma/client';

export interface AssignmentExerciseInput {
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  order_in_routine: number;
}

export interface AssignmentRoutineInput {
  /** Optional: copy metadata from this template routine */
  source_routine_id?: string;
  name: string;
  description: string;
  estimated_duration_minutes: number;
  order_in_program: number;
  days_of_week: string[];
  exercises: AssignmentExerciseInput[];
}

export interface CreateAssignmentInput {
  user_id: string;
  coach_id: string;
  name: string;
  description: string;
  notes?: string;
  start_date?: Date;
  end_date?: Date;
  routines: AssignmentRoutineInput[];
}

/**
 * Build a full client-program assignment inside a transaction.
 * Creates the assigned_program, its routines, and their exercises.
 * @param tx - Prisma transaction client
 * @param data - All data needed to build the assignment tree
 * @returns The created assignment with full tree included
 * @internal Exported for unit testing only. Use createAssignment in production code.
 */
export async function _buildAssignmentTx(
  tx: Prisma.TransactionClient,
  data: CreateAssignmentInput
) {
  const assignment = await tx.assigned_program.create({
    data: {
      user_id: data.user_id,
      coach_id: data.coach_id,
      name: data.name,
      description: data.description,
      notes: data.notes,
      start_date: data.start_date,
      end_date: data.end_date,
    },
  });

  for (const routine of data.routines) {
    const apr = await tx.assigned_program_routine.create({
      data: {
        assigned_program_id: assignment.id,
        source_routine_id: routine.source_routine_id ?? null,
        name: routine.name,
        description: routine.description,
        estimated_duration_minutes: routine.estimated_duration_minutes,
        order_in_program: routine.order_in_program,
        days_of_week: routine.days_of_week,
      },
    });

    for (const exercise of routine.exercises) {
      await tx.assigned_program_routine_exercise.create({
        data: {
          assigned_program_routine_id: apr.id,
          exercise_id: exercise.exercise_id,
          sets: exercise.sets,
          reps_min: exercise.reps_min,
          reps_max: exercise.reps_max,
          rest_seconds: exercise.rest_seconds,
          order_in_routine: exercise.order_in_routine,
        },
      });
    }
  }

  return tx.assigned_program.findUniqueOrThrow({
    where: { id: assignment.id },
    include: {
      assigned_program_routines: {
        include: { assigned_program_routine_exercises: true },
        orderBy: { order_in_program: 'asc' },
      },
    },
  });
}

/**
 * Create a full client-program assignment with all routines and exercises.
 * Wraps _buildAssignmentTx in a Prisma transaction.
 * @param data - All data needed to build the assignment tree
 * @returns The created assignment with full tree
 */
export async function createAssignment(data: CreateAssignmentInput) {
  logger.debug('Creating assignment', {
    user_id: data.user_id,
    coach_id: data.coach_id,
    routine_count: data.routines.length,
  });
  return prisma.$transaction((tx) => _buildAssignmentTx(tx, data));
}
