import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import {
  GoogleSignInSchema,
  LoginSchema,
  RegisterSchema,
} from '../schemas/auth.schema';
import {
  loginWithEmailAndPassword,
  refreshToken,
  registerWithEmailAndPassword,
  signInWithGoogle,
  signInWithGoogleWithUserData,
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
 * @route   POST /auth/google/link
 * @desc    Link Google account by creating a new user
 * @access  Protected
 */
router.post(
  '/google/link',
  authenticateSupabaseUser,
  validateRequest(CreateUserFromGoogleSchema),
  createUser
);

/**
 * @route   GET /auth/refresh
 * @desc    Refresh access token using authenticated user's session
 * @access  Protected
 */
router.get('/refresh', authenticateSupabaseUser, refreshToken);

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
export default router;
