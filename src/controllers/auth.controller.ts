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
  ResetPasswordInput,
  SendRecoveryEmailInput,
} from '../schemas/auth.schema';
import supabase from '../config/supabase';
import { createUser, getUserBySupabaseId } from './user.controller';
import googleClient from '../config/google';

// User registration handler
export const registerWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, name, nickname }: RegisterInput = req.body;

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
      sendSingleError(res, 'Failed to create user', 500);
      return;
    }

    const supabaseId = data.user.id;

    const user = await createUser({ email, name, nickname, supabaseId });

    // Always return user data without tokens — email verification is required
    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          supabaseId: user.supabaseId,
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
    const { idToken }: GoogleSignInInput = req.body;

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
      sendSingleError(res, 'Failed to sign in with Google', 500);
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
    const { email, password }: LoginInput = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error || !data.user) {
      const msg = (error?.message ?? '').toLowerCase();
      const isEmailNotConfirmed =
        msg.includes('email not confirmed') ||
        msg.includes('not confirmed') ||
        msg.includes('not authorized') ||
        msg.includes('cannot be used');
      if (isEmailNotConfirmed) {
        logger.debug('Login failed: Email not confirmed', { email });
        sendSingleError(
          res,
          'Email not confirmed. Please check your inbox and confirm your email before signing in.',
          403,
          'email'
        );
        return;
      }
      logger.debug('Login failed: Invalid credentials', { email });
      sendSingleError(res, 'Invalid email or password', 401);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
    });

    if (!user) {
      logger.debug('Login failed: User not found in database', {
        email,
        supabaseId: data.user.id,
      });
      sendSingleError(res, 'User not found', 404);
      return;
    }

    const coach = await prisma.coach.findUnique({
      where: { userId: user.id },
    });
    const isCoach = !!coach;

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
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          supabaseId: user.supabaseId,
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
    const { idToken }: GoogleSignInInput = req.body;

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
      sendSingleError(res, 'Failed to sign in with Google', 500);
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

    const coach = await prisma.coach.findUnique({
      where: { userId: userData.id },
    });
    const isCoach = !!coach;

    const accessToken = supabaseData.session?.access_token;
    const refreshToken = supabaseData.session?.refresh_token;
    const supabaseId = supabaseData.user.id;

    sendSuccess(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          nickname: userData.nickname,
          supabaseId,
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

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      sendSingleError(res, 'No token provided', 401);
      return;
    }

    // Use the current token to get a refreshed session
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      logger.error('Token refresh failed', { error, userId: req.user?.id });
      sendSingleError(res, 'Failed to refresh token', 401);
      return;
    }

    const supabaseId = data.session.user?.id;
    const appUser = supabaseId ? await getUserBySupabaseId(supabaseId) : null;

    if (!appUser) {
      sendSingleError(res, 'User not found', 401);
      return;
    }

    const coach = await prisma.coach.findUnique({
      where: { userId: appUser.id },
    });
    const isCoach = !!coach;

    sendSuccess(
      res,
      {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: appUser.id,
          email: appUser.email,
          name: appUser.name,
          nickname: appUser.nickname,
          supabaseId: appUser.supabaseId,
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

    const supabaseId =
      'supabaseId' in supabaseUser ? supabaseUser.supabaseId : supabaseUser.id;
    const appUser = await getUserBySupabaseId(supabaseId);

    if (!appUser) {
      sendSingleError(res, 'User not found', 401);
      return;
    }

    const coach = await prisma.coach.findUnique({
      where: { userId: appUser.id },
    });
    const isCoach = !!coach;

    sendSuccess(res, {
      user: {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
        nickname: appUser.nickname,
        supabaseId: appUser.supabaseId,
      },
      isCoach,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('getMe error', { message: err.message, stack: err.stack });
    sendSingleError(res, 'Internal server error', 500);
  }
};

export const sendRecoveryEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email }: SendRecoveryEmailInput = req.body;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase(),
      {
        redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL,
      }
    );

    if (error) {
      logger.error('Password recovery email failed', { email, error });
      sendSingleError(res, 'Failed to send recovery email', 500);
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
    const { newPassword }: ResetPasswordInput = req.body;

    // The user is already authenticated via Bearer token (authenticateSupabaseUser middleware)
    // Use the access token from the Authorization header to set the Supabase session
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!accessToken) {
      sendSingleError(res, 'Access token is required', 400);
      return;
    }

    // Set the session so Supabase knows which user to update
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: '', // Not needed for password update
    });

    if (sessionError) {
      logger.error('Failed to set Supabase session for password reset', {
        error: sessionError,
      });
      sendSingleError(res, 'Invalid or expired token', 401);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      logger.error('Password reset failed', { error });
      sendSingleError(res, 'Failed to reset password', 500);
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
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { code }: ExchangeCodeInput = req.body;

    logger.debug('Exchanging auth code for session');

    // Exchange the code for a session using Supabase
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      logger.error('Code exchange failed', { error });
      sendSingleError(res, 'Invalid or expired code', 401);
      return;
    }

    const { session, user } = data;

    // Check if this user exists in our database
    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    sendSuccess(res, {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: appUser
        ? {
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            nickname: appUser.nickname,
            supabaseId: appUser.supabaseId,
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
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email }: CheckEmailVerifiedInput = req.body;

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
