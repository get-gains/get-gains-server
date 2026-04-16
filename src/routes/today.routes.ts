import { Router } from 'express';
import { getTodayStatus } from '../controllers/today.controller';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { attachSubscription } from '../middleware/subscription.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { GetTodayStatusSchema } from '../schemas/today.schema';

const router = Router();

/**
 * @route   GET /today
 * @desc    Unified home status (subscription + coach + standalone today)
 * @access  Protected
 */
router.get(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  attachSubscription,
  validateRequest(GetTodayStatusSchema),
  getTodayStatus
);

export default router;
