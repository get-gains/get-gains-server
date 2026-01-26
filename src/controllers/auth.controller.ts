import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { GoogleSignInInput, RegisterInput } from '../schemas/auth.schema';
import supabase from '../config/supabase';
import { createUser } from './user.controller';
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

    // Generate JWT token
    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;
    const supabaseId = data.user.id;

    if (!accessToken || !refreshToken) {
      logger.error('Token generation failed during registration', { email });
      sendSingleError(res, 'Failed to generate token', 500);
      return;
    }

    const user = await createUser({ email, name, nickname, supabaseId });

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
