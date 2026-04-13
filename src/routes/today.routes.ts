import { Router } from 'express';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { attachSubscription } from '../middleware/subscription.middleware';
import { getTodayStatus } from '../controllers/today.controller';

const router = Router();

/**
 * @route   GET /api/today
 * @desc    Returns subscription state + coach today + standalone today in one response.
 *          Always 200 — never 403. App uses isSubscribed/hasCoach flags to branch UI.
 * @access  Protected (authenticateSupabaseUser + requireAppUser + attachSubscription)
 */
router.get(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  attachSubscription,
  getTodayStatus
);

export default router;
