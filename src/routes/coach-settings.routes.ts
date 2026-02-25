import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import { UpdateCoachSettingsSchema } from '../schemas/coach-settings.schema';
import {
  getCoachSettings,
  updateCoachSettings,
} from '../controllers/coach-settings.controller';

const router = Router();

/**
 * @route   GET /coach/settings
 * @desc    Get coach's own settings (capacity, intake, discoverability)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get('/', authenticateSupabaseUser, requireCoach, getCoachSettings);

/**
 * @route   PATCH /coach/settings
 * @desc    Update coach's settings (maxClients, acceptingClients, isDiscoverable)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.patch(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateCoachSettingsSchema),
  updateCoachSettings
);

export default router;
