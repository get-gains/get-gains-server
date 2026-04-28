import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { ListMissionsRequestSchema } from '../schemas/missions.schema';
import { listMissions } from '../controllers/missions.controller';

const router = Router();

/**
 * @route   GET /api/missions
 * @desc    List active missions and current user progress
 * @access  Protected
 */
router.get(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ListMissionsRequestSchema),
  listMissions
);

export default router;
