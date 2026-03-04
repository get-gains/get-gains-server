import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import {
  CreatePersonalExerciseSchema,
  GetPersonalExercisesSchema,
  UpdatePersonalExerciseSchema,
  DeletePersonalExerciseSchema,
  CreatePersonalRoutineSchema,
  GetPersonalRoutinesSchema,
  GetPersonalRoutineByIdSchema,
  UpdatePersonalRoutineSchema,
  DeletePersonalRoutineSchema,
  AddExerciseToRoutineSchema,
  UpdateRoutineExerciseSchema,
  RemoveRoutineExerciseSchema,
  CreatePersonalProgramSchema,
  GetPersonalProgramsSchema,
  GetPersonalProgramByIdSchema,
  UpdatePersonalProgramSchema,
  DeletePersonalProgramSchema,
  AssignRoutineToProgramSchema,
  UpdateProgramRoutineSchema,
  RemoveProgramRoutineSchema,
  ActivateProgramSchema,
  DeactivateProgramSchema,
  GetStandaloneTodaySchema,
  StartStandaloneSessionSchema,
  CompleteStandaloneSessionSchema,
  GetStandaloneSessionsSchema,
  GetStandaloneSessionByIdSchema,
  GetStandaloneWeeklyStatsSchema,
} from '../schemas/standalone.schema';
import {
  createPersonalExercise,
  getPersonalExercises,
  updatePersonalExercise,
  deletePersonalExercise,
  createPersonalRoutine,
  getPersonalRoutines,
  getPersonalRoutineById,
  updatePersonalRoutine,
  deletePersonalRoutine,
  addExerciseToRoutine,
  updateRoutineExercise,
  removeRoutineExercise,
  createPersonalProgram,
  getPersonalPrograms,
  getPersonalProgramById,
  updatePersonalProgram,
  deletePersonalProgram,
  assignRoutineToProgram,
  updateProgramRoutine,
  removeProgramRoutine,
  activateProgram,
  deactivateProgram,
  getActiveProgram,
  getStandaloneToday,
  startStandaloneSession,
  getStandaloneActiveSession,
  completeStandaloneSession,
  getStandaloneSessions,
  getStandaloneSessionById,
  getStandaloneWeeklyStats,
} from '../controllers/standalone.controller';

const router = Router();

// All standalone routes require authentication + app user, but NO coach and NO subscription

// ============== Personal Exercise Routes ==============

/**
 * @route   POST /api/standalone/exercises
 * @desc    Create a personal exercise (userId owned)
 * @access  Protected (user)
 */
router.post(
  '/exercises',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreatePersonalExerciseSchema),
  createPersonalExercise
);

/**
 * @route   GET /api/standalone/exercises
 * @desc    List user's exercises + public exercises
 * @access  Protected (user)
 */
router.get(
  '/exercises',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalExercisesSchema),
  getPersonalExercises
);

/**
 * @route   PATCH /api/standalone/exercises/:exerciseId
 * @desc    Update own exercise (ownership enforced)
 * @access  Protected (user)
 */
router.patch(
  '/exercises/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdatePersonalExerciseSchema),
  updatePersonalExercise
);

/**
 * @route   DELETE /api/standalone/exercises/:exerciseId
 * @desc    Delete own exercise (ownership enforced)
 * @access  Protected (user)
 */
router.delete(
  '/exercises/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeletePersonalExerciseSchema),
  deletePersonalExercise
);

// ============== Personal Routine Routes ==============

/**
 * @route   POST /api/standalone/routines
 * @desc    Create a personal routine
 * @access  Protected (user)
 */
router.post(
  '/routines',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreatePersonalRoutineSchema),
  createPersonalRoutine
);

/**
 * @route   GET /api/standalone/routines
 * @desc    List user's own routines (paginated)
 * @access  Protected (user)
 */
router.get(
  '/routines',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalRoutinesSchema),
  getPersonalRoutines
);

/**
 * @route   GET /api/standalone/routines/:routineId
 * @desc    Get single routine with exercises
 * @access  Protected (user)
 */
router.get(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalRoutineByIdSchema),
  getPersonalRoutineById
);

/**
 * @route   PATCH /api/standalone/routines/:routineId
 * @desc    Update routine metadata
 * @access  Protected (user)
 */
router.patch(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdatePersonalRoutineSchema),
  updatePersonalRoutine
);

/**
 * @route   DELETE /api/standalone/routines/:routineId
 * @desc    Delete routine (cascades RoutineExercise)
 * @access  Protected (user)
 */
router.delete(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeletePersonalRoutineSchema),
  deletePersonalRoutine
);

/**
 * @route   POST /api/standalone/routines/:routineId/exercises
 * @desc    Add exercise to routine
 * @access  Protected (user)
 */
router.post(
  '/routines/:routineId/exercises',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(AddExerciseToRoutineSchema),
  addExerciseToRoutine
);

/**
 * @route   PATCH /api/standalone/routines/:routineId/exercises/:routineExerciseId
 * @desc    Update exercise prescription (sets/reps/rest)
 * @access  Protected (user)
 */
router.patch(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateRoutineExerciseSchema),
  updateRoutineExercise
);

/**
 * @route   DELETE /api/standalone/routines/:routineId/exercises/:routineExerciseId
 * @desc    Remove exercise from routine
 * @access  Protected (user)
 */
router.delete(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(RemoveRoutineExerciseSchema),
  removeRoutineExercise
);

// ============== Personal Program Routes ==============

/**
 * @route   POST /api/standalone/programs
 * @desc    Create a personal program
 * @access  Protected (user)
 */
router.post(
  '/programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreatePersonalProgramSchema),
  createPersonalProgram
);

/**
 * @route   GET /api/standalone/programs
 * @desc    List user's own programs (paginated)
 * @access  Protected (user)
 */
router.get(
  '/programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalProgramsSchema),
  getPersonalPrograms
);

/**
 * @route   GET /api/standalone/programs/active
 * @desc    Get current active program assignment
 * @access  Protected (user)
 */
router.get(
  '/programs/active',
  authenticateSupabaseUser,
  requireAppUser,
  getActiveProgram
);

/**
 * @route   GET /api/standalone/programs/:programId
 * @desc    Get program with full routine tree
 * @access  Protected (user)
 */
router.get(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalProgramByIdSchema),
  getPersonalProgramById
);

/**
 * @route   PATCH /api/standalone/programs/:programId
 * @desc    Update program name/description
 * @access  Protected (user)
 */
router.patch(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdatePersonalProgramSchema),
  updatePersonalProgram
);

/**
 * @route   DELETE /api/standalone/programs/:programId
 * @desc    Delete program (cascades ProgramRoutine)
 * @access  Protected (user)
 */
router.delete(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeletePersonalProgramSchema),
  deletePersonalProgram
);

/**
 * @route   POST /api/standalone/programs/:programId/routines
 * @desc    Assign user's routine to program day
 * @access  Protected (user)
 */
router.post(
  '/programs/:programId/routines',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(AssignRoutineToProgramSchema),
  assignRoutineToProgram
);

/**
 * @route   PATCH /api/standalone/programs/:programId/routines/:programRoutineId
 * @desc    Update day number for program-routine
 * @access  Protected (user)
 */
router.patch(
  '/programs/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateProgramRoutineSchema),
  updateProgramRoutine
);

/**
 * @route   DELETE /api/standalone/programs/:programId/routines/:programRoutineId
 * @desc    Remove routine from program
 * @access  Protected (user)
 */
router.delete(
  '/programs/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(RemoveProgramRoutineSchema),
  removeProgramRoutine
);

// ============== Self-Assignment Routes ==============

/**
 * @route   POST /api/standalone/programs/:programId/activate
 * @desc    Self-assign / activate a personal program
 * @access  Protected (user)
 */
router.post(
  '/programs/:programId/activate',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ActivateProgramSchema),
  activateProgram
);

/**
 * @route   POST /api/standalone/programs/:programId/deactivate
 * @desc    Deactivate (set isActive: false)
 * @access  Protected (user)
 */
router.post(
  '/programs/:programId/deactivate',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeactivateProgramSchema),
  deactivateProgram
);

// ============== Today's Workout Route ==============

/**
 * @route   GET /api/standalone/today
 * @desc    Resolve today's routine from active standalone program
 * @access  Protected (user)
 */
router.get(
  '/today',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneTodaySchema),
  getStandaloneToday
);

// ============== Standalone Session Routes ==============

/**
 * @route   POST /api/standalone/sessions
 * @desc    Start a session (no subscription required)
 * @access  Protected (user)
 */
router.post(
  '/sessions',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(StartStandaloneSessionSchema),
  startStandaloneSession
);

/**
 * @route   GET /api/standalone/sessions/active
 * @desc    Get active session
 * @access  Protected (user)
 */
router.get(
  '/sessions/active',
  authenticateSupabaseUser,
  requireAppUser,
  getStandaloneActiveSession
);

/**
 * @route   GET /api/standalone/sessions
 * @desc    List past sessions (paginated)
 * @access  Protected (user)
 */
router.get(
  '/sessions',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneSessionsSchema),
  getStandaloneSessions
);

/**
 * @route   GET /api/standalone/sessions/:sessionId
 * @desc    Get session detail with sets
 * @access  Protected (user)
 */
router.get(
  '/sessions/:sessionId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneSessionByIdSchema),
  getStandaloneSessionById
);

/**
 * @route   POST /api/standalone/sessions/:sessionId/complete
 * @desc    Complete session
 * @access  Protected (user)
 */
router.post(
  '/sessions/:sessionId/complete',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CompleteStandaloneSessionSchema),
  completeStandaloneSession
);

// ============== Standalone Weekly Stats Route ==============

/**
 * @route   GET /api/standalone/stats/weekly
 * @desc    Weekly stats scoped to all user sessions
 * @access  Protected (user)
 */
router.get(
  '/stats/weekly',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneWeeklyStatsSchema),
  getStandaloneWeeklyStats
);

export default router;
