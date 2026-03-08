import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { attachSubscription } from '../middleware/subscription.middleware';
import { WeeklyStatsQuerySchema } from '../schemas/stats.schema';
import { getWeeklyStats } from '../controllers/stats.controller';

const router = Router();

/**
 * @route   GET /stats/weekly
 * @desc    Get unified weekly stats with per-source breakdown
 * @access  Protected (non-blocking subscription check)
 */
router.get(
  '/weekly',
  authenticateSupabaseUser,
  attachSubscription,
  validateRequest(WeeklyStatsQuerySchema),
  getWeeklyStats
);

export default router;
