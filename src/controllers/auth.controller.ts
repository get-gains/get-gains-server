import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
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

    // Create user in supabase
    const { data, error: supabaseError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
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

    const session = data.session;
    if (session?.access_token && session?.refresh_token) {
      const coach = await prisma.coach.findUnique({
        where: { userId: user.id },
      });
      sendSuccess(
        res,
        {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            nickname: user.nickname,
            supabaseId: user.supabaseId,
            isCoach: !!coach,
          },
        },
        201
      );
      return;
    }

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

/**
 * Refresh tokens using refresh token in body (Flutter app contract: POST /auth/refresh).
 */
export const refreshTokenWithBody = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken: refreshTokenValue }: RefreshTokenInput = req.body;

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
 * Refresh tokens using Bearer token (GET /auth/refresh).
 */
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

/**
 * Logout (optional, Flutter app contract). Client clears tokens locally.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, {}, 200);
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
        redirectTo: process.env.FLUTTER_RESET_PASSWORD_PAGE,
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
    const { accessToken, newPassword }: ResetPasswordInput = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      sendSingleError(res, 'Access token is required', 400);
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
