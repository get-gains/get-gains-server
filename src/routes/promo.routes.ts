import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  CreatePromoCodeSchema,
  ListPromoCodesSchema,
  GetPromoCodeByIdSchema,
  DeactivatePromoCodeSchema,
  ValidatePromoCodeSchema,
  RedeemPromoCodeSchema,
} from '../schemas/promo.schema';
import {
  createPromoCode,
  listAllPromoCodes,
  getPromoCode,
  deactivatePromoCode,
  validatePromoCode,
  redeemPromoCode,
  getMyRedemptions,
} from '../controllers/promo.controller';

const router = Router();

// ============== User Routes ==============

/**
 * POST /api/promo/validate
 * Validate a promo code for the current user
 */
router.post(
  '/validate',
  authenticateSupabaseUser,
  validateRequest(ValidatePromoCodeSchema),
  validatePromoCode
);

/**
 * POST /api/promo/redeem
 * Redeem a promo code for the current user
 */
router.post(
  '/redeem',
  authenticateSupabaseUser,
  validateRequest(RedeemPromoCodeSchema),
  redeemPromoCode
);

/**
 * GET /api/promo/my-redemptions
 * Get user's promo code redemption history
 */
router.get('/my-redemptions', authenticateSupabaseUser, getMyRedemptions);

// ============== Admin Routes ==============
// Note: In production, these should have admin-only middleware

/**
 * POST /api/promo/admin
 * Create a new promo code (admin)
 */
router.post(
  '/admin',
  authenticateSupabaseUser,
  validateRequest(CreatePromoCodeSchema),
  createPromoCode
);

/**
 * GET /api/promo/admin
 * List all promo codes (admin)
 */
router.get(
  '/admin',
  authenticateSupabaseUser,
  validateRequest(ListPromoCodesSchema),
  listAllPromoCodes
);

/**
 * GET /api/promo/admin/:id
 * Get promo code details (admin)
 */
router.get(
  '/admin/:id',
  authenticateSupabaseUser,
  validateRequest(GetPromoCodeByIdSchema),
  getPromoCode
);

/**
 * DELETE /api/promo/admin/:id
 * Deactivate a promo code (admin)
 */
router.delete(
  '/admin/:id',
  authenticateSupabaseUser,
  validateRequest(DeactivatePromoCodeSchema),
  deactivatePromoCode
);

export default router;
