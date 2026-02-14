import { z } from 'zod';

// ─── Shared field schemas ────────────────────────────────────────────
const sexEnum = z.enum(['MALE', 'FEMALE']);
const experienceLevelEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

// ─── Create (Onboarding) ────────────────────────────────────────────
export const CreateUserProfileSchema = z.object({
  body: z.object({
    bio: z.string().max(2000).optional(),
    avatarUrl: z.string().url().optional(),

    // Personal Data
    heightCm: z.number().positive().max(300).optional(),
    weightKg: z.number().positive().max(700).optional(),
    unitPreference: z.string().max(20).optional(),
    sex: sexEnum.optional(),
    dateOfBirth: z.string().datetime({ offset: true }).optional(),
    equipment: z.array(z.string().max(100)).max(50).optional().default([]),
    injuryHistory: z.string().max(5000).optional(),
    experienceLevel: experienceLevelEnum.optional(),

    // Availability (required for onboarding)
    daysAvailable: z
      .number()
      .int()
      .min(1, 'Must be available at least 1 day')
      .max(7, 'Cannot exceed 7 days'),
    sessionDurationMinutes: z
      .number()
      .int()
      .min(10, 'Session must be at least 10 minutes')
      .max(300, 'Session cannot exceed 300 minutes'),
  }),
});
export type CreateUserProfileInput = z.infer<
  typeof CreateUserProfileSchema
>['body'];

// ─── Update (Partial edit) ──────────────────────────────────────────
export const UpdateUserProfileSchema = z.object({
  body: z
    .object({
      bio: z.string().max(2000).optional(),
      avatarUrl: z.string().url().nullish(),

      // Personal Data
      heightCm: z.number().positive().max(300).optional(),
      weightKg: z.number().positive().max(700).optional(),
      unitPreference: z.string().max(20).optional(),
      sex: sexEnum.optional(),
      dateOfBirth: z.string().datetime({ offset: true }).nullish(),
      equipment: z.array(z.string().max(100)).max(50).optional(),
      injuryHistory: z.string().max(5000).nullish(),
      experienceLevel: experienceLevelEnum.optional(),

      // Availability
      daysAvailable: z
        .number()
        .int()
        .min(1, 'Must be available at least 1 day')
        .max(7, 'Cannot exceed 7 days')
        .optional(),
      sessionDurationMinutes: z
        .number()
        .int()
        .min(10, 'Session must be at least 10 minutes')
        .max(300, 'Session cannot exceed 300 minutes')
        .optional(),
    })
    .strict(),
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
