import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import {
  CheckEmailVerifiedInput,
  GoogleSignInInput,
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  ResetPasswordWithOtpInput,
  SendOtpInput,
  VerifyOtpInput,
  VerifyEmailCodeInput,
  SendEmailVerificationCodeInput,
} from '../schemas/auth.schema';
import supabase from '../config/supabase';
import { createUser, getUserBySupabaseId } from './user.controller';
import googleClient from '../config/google';
import { mapSupabaseError } from '../lib/errors/supabase-error-mapper';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  UnexpectedException,
} from '../lib/errors';
import {
  generateOtp,
  verifyOtp,
  consumeResetToken,
} from '../services/otp.service';
import {
  generateVerificationCode,
  verifyEmailCode,
} from '../services/email_verification.service';

const resolveIsCoach = async (
  supabaseId: string,
  userFlag?: boolean
): Promise<boolean> => {
  if (userFlag) {
    return true;
  }

  const coachProfile = await prisma.coach.findUnique({
    where: { user_id: supabaseId },
    select: { user_id: true },
  });

  return Boolean(coachProfile);
};

// User registration handler
export const registerWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password, name, nickname } = res.locals.validated
    ?.body as RegisterInput;

  logger.debug('Registration attempt', { email });

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    logger.debug('Registration failed: Email already exists', { email });
    throw new ConflictException(
      'AUTH_EMAIL_ALREADY_EXISTS',
      'Email already exists'
    );
  }

  // Create user in Supabase via admin API without sending confirmation email
  const { data, error: supabaseError } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: false,
  });

  if (supabaseError || !data.user) {
    logger.error('Supabase user creation failed', {
      email,
      error: supabaseError,
    });
    if (supabaseError) {
      throw mapSupabaseError(
        supabaseError,
        'registration',
        'Failed to create account. Please try again.'
      );
    }
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Failed to create account. Please try again.'
    );
  }

  const supabaseId = data.user.id;

  const user = await createUser({
    email,
    full_name: name,
    nickname,
    supabase_auth_id: supabaseId,
  });

  // Generate and send email verification code
  try {
    await generateVerificationCode(email);
  } catch (emailErr) {
    logger.error(
      'Failed to send verification email — user created but email not sent',
      {
        email,
        error: emailErr,
      }
    );
  }

  // Return user data without tokens — email verification is required
  sendSuccess(
    res,
    {
      user: {
        supabase_auth_id: user.supabase_auth_id,
        email: user.email,
        full_name: user.full_name,
        nickname: user.nickname,
      },
      message:
        'Registration successful. Please check your email for the verification code.',
    },
    201
  );
};

export const signInWithGoogle = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { idToken } = res.locals.validated?.body as GoogleSignInInput;

  if (!idToken) {
    throw new BadRequestException(
      'AUTH_ID_TOKEN_REQUIRED',
      'ID token is required'
    );
  }

  // Verify ID with Google Client
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new BadRequestException('AUTH_ID_TOKEN_INVALID', 'Invalid ID token');
  }

  const { data: supabaseData, error: supabaseError } =
    await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

  if (supabaseError || !supabaseData.user) {
    logger.error('Supabase Google sign-in failed', {
      email: payload.email,
      error: supabaseError,
    });
    if (supabaseError) {
      throw mapSupabaseError(
        supabaseError,
        'google sign-in',
        'Failed to sign in with Google. Please try again.'
      );
    }
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Failed to sign in with Google. Please try again.'
    );
  }

  const accessToken = supabaseData.session?.access_token;
  const refreshToken = supabaseData.session?.refresh_token;
  const supabaseId = supabaseData.user.id;

  sendSuccess(
    res,
    {
      accessToken,
      refreshToken,
      user: {
        email: payload.email,
        supabaseId,
      },
    },
    200
  );
};

export const loginWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password } = res.locals.validated?.body as LoginInput;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (error || !data.user) {
    logger.debug('Login failed', {
      email,
      code: (error as { code?: string })?.code,
      message: error?.message,
    });
    if (error) {
      throw mapSupabaseError(error, 'login', 'Invalid email or password.');
    }
    throw new UnauthorizedException(
      'AUTH_INVALID_CREDENTIALS',
      'Invalid email or password.'
    );
  }

  const user = await prisma.user.findUnique({
    where: { supabase_auth_id: data.user.id },
  });

  if (!user) {
    logger.debug('Login failed: User not found in database', {
      email,
      supabase_auth_id: data.user.id,
    });
    throw new NotFoundException('AUTH_APP_USER_NOT_FOUND', 'User not found');
  }

  const isCoach = await resolveIsCoach(user.supabase_auth_id, user.is_coach);

  const accessToken = data.session?.access_token;
  const refreshToken = data.session?.refresh_token;

  if (!accessToken || !refreshToken) {
    logger.error('Token generation failed during login', { email });
    throw new UnexpectedException(
      'AUTH_TOKEN_GENERATION_FAILED',
      'Failed to generate token'
    );
  }

  sendSuccess(
    res,
    {
      accessToken,
      refreshToken,
      user: {
        supabase_auth_id: user.supabase_auth_id,
        email: user.email,
        full_name: user.full_name,
        nickname: user.nickname,
        isCoach,
      },
    },
    200
  );
};

export const signInWithGoogleWithUserData = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { idToken } = res.locals.validated?.body as GoogleSignInInput;

  if (!idToken) {
    throw new BadRequestException(
      'AUTH_ID_TOKEN_REQUIRED',
      'ID token is required'
    );
  }

  // Verify ID with Google Client
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new BadRequestException('AUTH_ID_TOKEN_INVALID', 'Invalid ID token');
  }

  const { data: supabaseData, error: supabaseError } =
    await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

  if (supabaseError || !supabaseData.user) {
    logger.error('Supabase Google sign-in failed', {
      email: payload.email,
      error: supabaseError,
    });
    if (supabaseError) {
      throw mapSupabaseError(
        supabaseError,
        'google login',
        'Failed to sign in with Google. Please try again.'
      );
    }
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Failed to sign in with Google. Please try again.'
    );
  }

  const userData = await getUserBySupabaseId(supabaseData.user.id);

  if (!userData) {
    logger.debug('Login failed: User not found in database', {
      email: payload.email,
      supabaseId: supabaseData.user.id,
    });
    throw new NotFoundException('AUTH_APP_USER_NOT_FOUND', 'User not found');
  }

  const isCoach = await resolveIsCoach(
    userData.supabase_auth_id,
    userData.is_coach
  );

  const accessToken = supabaseData.session?.access_token;
  const refreshToken = supabaseData.session?.refresh_token;

  sendSuccess(
    res,
    {
      accessToken,
      refreshToken,
      user: {
        supabase_auth_id: userData.supabase_auth_id,
        email: userData.email,
        full_name: userData.full_name,
        nickname: userData.nickname,
        isCoach,
      },
    },
    200
  );
};

/**
 * Refresh tokens using refresh token in body (Flutter app contract: POST /auth/refresh).
 */
export const refreshTokenWithBody = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { refreshToken: refreshTokenValue } = res.locals.validated
    ?.body as RefreshTokenInput;

  if (!refreshTokenValue) {
    throw new UnauthorizedException(
      'AUTH_TOKEN_MISSING',
      'Refresh token is required'
    );
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshTokenValue,
  });

  if (error || !data.session) {
    logger.error('Token refresh failed', { error });
    throw new UnauthorizedException(
      'AUTH_REFRESH_FAILED',
      'Failed to refresh token'
    );
  }

  const supabaseId = data.session.user?.id;
  const appUser = supabaseId ? await getUserBySupabaseId(supabaseId) : null;

  if (!appUser) {
    throw new UnauthorizedException(
      'AUTH_APP_USER_NOT_FOUND',
      'User not found'
    );
  }

  const isCoach = await resolveIsCoach(
    appUser.supabase_auth_id,
    appUser.is_coach
  );

  sendSuccess(
    res,
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        supabase_auth_id: appUser.supabase_auth_id,
        email: appUser.email,
        full_name: appUser.full_name,
        nickname: appUser.nickname,
        isCoach,
      },
    },
    200
  );
};

/**
 * Refresh tokens using Bearer token (GET /auth/refresh).
 */
export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { refreshToken } = res.locals.validated?.body as RefreshTokenInput;

  if (!refreshToken) {
    throw new UnauthorizedException(
      'AUTH_TOKEN_MISSING',
      'Refresh token is required'
    );
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    logger.error('Token refresh failed', { error });
    throw new UnauthorizedException(
      'AUTH_REFRESH_FAILED',
      'Failed to refresh token'
    );
  }

  const supabaseId = data.session.user?.id;
  const appUser = supabaseId ? await getUserBySupabaseId(supabaseId) : null;

  if (!appUser) {
    throw new UnauthorizedException(
      'AUTH_APP_USER_NOT_FOUND',
      'User not found'
    );
  }

  const isCoach = await resolveIsCoach(
    appUser.supabase_auth_id,
    appUser.is_coach
  );

  sendSuccess(
    res,
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        supabase_auth_id: appUser.supabase_auth_id,
        email: appUser.email,
        full_name: appUser.full_name,
        nickname: appUser.nickname,
        isCoach,
      },
    },
    200
  );
};

/**
 * Get current user and coach status. Protected by authenticateSupabaseUser only.
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const supabaseUser = req.user;
  if (!supabaseUser) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const supabaseUserId =
    'id' in supabaseUser ? supabaseUser.id : supabaseUser.supabase_auth_id;
  const appUser = await getUserBySupabaseId(supabaseUserId);

  if (!appUser) {
    throw new UnauthorizedException(
      'AUTH_APP_USER_NOT_FOUND',
      'User not found'
    );
  }

  const isCoach = await resolveIsCoach(
    appUser.supabase_auth_id,
    appUser.is_coach
  );

  let coachDeactivated = false;
  if (isCoach) {
    const coachProfile = await prisma.coach.findUnique({
      where: { user_id: appUser.supabase_auth_id },
      select: { deactivated_at: true },
    });
    coachDeactivated = coachProfile?.deactivated_at != null;
  }

  sendSuccess(res, {
    user: {
      supabase_auth_id: appUser.supabase_auth_id,
      email: appUser.email,
      full_name: appUser.full_name,
      nickname: appUser.nickname,
    },
    isCoach,
    coachDeactivated,
    tier: appUser.active_subscription_tier,
  });
};

/**
 * Logout (optional, Flutter app contract). Client clears tokens locally.
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, {}, 200);
};

export const sendOtp = async (_req: Request, res: Response): Promise<void> => {
  const { email } = res.locals.validated?.body as SendOtpInput;

  logger.debug('Password reset OTP request', { email });

  const result = await generateOtp(email);

  if (!result.success) {
    throw new BadRequestException(
      'AUTH_OTP_COOLDOWN',
      `Please wait ${result.cooldownRemaining} seconds before requesting a new code.`
    );
  }

  sendSuccess(res, { message: 'Verification code sent' }, 200);
};

export const resetPasswordWithOtp = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const { email, resetToken, newPassword } = res.locals.validated
    ?.body as ResetPasswordWithOtpInput;

  await consumeResetToken(email, resetToken);

  const { data, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    logger.error('Failed to look up user for password reset', {
      email,
      error: listError,
    });
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Failed to reset password. Please try again.'
    );
  }

  const supabaseUser = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!supabaseUser || !supabaseUser.id) {
    throw new NotFoundException(
      'AUTH_USER_NOT_FOUND',
      'No account found with this email.'
    );
  }

  const { error } = await supabase.auth.admin.updateUserById(supabaseUser.id, {
    password: newPassword,
  });

  if (error) {
    logger.error('Password reset failed', {
      error,
      supabaseUserId: supabaseUser.id,
    });
    throw mapSupabaseError(
      error,
      'password reset',
      'Failed to reset password. Please try again.'
    );
  }

  sendSuccess(res, { message: 'Password reset successfully' }, 200);
};

/**
 * Verify a password reset OTP code and return a one-time reset token.
 *
 * POST /api/auth/verify-otp
 */
export const verifyOtpHandler = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const { email, code } = res.locals.validated?.body as VerifyOtpInput;

  logger.debug('Verifying password reset OTP', { email });

  const resetToken = await verifyOtp(email, code);

  sendSuccess(res, { resetToken }, 200);
};

/**
 * Check if a user's email has been verified in Supabase.
 * Used by the Flutter app's "Check Email" screen to poll verification status.
 *
 * POST /api/auth/check-email-verified
 */
export const checkEmailVerified = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const { email } = res.locals.validated?.body as CheckEmailVerifiedInput;

  logger.debug('Checking email verification status', { email });

  // Use the admin API to look up the user by email
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    logger.error('Failed to check email verification status', {
      email,
      error,
    });
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Failed to check verification status'
    );
  }

  const supabaseUser = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!supabaseUser) {
    // Don't reveal whether the email exists — return unverified
    sendSuccess(res, { verified: false });
    return;
  }

  const verified = !!supabaseUser.email_confirmed_at;

  sendSuccess(res, { verified });
};

/**
 * Send (or resend) an email verification code.
 *
 * POST /api/auth/send-verification-code
 */
export const sendEmailVerificationCodeHandler = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const { email } = res.locals.validated
    ?.body as SendEmailVerificationCodeInput;

  logger.debug('Email verification code request', { email });

  const result = await generateVerificationCode(email);

  if (!result.success) {
    throw new BadRequestException(
      'AUTH_VERIFICATION_COOLDOWN',
      `Please wait ${result.cooldownRemaining} seconds before requesting a new code.`
    );
  }

  sendSuccess(res, { message: 'Verification code sent' }, 200);
};

/**
 * Verify an email verification code and confirm the user's email in Supabase.
 *
 * POST /api/auth/verify-email-code
 */
export const verifyEmailCodeHandler = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const { email, code } = res.locals.validated?.body as VerifyEmailCodeInput;

  logger.debug('Verifying email code', { email });

  // Validate the verification code
  await verifyEmailCode(email, code);

  // Look up the Supabase user
  const { data, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    logger.error('Failed to look up user for email verification', {
      email,
      error: listError,
    });
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Failed to verify email. Please try again.'
    );
  }

  const supabaseUser = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!supabaseUser || !supabaseUser.id) {
    throw new NotFoundException(
      'AUTH_USER_NOT_FOUND',
      'No account found with this email.'
    );
  }

  // Confirm the email via Supabase admin API
  const { error } = await supabase.auth.admin.updateUserById(supabaseUser.id, {
    email_confirm: true,
  });

  if (error) {
    logger.error('Failed to confirm email in Supabase', {
      error,
      supabaseUserId: supabaseUser.id,
    });
    throw mapSupabaseError(
      error,
      'email verification',
      'Failed to verify email. Please try again.'
    );
  }

  logger.info('Email verified successfully', { email });

  sendSuccess(res, { message: 'Email verified successfully' }, 200);
};
