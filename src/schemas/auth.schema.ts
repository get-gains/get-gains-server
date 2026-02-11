import { z } from 'zod';

const passwordRegex = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?`~]/;

/**
 * Schema for user registration
 */
export const RegisterSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters')
      .refine(
        (password) => /[A-Z]/.test(password),
        'Password must contain at least 1 capital letter'
      )
      .refine(
        (password) => passwordRegex.test(password),
        'Password must contain at least 1 special character'
      ),
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
    email: z.email(),
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

export const GoogleSignInSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'ID token is required'),
  }),
});

export type GoogleSignInInput = z.infer<typeof GoogleSignInSchema>['body'];

export const SendRecoveryEmailSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type SendRecoveryEmailInput = z.infer<
  typeof SendRecoveryEmailSchema
>['body'];

export const ResetPasswordSchema = z.object({
  body: z.object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters')
      .refine(
        (password) => /[A-Z]/.test(password),
        'Password must contain at least 1 capital letter'
      )
      .refine(
        (password) => passwordRegex.test(password),
        'Password must contain at least 1 special character'
      ),
  }),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>['body'];

/**
 * Schema for exchanging Supabase auth code for session
 */
export const ExchangeCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Auth code is required'),
  }),
});

export type ExchangeCodeInput = z.infer<typeof ExchangeCodeSchema>['body'];

/**
 * Schema for checking if a user's email has been verified
 */
export const CheckEmailVerifiedSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type CheckEmailVerifiedInput = z.infer<
  typeof CheckEmailVerifiedSchema
>['body'];
