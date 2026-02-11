import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  GetExercisesSchema,
  CreateExerciseSchema,
  GetRoutinesSchema,
  GetRoutineByIdSchema,
  StartWorkoutSessionSchema,
  CompleteWorkoutSessionSchema,
  GetWorkoutSessionsSchema,
  GetWorkoutSessionByIdSchema,
  LogSetSchema,
  UpdateSetSchema,
  DeleteSetSchema,
  BatchSyncSetsSchema,
} from '../schemas/workout.schema';
import {
  getExercises,
  createExercise,
  getRoutines,
  getRoutineById,
  startWorkoutSession,
  getActiveSession,
  completeWorkoutSession,
  getWorkoutSessions,
  getWorkoutSessionById,
  logSet,
  updateSet,
  deleteSet,
  batchSyncSets,
} from '../controllers/workout.controller';

const router = Router();

// ============== Exercise Routes ==============

/**
 * @route   GET /workout/exercises
 * @desc    Get all exercises with optional filtering
 * @access  Protected
 */
router.get(
  '/exercises',
  authenticateSupabaseUser,
  validateRequest(GetExercisesSchema),
  getExercises
);

/**
 * @route   POST /workout/exercises
 * @desc    Create a new exercise (coach only)
 * @access  Protected (Coach)
 */
router.post(
  '/exercises',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateExerciseSchema),
  createExercise
);

// ============== Routine Routes ==============

/**
 * @route   GET /workout/routines
 * @desc    Get all routines for the authenticated user
 * @access  Protected
 */
router.get(
  '/routines',
  authenticateSupabaseUser,
  validateRequest(GetRoutinesSchema),
  getRoutines
);

/**
 * @route   GET /workout/routines/:routineId
 * @desc    Get a single routine by ID
 * @access  Protected
 */
router.get(
  '/routines/:routineId',
  authenticateSupabaseUser,
  validateRequest(GetRoutineByIdSchema),
  getRoutineById
);

// ============== Workout Session Routes ==============

/**
 * @route   POST /workout/sessions
 * @desc    Start a new workout session
 * @access  Protected
 */
router.post(
  '/sessions',
  authenticateSupabaseUser,
  validateRequest(StartWorkoutSessionSchema),
  startWorkoutSession
);

/**
 * @route   GET /workout/sessions/active
 * @desc    Get the user's active workout session
 * @access  Protected
 */
router.get('/sessions/active', authenticateSupabaseUser, getActiveSession);

/**
 * @route   GET /workout/sessions
 * @desc    Get workout session history
 * @access  Protected
 */
router.get(
  '/sessions',
  authenticateSupabaseUser,
  validateRequest(GetWorkoutSessionsSchema),
  getWorkoutSessions
);

/**
 * @route   GET /workout/sessions/:sessionId
 * @desc    Get a single workout session by ID
 * @access  Protected
 */
router.get(
  '/sessions/:sessionId',
  authenticateSupabaseUser,
  validateRequest(GetWorkoutSessionByIdSchema),
  getWorkoutSessionById
);

/**
 * @route   POST /workout/sessions/:sessionId/complete
 * @desc    Complete a workout session
 * @access  Protected
 */
router.post(
  '/sessions/:sessionId/complete',
  authenticateSupabaseUser,
  validateRequest(CompleteWorkoutSessionSchema),
  completeWorkoutSession
);

// ============== Performed Set Routes ==============

/**
 * @route   POST /workout/sets
 * @desc    Log a new set
 * @access  Protected
 */
router.post(
  '/sets',
  authenticateSupabaseUser,
  validateRequest(LogSetSchema),
  logSet
);

/**
 * @route   PUT /workout/sets/:setId
 * @desc    Update an existing set
 * @access  Protected
 */
router.put(
  '/sets/:setId',
  authenticateSupabaseUser,
  validateRequest(UpdateSetSchema),
  updateSet
);

/**
 * @route   DELETE /workout/sets/:setId
 * @desc    Delete a set
 * @access  Protected
 */
router.delete(
  '/sets/:setId',
  authenticateSupabaseUser,
  validateRequest(DeleteSetSchema),
  deleteSet
);

/**
 * @route   POST /workout/sets/sync
 * @desc    Batch sync sets from offline storage
 * @access  Protected
 */
router.post(
  '/sets/sync',
  authenticateSupabaseUser,
  validateRequest(BatchSyncSetsSchema),
  batchSyncSets
);

export default router;
