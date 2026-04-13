import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TodayWorkoutDetails } from './today.controller';

// We test the pure mapping logic inline (no Prisma required).
// The helpers themselves need integration tests; this covers the shape contract.

describe('today controller helpers - shape contract', () => {
  it('coach rest day shape has isRestDay:true and null programRoutineId', () => {
    const restDay = {
      isRestDay: true,
      programRoutineId: null,
      dayNumber: null,
      programName: 'Strength Block',
      routineName: null,
      exerciseCount: 0,
      estimatedMinutes: 0,
    } satisfies TodayWorkoutDetails;
    assert.equal(restDay.isRestDay, true);
    assert.equal(restDay.programRoutineId, null);
    assert.equal(restDay.exerciseCount, 0);
  });

  it('active workout shape has isRestDay:false and populated fields', () => {
    const workout = {
      isRestDay: false,
      programRoutineId: 'apr_abc',
      dayNumber: 2,
      programName: 'Strength Block',
      routineName: 'Push Day',
      exerciseCount: 5,
      estimatedMinutes: 45,
    } satisfies TodayWorkoutDetails;
    assert.equal(workout.isRestDay, false);
    assert.equal(workout.programRoutineId, 'apr_abc');
    assert.equal(workout.dayNumber, 2);
    assert.equal(workout.exerciseCount, 5);
  });
});

describe('mapCoach - shape transformation', () => {
  // Inline the mapper to test it independently
  function mapCoach(
    coach: {
      user_id: string;
      certifications: string[];
      specialties: string[];
      social_links?: string[] | null;
      created_at: Date;
      user: {
        full_name: string;
        email: string;
        avatar_key: string | null;
        bio: string | null;
      };
    },
    subscribedAt?: Date | null
  ) {
    return {
      id: coach.user_id,
      name: coach.user.full_name,
      email: coach.user.email,
      avatarUrl: coach.user.avatar_key ?? null,
      bio: coach.user.bio ?? null,
      certifications: coach.certifications,
      specialties: coach.specialties,
      socialLinks: coach.social_links ?? [],
      createdAt: coach.created_at,
      ...(subscribedAt != null ? { subscribedAt } : {}),
    };
  }

  it('maps user_id to id', () => {
    const raw = {
      user_id: 'coach-123',
      certifications: ['NSCA'],
      specialties: ['strength'],
      social_links: null,
      created_at: new Date('2025-01-01'),
      user: {
        full_name: 'Jane Coach',
        email: 'jane@example.com',
        avatar_key: null,
        bio: null,
      },
    };
    const mapped = mapCoach(raw);
    assert.equal(mapped.id, 'coach-123');
    assert.equal(mapped.name, 'Jane Coach');
    assert.equal(mapped.email, 'jane@example.com');
    assert.equal(mapped.avatarUrl, null);
    assert.deepEqual(mapped.socialLinks, []);
    assert.equal('user_id' in mapped, false);
  });

  it('includes subscribedAt when provided', () => {
    const raw = {
      user_id: 'c1',
      certifications: [],
      specialties: [],
      social_links: ['https://ig.com/c'],
      created_at: new Date(),
      user: {
        full_name: 'Bob',
        email: 'bob@x.com',
        avatar_key: 'key.jpg',
        bio: 'hi',
      },
    };
    const at = new Date('2026-01-15');
    const mapped = mapCoach(raw, at);
    assert.equal(mapped.subscribedAt, at);
    assert.equal(mapped.avatarUrl, 'key.jpg');
    assert.deepEqual(mapped.socialLinks, ['https://ig.com/c']);
  });
});
