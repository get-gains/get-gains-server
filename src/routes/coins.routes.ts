import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { CoinHistoryQuerySchema } from '../schemas/coins.schema';
import { getBalance, getHistory } from '../controllers/coins.controller';

const router = Router();

/**
 * @route   GET /api/coins/balance
 * @desc    Get the current user's coin balance
 * @access  Protected
 */
router.get('/balance', authenticateSupabaseUser, getBalance);

/**
 * @route   GET /api/coins/history
 * @desc    Get the current user's coin transaction history (paginated)
 * @access  Protected
 */
router.get(
  '/history',
  authenticateSupabaseUser,
  validateRequest(CoinHistoryQuerySchema),
  getHistory
);

export default router;
