import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import {
  EquipBodySchema,
  UnequipBodySchema,
} from '../schemas/cosmetics.schema';
import {
  getInventory,
  equipCosmetic,
  unequipCosmetic,
  getEquipped,
} from '../controllers/cosmetics.controller';

const router = Router();

/**
 * @route   GET /api/cosmetics/inventory
 * @desc    Get all cosmetics owned by the current user with equipped state
 * @access  Protected
 */
router.get('/inventory', authenticateSupabaseUser, getInventory);

/**
 * @route   POST /api/cosmetics/equip
 * @desc    Equip a cosmetic in its category slot (replaces existing)
 * @access  Protected
 */
router.post(
  '/equip',
  authenticateSupabaseUser,
  validateRequest(EquipBodySchema),
  equipCosmetic
);

/**
 * @route   POST /api/cosmetics/unequip
 * @desc    Unequip a cosmetic from its category slot
 * @access  Protected
 */
router.post(
  '/unequip',
  authenticateSupabaseUser,
  validateRequest(UnequipBodySchema),
  unequipCosmetic
);

/**
 * @route   GET /api/cosmetics/equipped
 * @desc    Get currently equipped cosmetics (lightweight, for Unity widget)
 * @access  Protected
 */
router.get('/equipped', authenticateSupabaseUser, getEquipped);

export default router;
