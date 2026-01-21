import { z } from 'zod';

/**
 * Schema for user registration
 */
export const RegisterSchema = z.object({
  body: z.object({
    email: z.email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters'),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters'),
    nickname: z
      .string()
      .min(1, 'Nickname is required')
      .max(50, 'Nickname must be less than 50 characters'),
  }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>['body'];

/**
 * Schema for user login
 */
export const LoginSchema = z.object({
  body: z.object({
    email: z.email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export type LoginInput = z.infer<typeof LoginSchema>['body'];

/**
 * Schema for refresh token request
 */
export const RefreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>['body'];
