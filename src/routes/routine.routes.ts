import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  CreateRoutineSchema,
  GetCoachRoutinesSchema,
  GetCoachRoutineByIdSchema,
  UpdateRoutineSchema,
  DeleteRoutineSchema,
} from '../schemas/program.schema';
import {
  createRoutine,
  getCoachRoutines,
  getCoachRoutineById,
  updateRoutine,
  deleteRoutine,
} from '../controllers/program.controller';

const router = Router();

/**
 * @route   POST /coach/routines
 * @desc    Create a standalone reusable routine
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateRoutineSchema),
  createRoutine
);

/**
 * @route   GET /coach/routines
 * @desc    List all routines owned by the coach (for reuse selection)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachRoutinesSchema),
  getCoachRoutines
);

/**
 * @route   GET /coach/routines/:routineId
 * @desc    Get a single routine with its exercise list
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachRoutineByIdSchema),
  getCoachRoutineById
);

/**
 * @route   PATCH /coach/routines/:routineId
 * @desc    Update routine fields
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.patch(
  '/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateRoutineSchema),
  updateRoutine
);

/**
 * @route   DELETE /coach/routines/:routineId
 * @desc    Delete a routine (cascades to RoutineExercise, NOT to Exercises)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.delete(
  '/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteRoutineSchema),
  deleteRoutine
);

export default router;
