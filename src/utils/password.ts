import bcrypt from 'bcryptjs';
import { logger } from './logger';

/**
 * Number of salt rounds for bcrypt hashing
 * Higher = more secure but slower
 */
const SALT_ROUNDS = 12;

/**
 * Hash a plain text password
 */
export const hashPassword = async (password: string): Promise<string> => {
  logger.debug('Hashing password');
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain text password with a hashed password
 */
export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  logger.debug('Comparing password');
  return bcrypt.compare(plainPassword, hashedPassword);
};
