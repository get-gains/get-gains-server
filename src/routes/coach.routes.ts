import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  CreateCoachProfileSchema,
  GetClientsSchema,
  GetPerformanceSchema,
  AssignProgramSchema,
} from '../schemas/coach.schema';
import {
  createCoachProfile,
  getClients,
  getPerformance,
  assignProgram,
} from '../controllers/coach.controller';
import classRoutes from './class.routes';
import programRoutes from './program.routes';
import coachSettingsRoutes from './coach-settings.routes';

const router = Router();

/**
 * @route   POST /coach/profile
 * @desc    Create coach profile (become a coach). No requireCoach.
 * @access  Protected (authenticateSupabaseUser only)
 */
router.post(
  '/profile',
  authenticateSupabaseUser,
  validateRequest(CreateCoachProfileSchema),
  createCoachProfile
);

router.use('/class', classRoutes);
router.use('/programs', programRoutes);
router.use('/settings', coachSettingsRoutes);

/**
 * @route   GET /coach/clients
 * @desc    List clients with filters (assigned / unassigned)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientsSchema),
  getClients
);

/**
 * @route   GET /coach/performance
 * @desc    Get performance report (good / falling behind)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/performance',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetPerformanceSchema),
  getPerformance
);

/**
 * @route   POST /coach/assign-program
 * @desc    Assign program to client
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/assign-program',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AssignProgramSchema),
  assignProgram
);

export default router;
