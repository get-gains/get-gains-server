import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  CheckEmailVerifiedInput,
  ExchangeCodeInput,
  GoogleSignInInput,
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  ResetPasswordInput,
  SendRecoveryEmailInput,
} from '../schemas/auth.schema';
import supabase from '../config/supabase';
import { createUser, getUserBySupabaseId } from './user.controller';
import googleClient from '../config/google';
import { parseSupabaseAuthError } from '../utils/supabase-error';

// User registration handler
export const registerWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, name, nickname } = res.locals.validated
      ?.body as RegisterInput;

    logger.debug('Registration attempt', { email });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      logger.debug('Registration failed: Email already exists', { email });
      sendSingleError(res, 'Email already exists', 409, 'email');
      return;
    }

    // Create user in supabase with email verification redirect
    const { data, error: supabaseError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        emailRedirectTo: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
      },
    });

    if (supabaseError || !data.user) {
      logger.error('Supabase user creation failed', {
        email,
        error: supabaseError,
      });
      if (supabaseError) {
        const parsed = parseSupabaseAuthError(
          supabaseError,
          'registration',
          'Failed to create account. Please try again.'
        );
        sendSingleError(res, parsed.message, parsed.status);
      } else {
        sendSingleError(
          res,
          'Failed to create account. Please try again.',
          500
        );
      }
      return;
    }

    const supabaseId = data.user.id;

    const user = await createUser({
      email,
      full_name: name,
      nickname,
      supabase_auth_id: supabaseId,
    });

    // Always return user data without tokens — email verification is required
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
          'Registration successful. Please check your email to verify your account.',
      },
      201
    );
    return;
  } catch (error) {
    logger.error('Registration error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

export const signInWithGoogle = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { idToken } = res.locals.validated?.body as GoogleSignInInput;

    if (!idToken) {
      sendSingleError(res, 'ID token is required', 400);
      return;
    }

    // Verify ID with Google Client
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      sendSingleError(res, 'Invalid ID token', 400);
      return;
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
        const parsed = parseSupabaseAuthError(
          supabaseError,
          'google sign-in',
          'Failed to sign in with Google. Please try again.'
        );
        sendSingleError(res, parsed.message, parsed.status);
      } else {
        sendSingleError(
          res,
          'Failed to sign in with Google. Please try again.',
          500
        );
      }
      return;
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
    return;
  } catch (error) {
    logger.error('Google sign-in error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

export const loginWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
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
        const parsed = parseSupabaseAuthError(
          error,
          'login',
          'Invalid email or password.',
          401
        );
        sendSingleError(res, parsed.message, parsed.status, 'email');
      } else {
        sendSingleError(res, 'Invalid email or password.', 401);
      }
      return;
    }

    const user = await prisma.user.findUnique({
      where: { supabase_auth_id: data.user.id },
    });

    if (!user) {
      logger.debug('Login failed: User not found in database', {
        email,
        supabase_auth_id: data.user.id,
      });
      sendSingleError(res, 'User not found', 404);
      return;
    }

    const isCoach = user.is_coach;

    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;

    if (!accessToken || !refreshToken) {
      logger.error('Token generation failed during login', { email });
      sendSingleError(res, 'Failed to generate token', 500);
      return;
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
    return;
  } catch (error) {
    logger.error('Email/password login error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

export const signInWithGoogleWithUserData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { idToken } = res.locals.validated?.body as GoogleSignInInput;

    if (!idToken) {
      sendSingleError(res, 'ID token is required', 400);
      return;
    }

    // Verify ID with Google Client
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      sendSingleError(res, 'Invalid ID token', 400);
      return;
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
        const parsed = parseSupabaseAuthError(
          supabaseError,
          'google login',
          'Failed to sign in with Google. Please try again.'
        );
        sendSingleError(res, parsed.message, parsed.status);
      } else {
        sendSingleError(
          res,
          'Failed to sign in with Google. Please try again.',
          500
        );
      }
      return;
    }

    const userData = await getUserBySupabaseId(supabaseData.user.id);

    if (!userData) {
      logger.debug('Login failed: User not found in database', {
        email: payload.email,
        supabaseId: supabaseData.user.id,
      });
      sendSingleError(res, 'User not found', 404);
      return;
    }

    const isCoach = userData.is_coach;

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
    return;
  } catch (error) {
    logger.error('Google sign-in error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

/**
 * Refresh tokens using refresh token in body (Flutter app contract: POST /auth/refresh).
 */
export const refreshTokenWithBody = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken: refreshTokenValue } = res.locals.validated
      ?.body as RefreshTokenInput;

    if (!refreshTokenValue) {
      sendSingleError(res, 'Refresh token is required', 401);
      return;
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshTokenValue,
    });

    if (error || !data.session) {
      logger.error('Token refresh failed', { error });
      sendSingleError(res, 'Failed to refresh token', 401);
      return;
    }

    const supabaseId = data.session.user?.id;
    const appUser = supabaseId ? await getUserBySupabaseId(supabaseId) : null;

    if (!appUser) {
      sendSingleError(res, 'User not found', 401);
      return;
    }

    const isCoach = appUser.is_coach;

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
    return;
  } catch (error) {
    logger.error('Token refresh error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

/**
 * Refresh tokens using Bearer token (GET /auth/refresh).
 */
export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken } = res.locals.validated?.body as RefreshTokenInput;

    if (!refreshToken) {
      sendSingleError(res, 'Refresh token is required', 401);
      return;
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      logger.error('Token refresh failed', { error });
      sendSingleError(res, 'Failed to refresh token', 401);
      return;
    }

    const supabaseId = data.session.user?.id;
    const appUser = supabaseId ? await getUserBySupabaseId(supabaseId) : null;

    if (!appUser) {
      sendSingleError(res, 'User not found', 401);
      return;
    }

    const isCoach = appUser.is_coach;

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
    return;
  } catch (error) {
    logger.error('Token refresh error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

/**
 * Get current user and coach status. Protected by authenticateSupabaseUser only.
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabaseUser = req.user;
    if (!supabaseUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const supabaseUserId =
      'id' in supabaseUser ? supabaseUser.id : supabaseUser.supabase_auth_id;
    const appUser = await getUserBySupabaseId(supabaseUserId);

    if (!appUser) {
      sendSingleError(res, 'User not found', 401);
      return;
    }

    const isCoach = appUser.is_coach;

    sendSuccess(res, {
      user: {
        supabase_auth_id: appUser.supabase_auth_id,
        email: appUser.email,
        full_name: appUser.full_name,
        nickname: appUser.nickname,
      },
      isCoach,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('getMe error', { message: err.message, stack: err.stack });
    sendSingleError(res, 'Internal server error', 500);
  }
};

/**
 * Logout (optional, Flutter app contract). Client clears tokens locally.
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, {}, 200);
};

export const sendRecoveryEmail = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = res.locals.validated?.body as SendRecoveryEmailInput;

    logger.debug('Password recovery email request', { email });
    logger.debug('Using password reset redirect URL', {
      url: process.env.PASSWORD_RESET_REDIRECT_URL,
    });

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase(),
      {
        redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL,
      }
    );

    if (error) {
      logger.error('Password recovery email failed', { email, error });
      const parsed = parseSupabaseAuthError(
        error,
        'password recovery',
        'Failed to send recovery email. Please try again.'
      );
      sendSingleError(res, parsed.message, parsed.status);
      return;
    }

    sendSuccess(
      res,
      { message: 'Password recovery email sent successfully' },
      200
    );
    return;
  } catch (error) {
    logger.error('Password recovery error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { newPassword } = res.locals.validated?.body as ResetPasswordInput;

    // The user is already authenticated via Bearer token (authenticateSupabaseUser middleware)
    // req.user contains the validated Supabase user from getUser(token)
    const supabaseUser = req.user;
    if (!supabaseUser || !('id' in supabaseUser)) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const supabaseUserId = supabaseUser.id;

    // Use admin API to update the password directly
    // This avoids needing to setSession on the shared Supabase client
    // and doesn't require a refresh token
    const { error } = await supabase.auth.admin.updateUserById(supabaseUserId, {
      password: newPassword,
    });

    if (error) {
      logger.error('Password reset failed', { error, supabaseUserId });
      const parsed = parseSupabaseAuthError(
        error,
        'password reset',
        'Failed to reset password. Please try again.'
      );
      sendSingleError(res, parsed.message, parsed.status);
      return;
    }

    sendSuccess(res, { message: 'Password reset successfully' }, 200);
    return;
  } catch (error) {
    logger.error('Password reset error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};

/**
 * Exchange Supabase auth code for session tokens.
 *
 * This endpoint is called by the web app after Supabase redirects
 * with a PKCE auth code (from email verification or password reset links).
 *
 * The Supabase code is exchanged server-side using the service role client
 * to get a valid session with access and refresh tokens.
 *
 * POST /api/auth/exchange-code
 */
export const exchangeCodeForSession = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const { code } = res.locals.validated?.body as ExchangeCodeInput;

    logger.debug('Exchanging auth code for session');

    // Exchange the code for a session using Supabase
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      logger.error('Code exchange failed', { error });
      if (error) {
        const parsed = parseSupabaseAuthError(
          error,
          'code exchange',
          'This link is invalid or has expired. Please request a new one.',
          401
        );
        sendSingleError(res, parsed.message, parsed.status);
      } else {
        sendSingleError(
          res,
          'This link is invalid or has expired. Please request a new one.',
          401
        );
      }
      return;
    }

    const { session, user } = data;

    // Check if this user exists in our database
    const appUser = await prisma.user.findUnique({
      where: { supabase_auth_id: user.id },
    });

    sendSuccess(res, {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: appUser
        ? {
            supabase_auth_id: appUser.supabase_auth_id,
            email: appUser.email,
            full_name: appUser.full_name,
            nickname: appUser.nickname,
          }
        : null,
    });
  } catch (error) {
    logger.error('Code exchange error', error);
    sendSingleError(res, 'Internal server error', 500);
  }
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
  try {
    const { email } = res.locals.validated?.body as CheckEmailVerifiedInput;

    logger.debug('Checking email verification status', { email });

    // Use the admin API to look up the user by email
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      logger.error('Failed to check email verification status', {
        email,
        error,
      });
      sendSingleError(res, 'Failed to check verification status', 500);
      return;
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
  } catch (error) {
    logger.error('Check email verified error', error);
    sendSingleError(res, 'Internal server error', 500);
  }
};
