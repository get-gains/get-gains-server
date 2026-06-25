import { z } from 'zod';

/**
 * Schema for user creation
 */
export const CreateUserSchema = z.object({
  body: z.object({
    email: z.email(),
    full_name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters'),
    nickname: z
      .string()
      .min(1, 'Nickname is required')
      .max(50, 'Nickname must be less than 50 characters'),
    supabase_auth_id: z.string().min(1, 'Supabase ID is required'),
  }),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>['body'];

export const CreateUserFromGoogleSchema = z.object({
  body: z.object({
    email: z.email(),
    full_name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters'),
    nickname: z
      .string()
      .min(1, 'Nickname is required')
      .max(50, 'Nickname must be less than 50 characters'),
    supabase_auth_id: z.string().min(1, 'Supabase ID is required'),
  }),
});

export type CreateUserFromGoogleData = z.infer<
  typeof CreateUserFromGoogleSchema
>['body'];

/**
 * Schema for discovering/searching coaches
 */
export const DiscoverCoachesSchema = z.object({
  query: z.object({
    search: z.string().optional(), // Search by name, bio, specialties
    specialty: z.string().optional(), // Filter by specialty (case-insensitive)
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type DiscoverCoachesQuery = z.infer<
  typeof DiscoverCoachesSchema
>['query'];

/**
 * Schema for getting user's subscribed coaches
 */
export const GetSubscribedCoachesSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetSubscribedCoachesQuery = z.infer<
  typeof GetSubscribedCoachesSchema
>['query'];

/**
 * Schema for subscribing to a coach
 */
export const SubscribeCoachSchema = z.object({
  params: z.object({
    coachId: z.string().min(1, 'Coach ID required'),
  }),
});

export type SubscribeCoachParams = z.infer<
  typeof SubscribeCoachSchema
>['params'];

/**
 * Schema for viewing a single coach's public profile
 */
export const GetCoachProfileSchema = z.object({
  params: z.object({
    coachId: z.string().min(1, 'Coach ID required'),
  }),
});

export type GetCoachProfileParams = z.infer<
  typeof GetCoachProfileSchema
>['params'];

/**
 * Schema for unsubscribing from a coach
 */
export const UnsubscribeCoachSchema = z.object({
  params: z.object({
    coachId: z.string().min(1, 'Coach ID required'),
  }),
});

export type UnsubscribeCoachParams = z.infer<
  typeof UnsubscribeCoachSchema
>['params'];

/**
 * Schema for updating user profile (Flutter app contract: PATCH /users/profile)
 */
export const UpdateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      nickname: z.string().min(1).max(50).optional(),
    })
    .strict(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>['body'];
