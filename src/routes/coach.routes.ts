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
  assignProgram,
  getClientPrograms,
  updateAssignment,
  deleteAssignment,
  getClientSessions,
  getClientSessionDetail,
  getClientWeeklyStats,
  getClientExerciseHistory,
  getDetailedPerformance,
  getClientFormResults,
} from '../controllers/coach.controller';
import classRoutes from './class.routes';
import programRoutes from './program.routes';
import routineRoutes from './routine.routes';
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
router.use('/routines', routineRoutes);
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

// ============== Client Form Results Route (GAP 3) ==============

/**
 * @route   GET /coach/clients/:userId/form-results
 * @desc    Get a client's form comparison result history
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/clients/:userId/form-results',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientFormResultsSchema),
  getClientFormResults
);

export default router;
