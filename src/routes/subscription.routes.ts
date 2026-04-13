import { Router } from 'express';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  GetPlansSchema,
  VerifyPurchaseSchema,
  GetSubscriptionStatusSchema,
  GetSubscriptionHistorySchema,
} from '../schemas/subscription.schema';
import {
  getPlans,
  getSubscriptionStatus,
  getSubscriptionHistory,
  verifyPurchase,
} from '../controllers/subscription.controller';

const router = Router();

// ============== Public Routes ==============

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', validateRequest(GetPlansSchema), getPlans);

// ============== Protected Routes ==============

/**
 * GET /api/subscriptions/status
 * Get current user's subscription status
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
 * Get user's subscription history
 */
router.get(
  '/history',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetSubscriptionHistorySchema),
  getSubscriptionHistory
);

/**
 * POST /api/subscriptions/verify
 * Verify a purchase from the client
 */
router.post(
  '/verify',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(VerifyPurchaseSchema),
  verifyPurchase
);

export default router;
