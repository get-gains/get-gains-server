import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
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
router.get(
  '/inventory',
  authenticateSupabaseUser,
  requireAppUser,
  getInventory
);

/**
 * @route   POST /api/cosmetics/equip
 * @desc    Equip a cosmetic (FIFO slots; oldest unequipped when at max)
 * @access  Protected
 */
router.post(
  '/equip',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(EquipBodySchema),
  equipCosmetic
);

/**
 * @route   POST /api/cosmetics/unequip
 * @desc    Unequip a cosmetic by ID
 * @access  Protected
 */
router.post(
  '/unequip',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UnequipBodySchema),
  unequipCosmetic
);

/**
 * @route   GET /api/cosmetics/equipped
 * @desc    Get currently equipped cosmetics (lightweight, for Unity widget)
 * @access  Protected
 */
router.get('/equipped', authenticateSupabaseUser, requireAppUser, getEquipped);

export default router;
