import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { attachSubscription } from '../middleware/subscription.middleware';
import {
  WeeklyStatsQuerySchema,
  MonthlyInsightQuerySchema,
} from '../schemas/stats.schema';
import {
  getWeeklyStats,
  getMonthlyInsight,
} from '../controllers/stats.controller';

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

/**
 * @route   GET /stats/monthly-insight
 * @desc    Get monthly training insight: avg volume/session, trend %, sparkline, exercise weight gains
 * @access  Protected
 */
router.get(
  '/monthly-insight',
  authenticateSupabaseUser,
  validateRequest(MonthlyInsightQuerySchema),
  getMonthlyInsight
);

export default router;
