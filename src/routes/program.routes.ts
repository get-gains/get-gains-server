import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';

import {
  createProgram,
  assignRoutineToProgram,
  addExerciseToRoutine,
} from '../controllers/program.controller';

import {
  createProgramSchema,
  assignRoutineSchema,
  addRoutineExerciseSchema,
} from '../schemas/program.schema';

const router = Router();

/**
 * @route   POST /programs
 * @desc    Create a workout program
 * @access  Protected
 */
router.post(
  '/',
  authenticateSupabaseUser,
  validateRequest(createProgramSchema),
  createProgram
);

/**
 * @route   POST /programs/:programId/routines
 * @desc    Assign routine to program day
 * @access  Protected
 */
router.post(
  '/:programId/routines',
  authenticateSupabaseUser,
  validateRequest(assignRoutineSchema),
  assignRoutineToProgram
);

/**
 * @route   POST /routines/:routineId/exercises
 * @desc    Add exercise to routine
 * @access  Protected
 */
router.post(
  '/routines/:routineId/exercises',
  authenticateSupabaseUser,
  validateRequest(addRoutineExerciseSchema),
  addExerciseToRoutine
);

export default router;
