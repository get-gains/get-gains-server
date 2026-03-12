import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/subscription.middleware';
import {
  ClassLeaderboardParamsSchema,
  ClassLeaderboardQuerySchema,
} from '../schemas/leaderboard.schema';
import {
  getClassLeaderboard,
  getMyCoaches,
} from '../controllers/leaderboard.controller';

const router = Router();

/**
 * @route   GET /api/leaderboard/class/:coachId
 * @desc    Get the class leaderboard for a specific coach
 * @access  Protected (auth + active subscription)
 */
router.get(
  '/class/:coachId',
  authenticateSupabaseUser,
  requireSubscription(),
  validateRequest(
    ClassLeaderboardParamsSchema.merge(ClassLeaderboardQuerySchema)
  ),
  getClassLeaderboard
);

/**
 * @route   GET /api/leaderboard/my-coaches
 * @desc    Get list of coaches the user is subscribed to (for coach picker)
 * @access  Protected (auth + active subscription)
 */
router.get(
  '/my-coaches',
  authenticateSupabaseUser,
  requireSubscription(),
  getMyCoaches
);

export default router;
