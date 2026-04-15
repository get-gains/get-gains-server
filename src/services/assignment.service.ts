import prisma from '../config/database';
import { logger } from '../utils/logger';
import type { assigned_program, Prisma } from '@prisma/client';

export interface AssignmentExerciseInput {
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  order_in_routine: number;
}

export interface AssignmentRoutineInput {
  routine_id: string;
  days_of_week: string[];
  exercises: AssignmentExerciseInput[];
}

export interface CreateAssignmentInput {
  user_id: string;
  program_id: string;
  notes?: string;
  start_date?: Date;
  end_date?: Date;
  routines: AssignmentRoutineInput[];
}

type AssignmentWithTree = assigned_program & {
  assigned_program_routines: Array<{
    id: string;
    routine_id: string;
    assigned_program_id: string;
    days_of_week: string[];
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
    assigned_program_routine_exercises: Array<{
      id: string;
      assigned_program_routine_id: string;
      exercise_id: string;
      sets: number;
      reps_min: number;
      reps_max: number;
      rest_seconds: number;
      order_in_routine: number;
      deleted_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>;
  }>;
};

/** @internal Exported for unit testing only. Use createAssignment in production code. */
export async function _buildAssignmentTx(
  tx: Prisma.TransactionClient,
  data: CreateAssignmentInput
): Promise<AssignmentWithTree> {
  const assignment = await tx.assigned_program.create({
    data: {
      user_id: data.user_id,
      program_id: data.program_id,
      notes: data.notes,
      start_date: data.start_date,
      end_date: data.end_date,
    },
  });

  for (const routine of data.routines) {
    const apr = await tx.assigned_program_routine.create({
      data: {
        assigned_program_id: assignment.id,
        routine_id: routine.routine_id,
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
        orderBy: { created_at: 'asc' },
      },
    },
  });
}

export async function createAssignment(
  data: CreateAssignmentInput
): Promise<AssignmentWithTree> {
  logger.debug('Creating assignment snapshot', {
    user_id: data.user_id,
    program_id: data.program_id,
    routine_count: data.routines.length,
  });
  return prisma.$transaction((tx) => _buildAssignmentTx(tx, data));
}
