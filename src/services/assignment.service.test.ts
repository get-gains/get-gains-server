import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

// Import the internal function — bypasses prisma module dependency
import { _buildAssignmentTx } from './assignment.service';

type MockTx = {
  assigned_program: {
    create: ReturnType<typeof mock.fn>;
    findUniqueOrThrow: ReturnType<typeof mock.fn>;
  };
  assigned_program_routine: { create: ReturnType<typeof mock.fn> };
  assigned_program_routine_exercise: { create: ReturnType<typeof mock.fn> };
};

function makeMockTx(): MockTx {
  return {
    assigned_program: {
      create: mock.fn(async () => ({
        id: 'ap1',
        user_id: 'u1',
        coach_id: 'c1',
        name: 'Test Program',
        description: 'A test program',
        notes: null,
        is_active: true,
        start_date: null,
        end_date: null,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      findUniqueOrThrow: mock.fn(async () => ({
        id: 'ap1',
        user_id: 'u1',
        coach_id: 'c1',
        name: 'Test Program',
        description: 'A test program',
        notes: null,
        is_active: true,
        start_date: null,
        end_date: null,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        assigned_program_routines: [
          {
            id: 'apr1',
            source_routine_id: null,
            name: 'Push Day',
            description: 'Chest + Triceps',
            estimated_duration_minutes: 60,
            order_in_program: 1,
            assigned_program_id: 'ap1',
            days_of_week: ['MONDAY'],
            deleted_at: null,
            created_at: new Date(),
            updated_at: new Date(),
            assigned_program_routine_exercises: [
              {
                id: 'apre1',
                assigned_program_routine_id: 'apr1',
                exercise_id: 'e1',
                sets: 3,
                reps_min: 8,
                reps_max: 12,
                rest_seconds: 60,
                order_in_routine: 1,
                deleted_at: null,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          },
        ],
      })),
    },
    assigned_program_routine: {
      create: mock.fn(async () => ({ id: 'apr1' })),
    },
    assigned_program_routine_exercise: {
      create: mock.fn(async () => ({ id: 'apre1' })),
    },
  };
}

describe('_buildAssignmentTx', () => {
  it('creates assigned_program, one routine, one exercise', async () => {
    const tx = makeMockTx();
    const result = await _buildAssignmentTx(
      tx as unknown as Prisma.TransactionClient,
      {
        user_id: 'u1',
        coach_id: 'c1',
        name: 'Test Program',
        description: 'A test program',
        routines: [
          {
            name: 'Push Day',
            description: 'Chest + Triceps',
            estimated_duration_minutes: 60,
            order_in_program: 1,
            days_of_week: ['MONDAY'],
            exercises: [
              {
                exercise_id: 'e1',
                sets: 3,
                reps_min: 8,
                reps_max: 12,
                rest_seconds: 60,
                order_in_routine: 1,
              },
            ],
          },
        ],
      }
    );

    assert.equal(tx.assigned_program.create.mock.calls.length, 1);
    assert.deepEqual(tx.assigned_program.create.mock.calls[0].arguments[0], {
      data: {
        user_id: 'u1',
        coach_id: 'c1',
        name: 'Test Program',
        description: 'A test program',
        notes: undefined,
        start_date: undefined,
        end_date: undefined,
      },
    });
    assert.equal(tx.assigned_program_routine.create.mock.calls.length, 1);
    assert.equal(
      tx.assigned_program_routine_exercise.create.mock.calls.length,
      1
    );
    assert.equal(result.id, 'ap1');
  });

  it('creates multiple routines and exercises', async () => {
    const tx = makeMockTx();
    await _buildAssignmentTx(tx as unknown as Prisma.TransactionClient, {
      user_id: 'u1',
      coach_id: 'c1',
      name: 'Full Split',
      description: 'PPL split',
      routines: [
        {
          name: 'Push Day',
          description: 'Chest + Triceps',
          estimated_duration_minutes: 60,
          order_in_program: 1,
          days_of_week: ['MONDAY', 'WEDNESDAY'],
          exercises: [
            {
              exercise_id: 'e1',
              sets: 3,
              reps_min: 8,
              reps_max: 12,
              rest_seconds: 60,
              order_in_routine: 1,
            },
            {
              exercise_id: 'e2',
              sets: 4,
              reps_min: 6,
              reps_max: 10,
              rest_seconds: 90,
              order_in_routine: 2,
            },
          ],
        },
        {
          name: 'Leg Day',
          description: 'Quads + Hamstrings',
          estimated_duration_minutes: 45,
          order_in_program: 2,
          days_of_week: ['FRIDAY'],
          exercises: [
            {
              exercise_id: 'e3',
              sets: 3,
              reps_min: 10,
              reps_max: 15,
              rest_seconds: 45,
              order_in_routine: 1,
            },
          ],
        },
      ],
    });

    assert.equal(tx.assigned_program_routine.create.mock.calls.length, 2);
    assert.equal(
      tx.assigned_program_routine_exercise.create.mock.calls.length,
      3
    );
  });
});
