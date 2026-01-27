import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  CreateUserData,
  CreateUserFromGoogleData,
} from '../schemas/user.schema';

export const createUser = async (data: CreateUserData) => {
  const { email, name, nickname, supabaseId } = data;
  // Create user in database
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      nickname,
      supabaseId,
    },
  });

  return user;
};

export const getUserBySupabaseId = async (supabaseId: string) => {
  return await prisma.user.findUnique({
    where: { supabaseId },
  });
};

/**
 * Create user from Google OAuth (route handler)
 *
 * Used to complete Google sign-up by creating a user profile.
 * The user has already authenticated with Google and has tokens.
 */
export const createUserFromGoogle = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, name, nickname, supabaseId }: CreateUserFromGoogleData =
      req.body;

    logger.debug('Creating user from Google OAuth', { email, supabaseId });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      logger.debug('User already exists', { email });
      sendSingleError(res, 'User already exists', 409, 'email');
      return;
    }

    // Also check by supabaseId
    const existingBySupabase = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (existingBySupabase) {
      logger.debug('User already exists with this Supabase ID', { supabaseId });
      sendSingleError(res, 'User already exists', 409);
      return;
    }

    // Create user
    const user = await createUser({ email, name, nickname, supabaseId });

    logger.info('User created from Google OAuth', {
      userId: user.id,
      email: user.email,
    });

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
    logger.error('Error creating user from Google', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};
