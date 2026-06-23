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

/**
 * Schema for sending password reset OTP
 */
export const SendOtpSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type SendOtpInput = z.infer<typeof SendOtpSchema>['body'];

/**
 * Schema for verifying a password reset OTP
 */
export const VerifyOtpSchema = z.object({
  body: z.object({
    email: z.email(),
    code: z.string().length(6, 'Code must be 6 characters'),
  }),
});

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>['body'];

/**
 * Schema for resetting password with an OTP-derived reset token
 */
export const ResetPasswordWithOtpSchema = z.object({
  body: z.object({
    email: z.email(),
    resetToken: z.string().min(1, 'Reset token is required'),
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

export type ResetPasswordWithOtpInput = z.infer<
  typeof ResetPasswordWithOtpSchema
>['body'];

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

/**
 * Schema for sending email verification code
 */
export const SendEmailVerificationCodeSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type SendEmailVerificationCodeInput = z.infer<
  typeof SendEmailVerificationCodeSchema
>['body'];

/**
 * Schema for verifying email verification code
 */
export const VerifyEmailCodeSchema = z.object({
  body: z.object({
    email: z.email(),
    code: z.string().length(6, 'Code must be 6 characters'),
  }),
});

export type VerifyEmailCodeInput = z.infer<
  typeof VerifyEmailCodeSchema
>['body'];
