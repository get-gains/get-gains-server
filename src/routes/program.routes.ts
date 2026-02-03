import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';

import {
  createProgram,
  assignRoutineToProgram,
  addExerciseToRoutine,
} from '../controllers/program.controller';

import {
  CreateProgramSchema,
  AssignRoutineSchema,
  addRoutineExerciseSchema,
} from '../schemas/program.schema';

const router = Router();

/**
 * @route   POST /programs
 * @desc    Create a workout program
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
 * @route   POST /programs/:programId/routines
 * @desc    Assign routine to program day
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
 * @route   POST /routines/:routineId/exercises
 * @desc    Add exercise to routine
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/routines/:routineId/exercises',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(addRoutineExerciseSchema),
  addExerciseToRoutine
);

export default router;
