import { z } from 'zod';

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
    unitPreference: z.string().max(20).optional(),
    sex: sexEnum.optional(),
    dateOfBirth: z.preprocess(
      toDatetime,
      z.string().datetime({ offset: true }).optional()
    ),
    equipment: z.preprocess(
      toArray,
      z.array(z.string().max(100)).max(50).optional().default([])
    ),
    injuryHistory: z.string().max(5000).optional(),
    experienceLevel: experienceLevelEnum.optional(),

    // Availability (required for onboarding)
    daysAvailable: z.preprocess(
      toNumber,
      z
        .number()
        .int()
        .min(1, 'Must be available at least 1 day')
        .max(7, 'Cannot exceed 7 days')
    ),
    sessionDurationMinutes: z.preprocess(
      toNumber,
      z
        .number()
        .int()
        .min(10, 'Session must be at least 10 minutes')
        .max(300, 'Session cannot exceed 300 minutes')
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
    unitPreference: z.string().max(20).optional(),
    sex: sexEnum.optional(),
    dateOfBirth: z.preprocess(
      toDatetime,
      z.string().datetime({ offset: true }).nullish()
    ),
    equipment: z.preprocess(
      toArray,
      z.array(z.string().max(100)).max(50).optional()
    ),
    injuryHistory: z.string().max(5000).nullish(),
    experienceLevel: experienceLevelEnum.optional(),

    // Availability
    daysAvailable: z.preprocess(
      toNumber,
      z
        .number()
        .int()
        .min(1, 'Must be available at least 1 day')
        .max(7, 'Cannot exceed 7 days')
        .optional()
    ),
    sessionDurationMinutes: z.preprocess(
      toNumber,
      z
        .number()
        .int()
        .min(10, 'Session must be at least 10 minutes')
        .max(300, 'Session cannot exceed 300 minutes')
        .optional()
    ),
  }),
});
export type UpdateUserProfileInput = z.infer<
  typeof UpdateUserProfileSchema
>['body'];

// ─── Coach: Get client profile ──────────────────────────────────────
export const GetClientProfileSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
});
export type GetClientProfileParams = z.infer<
  typeof GetClientProfileSchema
>['params'];
