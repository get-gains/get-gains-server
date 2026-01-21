import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import bcrypt from 'bcryptjs';
import prisma from './database';
import { logger } from '../utils/logger';
import { TokenPayload } from '../utils/jwt';

/**
 * Local Strategy - Email & Password authentication
 *
 * Used for traditional login with email and password.
 * Validates credentials against the database.
 */
const localStrategy = new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email, password, done) => {
    try {
      logger.debug('Local strategy: Authenticating user', { email });

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        logger.debug('Local strategy: User not found', { email });
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.debug('Local strategy: Invalid password', { email });
        return done(null, false, { message: 'Invalid email or password' });
      }

      logger.debug('Local strategy: Authentication successful', {
        userId: user.id,
      });
      return done(null, user);
    } catch (error) {
      logger.error('Local strategy error', error);
      return done(error);
    }
  }
);

/**
 * Google OAuth Strategy - Sign in with Google
 *
 * Used for OAuth authentication with Google.
 * Creates a new user if they don't exist, or links to existing user.
 */
const getGoogleStrategy = (): GoogleStrategy | null => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    logger.warn(
      'Google OAuth credentials not configured. Google authentication will be disabled.'
    );
    return null;
  }

  return new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done
    ) => {
      try {
        logger.debug('Google strategy: Processing OAuth callback', {
          googleId: profile.id,
        });

        const email = profile.emails?.[0]?.value;
        if (!email) {
          logger.warn('Google strategy: No email in profile');
          return done(null, false, {
            message: 'No email associated with Google account',
          });
        }

        // Check if user exists
        let user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) {
          // Create new user from Google profile
          logger.debug(
            'Google strategy: Creating new user from Google profile',
            {
              email,
            }
          );

          // Generate a random password for OAuth users (they won't use it)
          const randomPassword = await bcrypt.hash(
            Math.random().toString(36).slice(-16),
            12
          );

          user = await prisma.user.create({
            data: {
              email: email.toLowerCase(),
              password: randomPassword,
              name: profile.displayName || email.split('@')[0],
              nickname: profile.name?.givenName || email.split('@')[0],
            },
          });

          logger.info('Google strategy: New user created', { userId: user.id });
        } else {
          logger.debug('Google strategy: Existing user found', {
            userId: user.id,
          });
        }

        return done(null, user);
      } catch (error) {
        logger.error('Google strategy error', error);
        return done(error);
      }
    }
  );
};

/**
 * JWT Strategy - Bearer Token authentication
 *
 * Used for protecting routes with JWT tokens.
 * Validates the token and attaches user to request.
 */
const getJwtStrategy = (): JwtStrategy => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const options: StrategyOptionsWithoutRequest = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret,
  };

  return new JwtStrategy(options, async (payload: TokenPayload, done) => {
    try {
      logger.debug('JWT strategy: Validating token', {
        userId: payload.userId,
      });

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        logger.debug('JWT strategy: User not found', {
          userId: payload.userId,
        });
        return done(null, false);
      }

      logger.debug('JWT strategy: Token valid', { userId: user.id });
      return done(null, user);
    } catch (error) {
      logger.error('JWT strategy error', error);
      return done(error);
    }
  });
};

/**
 * Initialize and configure Passport with all strategies
 */
export const initializePassport = (): void => {
  logger.info('Initializing Passport authentication strategies');

  // Register Local Strategy
  passport.use('local', localStrategy);
  logger.debug('Registered Local strategy');

  // Register Google Strategy (if configured)
  const googleStrategy = getGoogleStrategy();
  if (googleStrategy) {
    passport.use('google', googleStrategy);
    logger.debug('Registered Google OAuth strategy');
  }

  // Register JWT Strategy
  passport.use('jwt', getJwtStrategy());
  logger.debug('Registered JWT strategy');

  logger.info('Passport initialization complete');
};

export default passport;
