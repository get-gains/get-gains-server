import { z } from 'zod';
import { DayOfWeekSchema } from './day.schema';

// ─── Shared field schemas ────────────────────────────────────────────
const sexEnum = z.enum(['MALE', 'FEMALE']);
const experienceLevelEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

// ─── Multipart coercion helpers ─────────────────────────────────────
// Multer parses multipart/form-data and delivers all text fields as
// strings. These helpers coerce stringified values back to their
// expected types so Zod validation succeeds regardless of whether the
// request was sent as JSON or multipart/form-data.

/** Coerce a string to a number, pass through numbers, or return undefined. */
function toNumber(val: unknown): unknown {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  }
  return val;
}

/** Coerce "true"/"false" strings to booleans. */
function toBoolean(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}

/** Coerce a JSON-encoded string to an array, pass through arrays. */
function toArray(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : val;
    } catch {
      return val;
    }
  }
  return val;
}

/**
 * Normalise a date string that may lack timezone info.
 * Accepts full ISO-8601 (`2000-01-15T00:00:00.000Z`) or plain date
 * (`2000-01-15`) and normalises to a proper ISO datetime string.
 */
function toDatetime(val: unknown): unknown {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val !== 'string') return val;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T00:00:00.000Z`;
  if (
    val.includes('T') &&
    !val.endsWith('Z') &&
    !/[+-]\d{2}:\d{2}$/.test(val)
  ) {
    return `${val}Z`;
  }
  return val;
}

// ─── Create (Onboarding) ────────────────────────────────────────────
export const CreateUserProfileSchema = z.object({
  body: z.object({
    bio: z.string().max(2000).optional(),

    // Personal Data
    heightCm: z.preprocess(toNumber, z.number().positive().max(300).optional()),
    weightKg: z.preprocess(toNumber, z.number().positive().max(700).optional()),
    sex: sexEnum.optional(),
    dateOfBirth: z.preprocess(
      toDatetime,
      z.string().datetime({ offset: true }).optional()
    ),
    equipment: z.preprocess(
      toArray,
      z.array(z.string().max(100)).max(50).optional().default([])
    ),
    experienceLevel: experienceLevelEnum.optional(),
    injuryHistory: z.string().max(500).optional(),
    activeWeekdays: z.preprocess(
      toArray,
      z.array(DayOfWeekSchema).max(7).optional().default([])
    ),
  }),
});
export type CreateUserProfileInput = z.infer<
  typeof CreateUserProfileSchema
>['body'];

// ─── Update (Partial edit) ──────────────────────────────────────────
export const UpdateUserProfileSchema = z.object({
  body: z.object({
    bio: z.string().max(2000).optional(),
    removeAvatar: z.preprocess(toBoolean, z.boolean().optional()),

    // Personal Data
    heightCm: z.preprocess(toNumber, z.number().positive().max(300).optional()),
    weightKg: z.preprocess(toNumber, z.number().positive().max(700).optional()),
    sex: sexEnum.optional(),
    dateOfBirth: z.preprocess(
      toDatetime,
      z.string().datetime({ offset: true }).nullish()
    ),
    equipment: z.preprocess(
      toArray,
      z.array(z.string().max(100)).max(50).optional()
    ),
    experienceLevel: experienceLevelEnum.optional(),
    injuryHistory: z.string().max(500).nullish(),
    activeWeekdays: z.preprocess(
      toArray,
      z.array(DayOfWeekSchema).max(7).optional()
    ),
  }),
});
export type UpdateUserProfileInput = z.infer<
  typeof UpdateUserProfileSchema
>['body'];

// ─── Coach: Get client profile ──────────────────────────────────────
export const GetClientProfileSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID required'),
  }),
});
export type GetClientProfileParams = z.infer<
  typeof GetClientProfileSchema
>['params'];

// ─── Profile Stats ──────────────────────────────────────────────────
export const ProfileStatsQuerySchema = z.object({
  query: z
    .object({
      weekOf: z.string().datetime({ offset: true }).optional(),
    })
    .optional(),
});

export type ProfileStatsQuery = z.infer<
  typeof ProfileStatsQuerySchema
>['query'];
