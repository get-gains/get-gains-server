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
} from '../schemas/user.schema';
import {
  discoverCoaches,
  getSubscribedCoaches,
  subscribeToCoach,
  unsubscribeFromCoach,
} from '../controllers/user.controller';

const router = Router();

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
