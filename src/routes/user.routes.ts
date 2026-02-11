import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import {
  DiscoverCoachesSchema,
  GetSubscribedCoachesSchema,
  SubscribeCoachSchema,
  UnsubscribeCoachSchema,
  UpdateProfileSchema,
} from '../schemas/user.schema';
import {
  discoverCoaches,
  getSubscribedCoaches,
  subscribeToCoach,
  unsubscribeFromCoach,
  getProfile,
  updateProfile,
} from '../controllers/user.controller';

const router = Router();

/**
 * @route   GET /user/profile or /users/profile
 * @desc    Current user profile (Flutter app contract)
 * @access  Protected
 */
router.get('/profile', authenticateSupabaseUser, requireAppUser, getProfile);

/**
 * @route   PATCH /user/profile or /users/profile
 * @desc    Update current user profile
 * @access  Protected
 */
router.patch(
  '/profile',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateProfileSchema),
  updateProfile
);

router.put(
  '/profile',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateProfileSchema),
  updateProfile
);

/**
 * @route   GET /user/coaches
 * @desc    Discover/search coaches (public listing)
 * @access  Public (no auth required)
 */
router.get('/coaches', validateRequest(DiscoverCoachesSchema), discoverCoaches);

/**
 * @route   GET /user/coaches/subscribed
 * @desc    Get user's subscribed coaches
 * @access  Protected (authenticateSupabaseUser + requireAppUser)
 */
router.get(
  '/coaches/subscribed',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetSubscribedCoachesSchema),
  getSubscribedCoaches
);

/**
 * @route   POST /user/coaches/:coachId
 * @desc    Subscribe to a coach
 * @access  Protected (authenticateSupabaseUser + requireAppUser)
 */
router.post(
  '/coaches/:coachId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(SubscribeCoachSchema),
  subscribeToCoach
);

/**
 * @route   DELETE /user/coaches/:coachId
 * @desc    Unsubscribe from a coach
 * @access  Protected (authenticateSupabaseUser + requireAppUser)
 */
router.delete(
  '/coaches/:coachId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UnsubscribeCoachSchema),
  unsubscribeFromCoach
);

export default router;
