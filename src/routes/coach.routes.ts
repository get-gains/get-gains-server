import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  CreateCoachProfileSchema,
  VerifyCoachInviteSchema,
  GetClientsSchema,
  GetPerformanceSchema,
  GetClientProgramsSchema,
  UpdateAssignmentSchema,
  DeleteAssignmentSchema,
  GetClientSessionsSchema,
  GetClientSessionDetailSchema,
  GetClientWeeklyStatsSchema,
  GetClientExerciseHistorySchema,
  GetClientFormResultsSchema,
} from '../schemas/coach.schema';
import {
  createCoachProfile,
  getClients,
  getPerformance,
  getClientPrograms,
  updateAssignment,
  deleteAssignment,
  getClientSessions,
  getClientSessionDetail,
  getClientWeeklyStats,
  getClientExerciseHistory,
  getClientFormResults,
  getDetailedPerformance,
} from '../controllers/coach.controller';
import { verifyCoachInviteForUser } from '../controllers/admin.controller';
import classRoutes from './class.routes';
import programRoutes from './program.routes';
import routineTemplateRoutes from './routine.routes';

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

/**
 * @route   POST /coach/verify-invite
 * @desc    Verify a coach invitation code for the authenticated user
 * @access  Protected (authenticateSupabaseUser + requireAppUser)
 */
router.post(
  '/verify-invite',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(VerifyCoachInviteSchema),
  verifyCoachInviteForUser
);

router.use('/class', classRoutes);
// Program routes handles /clients/:clientId/programs, /programs/:programId, etc.
router.use('/', programRoutes);
// Routine templates: /routine-templates
router.use('/routine-templates', routineTemplateRoutes);

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
 * @route   GET /coach/clients/:userId/programs
 * @desc    List all program assignments for a specific client
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/programs',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientProgramsSchema),
  getClientPrograms
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
 * @route   PATCH /coach/assign-program/:assignmentId
 * @desc    Update assignment dates, notes, or active status
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.patch(
  '/assign-program/:assignmentId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateAssignmentSchema),
  updateAssignment
);

/**
 * @route   DELETE /coach/assign-program/:assignmentId
 * @desc    Delete a program assignment
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.delete(
  '/assign-program/:assignmentId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteAssignmentSchema),
  deleteAssignment
);

// ============== Client Progress Routes (GAP 1) ==============

/**
 * @route   GET /coach/clients/:userId/sessions
 * @desc    List a client's workout sessions (paginated)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/sessions',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientSessionsSchema),
  getClientSessions
);

/**
 * @route   GET /coach/clients/:userId/sessions/:sessionId
 * @desc    Get a client's workout session detail with performed sets
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/sessions/:sessionId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientSessionDetailSchema),
  getClientSessionDetail
);

/**
 * @route   GET /coach/clients/:userId/stats/weekly
 * @desc    Get a client's weekly stats with previous-week delta
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/stats/weekly',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientWeeklyStatsSchema),
  getClientWeeklyStats
);

/**
 * @route   GET /coach/clients/:userId/exercises/:exerciseId/history
 * @desc    Get exercise-level progress over time for a client
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/exercises/:exerciseId/history',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientExerciseHistorySchema),
  getClientExerciseHistory
);

/**
 * @route   GET /coach/clients/:userId/form-results
 * @desc    Get paginated form comparison results for a client
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/form-results',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientFormResultsSchema),
  getClientFormResults
);

// ============== Enhanced Performance Route (GAP 2) ==============

/**
 * @route   GET /coach/performance/detailed
 * @desc    Enhanced performance report with volume, adherence, trends
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/performance/detailed',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetPerformanceSchema),
  getDetailedPerformance
);

export default router;
