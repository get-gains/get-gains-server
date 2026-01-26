import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { GoogleSignInSchema, RegisterSchema } from '../schemas/auth.schema';
import {
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

router.get('/google', validateRequest(GoogleSignInSchema), signInWithGoogle);

/**
 * @route   GET /auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/link',
  validateRequest(CreateUserFromGoogleSchema),
  createUser
);

export default router;
