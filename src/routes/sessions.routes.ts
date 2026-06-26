import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { attachSubscription } from '../middleware/subscription.middleware';
import {
  SessionHistoryQuerySchema,
  SessionCalendarQuerySchema,
  SessionDetailParamsSchema,
} from '../schemas/sessions.schema';
import {
  getSessionHistory,
  getSessionCalendar,
  getSessionById,
} from '../controllers/sessions.controller';

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

/**
 * @route   GET /sessions/calendar?month=YYYY-MM
 * @desc    Get all completed sessions for a calendar month (both sources)
 * @access  Protected
 */
router.get(
  '/calendar',
  authenticateSupabaseUser,
  validateRequest(SessionCalendarQuerySchema),
  getSessionCalendar
);

/**
 * @route   GET /sessions/:sessionId
 * @desc    Get full session detail (coach or standalone) by ID
 * @access  Protected
 *
 * IMPORTANT: must be registered AFTER /history and /calendar so those
 * literal paths are matched before the :sessionId wildcard.
 */
router.get(
  '/:sessionId',
  authenticateSupabaseUser,
  validateRequest(SessionDetailParamsSchema),
  getSessionById
);

export default router;
