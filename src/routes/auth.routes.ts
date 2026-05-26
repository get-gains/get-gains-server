import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import {
  CheckEmailVerifiedSchema,
  GoogleSignInSchema,
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  ResetPasswordWithOtpSchema,
  SendOtpSchema,
  VerifyOtpSchema,
} from '../schemas/auth.schema';
import {
  checkEmailVerified,
  getMe,
  loginWithEmailAndPassword,
  refreshToken,
  registerWithEmailAndPassword,
  resetPasswordWithOtp,
  sendOtp,
  signInWithGoogle,
  signInWithGoogleWithUserData,
  verifyOtpHandler,
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
 * @route   POST /auth/send-otp
 * @desc    Send a 6-character password reset code via email
 * @access  Public
 */
router.post('/send-otp', validateRequest(SendOtpSchema), sendOtp);

/**
 * @route   POST /auth/verify-otp
 * @desc    Verify password reset OTP code and get a reset token
 * @access  Public
 */
router.post('/verify-otp', validateRequest(VerifyOtpSchema), verifyOtpHandler);

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using OTP-derived reset token
 * @access  Public
 */
router.post(
  '/reset-password',
  validateRequest(ResetPasswordWithOtpSchema),
  resetPasswordWithOtp
);

/**
 * @route   POST /auth/check-email-verified
 * @desc    Check if user's email is verified
 * @access  Public
 */
router.post(
  '/check-email-verified',
  validateRequest(CheckEmailVerifiedSchema),
  checkEmailVerified
);

export default router;
