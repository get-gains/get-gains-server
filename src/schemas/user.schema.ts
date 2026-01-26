import { z } from 'zod';

/**
 * Schema for user creation
 */
export const CreateUserSchema = z.object({
  body: z.object({
    email: z.email(),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters'),
    nickname: z
      .string()
      .min(1, 'Nickname is required')
      .max(50, 'Nickname must be less than 50 characters'),
    supabaseId: z.string().min(1, 'Supabase ID is required'),
  }),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>['body'];

export const CreateUserFromGoogleSchema = z.object({
  body: z.object({
    email: z.email(),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters'),
    nickname: z
      .string()
      .min(1, 'Nickname is required')
      .max(50, 'Nickname must be less than 50 characters'),
    supabaseId: z.string().min(1, 'Supabase ID is required'),
  }),
});

export type CreateUserFromGoogleData = z.infer<
  typeof CreateUserFromGoogleSchema
>['body'];
