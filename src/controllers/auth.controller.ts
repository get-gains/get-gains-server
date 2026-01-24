import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { RegisterInput } from '../schemas/auth.schema';

// User registration handler
export const register = async (req: Request, res: Response): Promise<void> => {
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

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        nickname,
      },
    });

    logger.info('User registered successfully', { userId: user.id });

    const token = generateToken({ userId: user.id, email: user.email });

    sendSuccess(
      res,
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Registration error', error);
    sendSingleError(res, 'Internal server error', 500);
  }
};

//Google OAuth callback handler
export const googleCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;

    logger.info('Google OAuth login successful', { userId: user.id });

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
      },
    });
  } catch (error) {
    logger.error('Google callback error', error);
    sendSingleError(res, 'Internal server error', 500);
  }
};
