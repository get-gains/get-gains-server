import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import {
  GoogleSignInSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  SendRecoveryEmailSchema,
  RefreshTokenSchema,
} from '../schemas/auth.schema';
import {
  getMe,
  loginWithEmailAndPassword,
  refreshToken,
  registerWithEmailAndPassword,
  resetPassword,
  sendRecoveryEmail,
  signInWithGoogle,
  signInWithGoogleWithUserData,
} from '../controllers/auth.controller';

import { CreateUserFromGoogleSchema } from '../schemas/user.schema';
import { createUserFromGoogle } from '../controllers/user.controller';

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user with email and password
 * @access  Public
 */
router.post(
  '/register',
  validateRequest(RegisterSchema),
  registerWithEmailAndPassword
);

/**
 * @route   POST /auth/login
 * @desc    Login with email and password
 * @access  Public
 */

router.post('/google', validateRequest(GoogleSignInSchema), signInWithGoogle);

/**
 * @route   POST /auth/google/link
 * @desc    Link Google account by creating a new user
 * @access  Protected
 */
router.post(
  '/google/link',
  authenticateSupabaseUser,
  validateRequest(CreateUserFromGoogleSchema),
  createUserFromGoogle
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token in body)
 */
router.post('/refresh', validateRequest(RefreshTokenSchema), refreshToken);

/**
 * @route   GET /auth/me
 * @desc    Get current user and isCoach status
 * @access  Protected (authenticateSupabaseUser only)
 */
router.get('/me', authenticateSupabaseUser, getMe);

/**
 * @route POST /auth/login
 * @desc  Login user and return tokens
 * @access Public
 */
router.post('/login', validateRequest(LoginSchema), loginWithEmailAndPassword);

/**
 * @route POST /auth/login/google
 * @desc  Login user and return tokens
 * @access Public
 */
router.post(
  '/login/google',
  validateRequest(GoogleSignInSchema),
  signInWithGoogleWithUserData
);

/**
 * @route   POST /auth/send-recovery-email
 * @desc    Send password recovery email
 * @access  Public
 */
router.post(
  '/send-recovery-email',
  validateRequest(SendRecoveryEmailSchema),
  sendRecoveryEmail
);

/** * @route   POST /auth/reset-password
 * @desc    Reset user password
 * @access  Protected
 */
router.post(
  '/reset-password',
  authenticateSupabaseUser,
  validateRequest(ResetPasswordSchema),
  resetPassword
);

export default router;
