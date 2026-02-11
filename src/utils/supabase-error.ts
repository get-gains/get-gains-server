import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * Supabase Auth error code to user-friendly message mapping.
 *
 * Based on: https://supabase.com/docs/guides/auth/debugging/error-codes
 *
 * Best practice from Supabase docs:
 * "Always use error.code and error.name to identify errors,
 *  not string matching on error messages."
 */
const SUPABASE_ERROR_MESSAGES: Record<
  string,
  { message: string; status: number }
> = {
  // Rate limiting
  over_email_send_rate_limit: {
    message:
      'Too many emails sent. Please wait a few minutes before trying again.',
    status: 429,
  },
  over_request_rate_limit: {
    message: 'Too many requests. Please wait a moment and try again.',
    status: 429,
  },
  over_sms_send_rate_limit: {
    message:
      'Too many SMS messages sent. Please wait a few minutes before trying again.',
    status: 429,
  },

  // Credentials & auth
  invalid_credentials: {
    message: 'Invalid email or password.',
    status: 401,
  },
  email_not_confirmed: {
    message:
      'Email not confirmed. Please check your inbox and confirm your email before signing in.',
    status: 403,
  },
  user_not_found: {
    message: 'No account found with that email address.',
    status: 404,
  },
  user_already_exists: {
    message: 'An account with this email already exists.',
    status: 409,
  },
  email_exists: {
    message: 'An account with this email already exists.',
    status: 409,
  },
  user_banned: {
    message: 'This account has been suspended. Please contact support.',
    status: 403,
  },
  signup_disabled: {
    message: 'Registration is currently disabled. Please try again later.',
    status: 403,
  },

  // Password
  same_password: {
    message: 'New password must be different from your current password.',
    status: 422,
  },
  weak_password: {
    message:
      'Password is too weak. Please use at least 8 characters with a mix of letters, numbers, and symbols.',
    status: 422,
  },

  // Token & session
  bad_jwt: {
    message: 'Your session is invalid. Please try again.',
    status: 401,
  },
  session_expired: {
    message: 'Your session has expired. Please try again.',
    status: 401,
  },
  session_not_found: {
    message: 'Session not found. Please try again.',
    status: 401,
  },
  refresh_token_not_found: {
    message: 'Session not found. Please log in again.',
    status: 401,
  },
  refresh_token_already_used: {
    message: 'Session expired. Please log in again.',
    status: 401,
  },

  // PKCE flow
  flow_state_expired: {
    message: 'This link has expired. Please request a new one.',
    status: 401,
  },
  flow_state_not_found: {
    message:
      'This link is invalid or has already been used. Please request a new one.',
    status: 401,
  },
  bad_code_verifier: {
    message: 'Invalid verification code. Please request a new link.',
    status: 400,
  },

  // OTP
  otp_expired: {
    message: 'This code has expired. Please request a new one.',
    status: 401,
  },

  // Email
  email_address_invalid: {
    message: 'Please enter a valid email address.',
    status: 422,
  },
  email_address_not_authorized: {
    message:
      'This email address is not authorized. Please use a different email.',
    status: 422,
  },
  email_provider_disabled: {
    message: 'Email sign-up is currently disabled.',
    status: 403,
  },

  // OAuth
  oauth_provider_not_supported: {
    message: 'This sign-in method is not supported.',
    status: 400,
  },
  provider_disabled: {
    message: 'This sign-in method is currently disabled.',
    status: 403,
  },

  // Reauthentication
  reauthentication_needed: {
    message: 'Please verify your identity before changing your password.',
    status: 422,
  },
  reauthentication_not_valid: {
    message: 'Verification failed. Please try again.',
    status: 422,
  },

  // General
  validation_failed: {
    message: 'The provided data is invalid. Please check your input.',
    status: 422,
  },
  bad_json: {
    message: 'Invalid request format.',
    status: 400,
  },
  unexpected_failure: {
    message: 'An unexpected error occurred. Please try again later.',
    status: 500,
  },
  request_timeout: {
    message: 'The request timed out. Please try again.',
    status: 504,
  },
  conflict: {
    message: 'A conflict occurred. Please try again.',
    status: 409,
  },

  // Captcha
  captcha_failed: {
    message: 'Captcha verification failed. Please try again.',
    status: 400,
  },
};

/**
 * Result of parsing a Supabase auth error.
 */
export interface ParsedSupabaseError {
  /** User-friendly error message */
  message: string;
  /** Recommended HTTP status code */
  status: number;
  /** Original Supabase error code (e.g., 'over_email_send_rate_limit') */
  code: string | undefined;
}

/**
 * Parse a Supabase AuthApiError into a user-friendly message and HTTP status.
 *
 * Uses the `error.code` property (not string matching on message) as
 * recommended by Supabase docs.
 *
 * @param error - The error returned from a Supabase auth operation
 * @param context - Optional context string for logging (e.g., 'password reset')
 * @param fallbackMessage - Fallback message if the error code is not recognized
 * @param fallbackStatus - Fallback HTTP status if the error code is not recognized
 */
export function parseSupabaseAuthError(
  error: SupabaseAuthError,
  context?: string,
  fallbackMessage: string = 'An error occurred. Please try again.',
  fallbackStatus: number = 500
): ParsedSupabaseError {
  const code = (error as any).code as string | undefined;
  const status = (error as any).status as number | undefined;

  logger.debug('Parsing Supabase auth error', {
    context,
    code,
    status,
    message: error.message,
  });

  // Check if we have a mapped message for this code
  if (code && SUPABASE_ERROR_MESSAGES[code]) {
    const mapped = SUPABASE_ERROR_MESSAGES[code];
    return {
      message: mapped.message,
      status: mapped.status,
      code,
    };
  }

  // For 429 status without a recognized code, still return rate limit message
  if (status === 429) {
    return {
      message: 'Too many requests. Please wait a moment and try again.',
      status: 429,
      code,
    };
  }

  // Fallback: use the Supabase error's own message if it's reasonably user-friendly,
  // otherwise use the provided fallback
  const supabaseMessage = error.message;
  const isUserFriendly =
    supabaseMessage &&
    supabaseMessage.length < 200 &&
    !supabaseMessage.includes('undefined') &&
    !supabaseMessage.includes('null');

  return {
    message: isUserFriendly ? supabaseMessage : fallbackMessage,
    status: status || fallbackStatus,
    code,
  };
}
