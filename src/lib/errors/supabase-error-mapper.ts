import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { parseSupabaseAuthError } from '../../utils/supabase-error';
import type { ErrorCode } from './codes';
import {
  AppException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  RateLimitException,
  UnauthorizedException,
  UnexpectedException,
  UnprocessableException,
} from './exceptions';

/**
 * Maps a Supabase error code string to our typed ErrorCode.
 * Reuses the existing mapping table in utils/supabase-error.ts for
 * message + status, and layers our code on top.
 */
const SUPABASE_CODE_TO_ERROR_CODE: Record<string, ErrorCode> = {
  // Rate limiting
  over_email_send_rate_limit: 'AUTH_RATE_LIMITED',
  over_request_rate_limit: 'AUTH_RATE_LIMITED',
  over_sms_send_rate_limit: 'AUTH_RATE_LIMITED',

  // Credentials & auth
  invalid_credentials: 'AUTH_INVALID_CREDENTIALS',
  email_not_confirmed: 'AUTH_EMAIL_NOT_VERIFIED',
  user_not_found: 'AUTH_USER_NOT_FOUND',
  user_already_exists: 'AUTH_EMAIL_ALREADY_EXISTS',
  email_exists: 'AUTH_EMAIL_ALREADY_EXISTS',
  user_banned: 'AUTH_USER_BANNED',
  signup_disabled: 'AUTH_SIGNUP_DISABLED',

  // Password
  same_password: 'AUTH_SAME_PASSWORD',
  weak_password: 'AUTH_WEAK_PASSWORD',

  // Token & session
  bad_jwt: 'AUTH_BAD_JWT',
  session_expired: 'AUTH_SESSION_EXPIRED',
  session_not_found: 'AUTH_SESSION_EXPIRED',
  refresh_token_not_found: 'AUTH_SESSION_EXPIRED',
  refresh_token_already_used: 'AUTH_SESSION_EXPIRED',

  // PKCE flow
  flow_state_expired: 'AUTH_CODE_EXCHANGE_FAILED',
  flow_state_not_found: 'AUTH_CODE_EXCHANGE_FAILED',
  bad_code_verifier: 'AUTH_CODE_EXCHANGE_FAILED',

  // OTP
  otp_expired: 'AUTH_TOKEN_EXPIRED',

  // Email validation
  email_address_invalid: 'VALIDATION_ERROR',
  email_address_not_authorized: 'VALIDATION_ERROR',
  email_provider_disabled: 'AUTH_PROVIDER_ERROR',

  // OAuth
  oauth_provider_not_supported: 'AUTH_PROVIDER_ERROR',
  provider_disabled: 'AUTH_PROVIDER_ERROR',

  // Reauthentication
  reauthentication_needed: 'AUTH_TOKEN_EXPIRED',
  reauthentication_not_valid: 'AUTH_INVALID_CREDENTIALS',

  // General
  validation_failed: 'VALIDATION_ERROR',
  bad_json: 'VALIDATION_ERROR',
  unexpected_failure: 'UNEXPECTED_EXCEPTION',
  request_timeout: 'UNEXPECTED_EXCEPTION',
  conflict: 'AUTH_EMAIL_ALREADY_EXISTS',
  captcha_failed: 'VALIDATION_ERROR',
};

/**
 * Helper to pick the right AppException subclass for a given HTTP status.
 */
function exceptionForStatus(
  status: number,
  code: ErrorCode,
  message: string
): AppException {
  if (status === 429) return new RateLimitException(code, message);
  if (status === 409) return new ConflictException(code, message);
  if (status === 422) return new UnprocessableException(code, message);
  if (status === 403) return new ForbiddenException(code, message);
  if (status === 401) return new UnauthorizedException(code, message);
  if (status === 400) return new BadRequestException(code, message);
  if (status >= 500) return new UnexpectedException(code, message);
  return new BadRequestException(code, message);
}

/**
 * Maps a Supabase AuthError to an AppException.
 *
 * Reuses `parseSupabaseAuthError` (existing util) for the user-friendly
 * message + HTTP status, and wraps the result in the correct exception
 * subclass with a typed error code.
 *
 * @param err - Supabase AuthError instance
 * @param context - Optional context for logging
 * @param fallbackMessage - Fallback if error code is unrecognised
 * @returns An AppException ready for the global error handler
 */
export function mapSupabaseError(
  err: SupabaseAuthError,
  context?: string,
  fallbackMessage?: string
): AppException {
  const parsed = parseSupabaseAuthError(err, context, fallbackMessage);
  const mappedCode = parsed.code
    ? SUPABASE_CODE_TO_ERROR_CODE[parsed.code]
    : undefined;
  const code: ErrorCode = mappedCode ?? 'AUTH_PROVIDER_ERROR';
  return exceptionForStatus(parsed.status, code, parsed.message);
}
