import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  GetUserParams,
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
} from '../schemas/user.schema';
import bcrypt from 'bcryptjs';

/**
 * GET /users/:id
 * Retrieves a user by their ID
 */
export const getUser = async (
  req: Request<GetUserParams>,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  logger.debug('Fetching user', { id });

  try {
    // TODO: Replace with actual database query
    const user = {
      id,
      email: 'user@example.com',
      name: 'Sample User',
      createdAt: new Date().toISOString(),
    };

    logger.info('User fetched successfully', { id });
    sendSuccess(res, { user });
  } catch (error) {
    logger.error('Failed to fetch user', error);
    sendSingleError(res, 'Failed to fetch user', 500);
  }
};

/**
 * POST /users
 * Creates a new user
 */
export const createUser = async (
  req: Request<object, object, CreateUserBody>,
  res: Response
): Promise<void> => {
  const { email, password, name } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  logger.debug('Creating user', { email, name, hashedPassword });

  try {
    // TODO: Replace with actual database insert
    const newUser = {
      id: crypto.randomUUID(),
      email,
      name,
      createdAt: new Date().toISOString(),
    };

    logger.info('User created successfully', { id: newUser.id, email });
    sendSuccess(res, { user: newUser }, 201);
  } catch (error) {
    logger.error('Failed to create user', error);
    sendSingleError(res, 'Failed to create user', 500);
  }
};

/**
 * PUT /users/:id
 * Updates an existing user
 */
export const updateUser = async (
  req: Request<UpdateUserParams, object, UpdateUserBody>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const updates = req.body;

  logger.debug('Updating user', { id, updates });

  try {
    // TODO: Replace with actual database update
    const updatedUser = {
      id,
      email: updates.email ?? 'user@example.com',
      name: updates.name ?? 'Sample User',
      updatedAt: new Date().toISOString(),
    };

    logger.info('User updated successfully', { id });
    sendSuccess(res, { user: updatedUser });
  } catch (error) {
    logger.error('Failed to update user', error);
    sendSingleError(res, 'Failed to update user', 500);
  }
};

/**
 * DELETE /users/:id
 * Deletes a user by their ID
 */
export const deleteUser = async (
  req: Request<GetUserParams>,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  logger.debug('Deleting user', { id });

  try {
    // TODO: Replace with actual database delete
    logger.info('User deleted successfully', { id });
    sendSuccess(res, null, 204);
  } catch (error) {
    logger.error('Failed to delete user', error);
    sendSingleError(res, 'Failed to delete user', 500);
  }
};
