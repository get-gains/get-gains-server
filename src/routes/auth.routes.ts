import { Router } from 'express';
import passport from 'passport';
import { register, googleCallback } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateGoogle } from '../middleware/auth.middleware';
import { RegisterSchema } from '../schemas/auth.schema';

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user with email and password
 * @access  Public
 */
router.post('/register', validateRequest(RegisterSchema), register);

/**
 * @route   POST /auth/login
 * @desc    Login with email and password
 * @access  Public
 */

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * @route   GET /auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', authenticateGoogle, googleCallback);

export default router;
