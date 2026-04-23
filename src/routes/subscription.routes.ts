import { Router } from 'express';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  GetSubscriptionStatusSchema,
  GetSubscriptionHistorySchema,
} from '../schemas/subscription.schema';
import {
  getSubscriptionStatus,
  getSubscriptionHistory,
} from '../controllers/subscription.controller';

const router = Router();

// ============== Protected Routes ==============

/**
 * GET /api/subscriptions/status
 * Get current user's subscription status (RC-backed)
 */
router.get(
  '/status',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetSubscriptionStatusSchema),
  getSubscriptionStatus
);

/**
 * GET /api/subscriptions/history
 * Get user's subscription event history (RC-backed)
 */
router.get(
  '/history',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetSubscriptionHistorySchema),
  getSubscriptionHistory
);

export default router;
