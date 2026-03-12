import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import {
  ShopCatalogQuerySchema,
  PurchaseBodySchema,
} from '../schemas/shop.schema';
import { getCatalog, purchaseCosmetic } from '../controllers/shop.controller';

const router = Router();

/**
 * @route   GET /api/shop/catalog
 * @desc    Browse the cosmetic shop catalog (filterable by tier/category)
 * @access  Protected
 */
router.get(
  '/catalog',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ShopCatalogQuerySchema),
  getCatalog
);

/**
 * @route   POST /api/shop/purchase
 * @desc    Purchase a cosmetic item (atomic balance deduction)
 * @access  Protected
 */
router.post(
  '/purchase',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(PurchaseBodySchema),
  purchaseCosmetic
);

export default router;
