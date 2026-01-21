import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { logger } from './logger';
import type { StringValue } from 'ms';

/**
 * JWT payload structure for our tokens
 */
export interface TokenPayload {
  userId: number;
  email: string;
}

/**
 * Decoded token with standard JWT claims
 */
export interface DecodedToken extends TokenPayload, JwtPayload {}

/**
 * Get JWT secret from environment
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
};

/**
 * Get JWT expiration from environment (default: 7 days)
 */
const getJwtExpiration = (): StringValue => {
  return (process.env.JWT_EXPIRATION || '7d') as StringValue;
};

/**
 * Generate a JWT access token
 */
export const generateToken = (payload: TokenPayload): string => {
  const secret = getJwtSecret();
  const options: SignOptions = {
    expiresIn: getJwtExpiration(),
  };

  logger.debug('Generating JWT token', { userId: payload.userId });
  return jwt.sign(payload, secret, options);
};

/**
 * Verify and decode a JWT token
 * Returns null if the token is invalid or expired
 */
export const verifyToken = (token: string): DecodedToken | null => {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as DecodedToken;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('JWT token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid JWT token');
    } else {
      logger.error('JWT verification error', error);
    }
    return null;
  }
};

/**
 * Extract token from Authorization header
 * Expects format: "Bearer <token>"
 */
export const extractTokenFromHeader = (
  authHeader: string | undefined
): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
};
