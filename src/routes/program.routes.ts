import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  CreateProgramSchema,
  GetCoachProgramsSchema,
  GetCoachProgramByIdSchema,
  UpdateProgramSchema,
  DeleteProgramSchema,
  AssignRoutineSchema,
  UpdateProgramRoutineSchema,
  RemoveProgramRoutineSchema,
  addRoutineExerciseSchema,
  UpdateRoutineExerciseSchema,
  RemoveRoutineExerciseSchema,
} from '../schemas/program.schema';
import {
  createProgram,
  getCoachPrograms,
  getCoachProgramById,
  updateProgram,
  deleteProgram,
  assignRoutineToProgram,
  updateProgramRoutine,
  removeProgramRoutine,
  addExerciseToRoutine,
  updateRoutineExercise,
  removeRoutineExercise,
} from '../controllers/program.controller';

const router = Router();

// ============== Program CRUD ==============

/**
 * @route   GET /coach/programs
 * @desc    List all programs belonging to the coach
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachProgramsSchema),
  getCoachPrograms
);

/**
 * @route   POST /coach/programs
 * @desc    Create a new training program
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateProgramSchema),
  createProgram
);

/**
 * @route   GET /coach/programs/:programId
 * @desc    Get a single program with full routine/exercise tree
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachProgramByIdSchema),
  getCoachProgramById
);

/**
 * @route   PATCH /coach/programs/:programId
 * @desc    Update program name or description
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.patch(
  '/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateProgramSchema),
  updateProgram
);

/**
 * @route   DELETE /coach/programs/:programId
 * @desc    Delete a program (cascades to ProgramRoutine, NOT to Routines)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.delete(
  '/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteProgramSchema),
  deleteProgram
);

// ============== ProgramRoutine Junction ==============

/**
 * @route   POST /coach/programs/:programId/routines
 * @desc    Assign an existing routine to a program day
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/:programId/routines',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AssignRoutineSchema),
  assignRoutineToProgram
);

/**
 * @route   PATCH /coach/programs/:programId/routines/:programRoutineId
 * @desc    Reassign a routine to a different day number
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.patch(
  '/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateProgramRoutineSchema),
  updateProgramRoutine
);

/**
 * @route   DELETE /coach/programs/:programId/routines/:programRoutineId
 * @desc    Remove a routine from a program day slot (does NOT delete the Routine)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.delete(
  '/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(RemoveProgramRoutineSchema),
  removeProgramRoutine
);

// ============== RoutineExercise Junction ==============
// NOTE: These are scoped to /coach/programs/routines/... for historical reasons.
//       Exercise prescriptions on a specific routine within the program context.

/**
 * @route   POST /coach/programs/routines/:routineId/exercises
 * @desc    Add an exercise to a routine
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/routines/:routineId/exercises',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(addRoutineExerciseSchema),
  addExerciseToRoutine
);

/**
 * @route   PATCH /coach/programs/routines/:routineId/exercises/:routineExerciseId
 * @desc    Update exercise prescription (sets/reps/rest/order/notes)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.patch(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateRoutineExerciseSchema),
  updateRoutineExercise
);

/**
 * @route   DELETE /coach/programs/routines/:routineId/exercises/:routineExerciseId
 * @desc    Remove an exercise from a routine (does NOT delete the Exercise)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.delete(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(RemoveRoutineExerciseSchema),
  removeRoutineExercise
);

export default router;
