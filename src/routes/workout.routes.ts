import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/subscription.middleware';
import {
  GetExercisesSchema,
  CreateExerciseSchema,
  UpdateExerciseSchema,
  DeleteExerciseSchema,
  GetRoutinesSchema,
  GetRoutineByIdSchema,
  GetTodayWorkoutSchema,
  StartWorkoutSessionSchema,
  CompleteWorkoutSessionSchema,
  GetWorkoutSessionsSchema,
  GetWorkoutSessionByIdSchema,
  LogSetSchema,
  UpdateSetSchema,
  DeleteSetSchema,
  BatchSyncSetsSchema,
  GetWeeklyStatsSchema,
} from '../schemas/workout.schema';
import {
  getExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  getRoutines,
  getRoutineById,
  getTodayWorkout,
  startWorkoutSession,
  getActiveSession,
  completeWorkoutSession,
  getWorkoutSessions,
  getWorkoutSessionById,
  logSet,
  updateSet,
  deleteSet,
  batchSyncSets,
  getWeeklyStats,
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

/**
 * @route   PATCH /workout/exercises/:exerciseId
 * @desc    Update an exercise (coach only, must own the exercise)
 * @access  Protected (Coach)
 */
router.patch(
  '/exercises/:exerciseId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateExerciseSchema),
  updateExercise
);

/**
 * @route   DELETE /workout/exercises/:exerciseId
 * @desc    Delete an exercise (coach only, must own the exercise)
 * @access  Protected (Coach)
 */
router.delete(
  '/exercises/:exerciseId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteExerciseSchema),
  deleteExercise
);

// ============== Routine Routes ==============

/**
 * @route   GET /workout/routines
 * @desc    Get all coach-assigned routines for the authenticated user
 * @access  Protected (requires active subscription)
 */
router.get(
  '/routines',
  authenticateSupabaseUser,
  requireSubscription(),
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
  requireSubscription(),
  validateRequest(GetRoutineByIdSchema),
  getRoutineById
);

// ============== Today's Workout Route ==============

/**
 * @route   GET /workout/today
 * @desc    Get the routine scheduled for today based on the user's active program
 * @access  Protected (requires active subscription)
 */
router.get(
  '/today',
  authenticateSupabaseUser,
  requireSubscription(),
  validateRequest(GetTodayWorkoutSchema),
  getTodayWorkout
);

// ============== Workout Session Routes ==============

/**
 * @route   POST /workout/sessions
 * @desc    Start a new workout session
 * @access  Protected (requires active subscription for coach-assigned programs)
 */
router.post(
  '/sessions',
  authenticateSupabaseUser,
  requireSubscription(),
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

// ============== Weekly Stats Route ==============

/**
 * @route   GET /workout/stats/weekly
 * @desc    Get weekly workout stats (workouts, minutes, streak)
 * @access  Protected
 */
router.get(
  '/stats/weekly',
  authenticateSupabaseUser,
  validateRequest(GetWeeklyStatsSchema),
  getWeeklyStats
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
