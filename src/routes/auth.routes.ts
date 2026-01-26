import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { GoogleSignInSchema, RegisterSchema } from '../schemas/auth.schema';
import {
  refreshToken,
  registerWithEmailAndPassword,
  signInWithGoogle,
} from '../controllers/auth.controller';
import { CreateUserFromGoogleSchema } from '../schemas/user.schema';
import { createUser } from '../controllers/user.controller';

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
 * @route   POST /auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.post(
  '/google/link',
  validateRequest(CreateUserFromGoogleSchema),
  createUser
);

/**
 * @route   GET /auth/refresh
 * @desc    Refresh access token using authenticated user's session
 * @access  Protected
 */
router.get('/refresh', authenticateSupabaseUser, refreshToken);

export default router;
