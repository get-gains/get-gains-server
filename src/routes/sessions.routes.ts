import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { attachSubscription } from '../middleware/subscription.middleware';
import { SessionHistoryQuerySchema } from '../schemas/sessions.schema';
import { getSessionHistory } from '../controllers/sessions.controller';

const router = Router();

/**
 * @route   GET /sessions/history
 * @desc    Get unified session history with source badges and filter support
 * @access  Protected (non-blocking subscription check)
 */
router.get(
  '/history',
  authenticateSupabaseUser,
  attachSubscription,
  validateRequest(SessionHistoryQuerySchema),
  getSessionHistory
);

export default router;
