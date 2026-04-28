import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  CreateClientProgramSchema,
  GetClientActiveProgramSchema,
  GetProgramByIdSchema,
  UpdateClientProgramSchema,
  DeleteClientProgramSchema,
  AddProgramRoutineSchema,
  UpdateProgramRoutineSchema,
  DeleteProgramRoutineSchema,
  AddProgramRoutineExerciseSchema,
  UpdateProgramRoutineExerciseSchema,
  DeleteProgramRoutineExerciseSchema,
} from '../schemas/program.schema';
import {
  createClientProgram,
  getClientActiveProgram,
  getProgramById,
  updateClientProgram,
  deleteClientProgram,
  addProgramRoutine,
  updateProgramRoutine,
  deleteProgramRoutine,
  addProgramRoutineExercise,
  updateProgramRoutineExercise,
  deleteProgramRoutineExercise,
} from '../controllers/program.controller';

const router = Router();

// ============== Client Programs ==============

/**
 * @route POST /coach/clients/:clientId/programs
 * @desc  Create a new program for a client
 */
router.post(
  '/clients/:clientId/programs',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateClientProgramSchema),
  createClientProgram
);

/**
 * @route GET /coach/clients/:clientId/program
 * @desc  Get the active program for a client (or null)
 */
router.get(
  '/clients/:clientId/program',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientActiveProgramSchema),
  getClientActiveProgram
);

// ============== Program CRUD (by programId) ==============

/**
 * @route GET /coach/programs/:programId
 * @desc  Get program by ID with full tree
 */
router.get(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetProgramByIdSchema),
  getProgramById
);

/**
 * @route PATCH /coach/programs/:programId
 * @desc  Update program metadata (name, notes, active, dates)
 */
router.patch(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateClientProgramSchema),
  updateClientProgram
);

/**
 * @route DELETE /coach/programs/:programId
 * @desc  Soft-delete a program
 */
router.delete(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteClientProgramSchema),
  deleteClientProgram
);

// ============== Program Routines ==============

/**
 * @route POST /coach/programs/:programId/routines
 * @desc  Add a routine (from template or inline)
 */
router.post(
  '/programs/:programId/routines',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AddProgramRoutineSchema),
  addProgramRoutine
);

/**
 * @route PATCH /coach/programs/:programId/routines/:aprId
 * @desc  Update a routine within a program
 */
router.patch(
  '/programs/:programId/routines/:aprId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateProgramRoutineSchema),
  updateProgramRoutine
);

/**
 * @route DELETE /coach/programs/:programId/routines/:aprId
 * @desc  Soft-delete a routine from a program
 */
router.delete(
  '/programs/:programId/routines/:aprId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteProgramRoutineSchema),
  deleteProgramRoutine
);

// ============== Program Routine Exercises ==============

/**
 * @route POST /coach/programs/:programId/routines/:aprId/exercises
 * @desc  Add an exercise to a program routine
 */
router.post(
  '/programs/:programId/routines/:aprId/exercises',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AddProgramRoutineExerciseSchema),
  addProgramRoutineExercise
);

/**
 * @route PATCH /coach/programs/:programId/routines/:aprId/exercises/:apreId
 * @desc  Update an exercise within a program routine
 */
router.patch(
  '/programs/:programId/routines/:aprId/exercises/:apreId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateProgramRoutineExerciseSchema),
  updateProgramRoutineExercise
);

/**
 * @route DELETE /coach/programs/:programId/routines/:aprId/exercises/:apreId
 * @desc  Delete an exercise from a program routine
 */
router.delete(
  '/programs/:programId/routines/:aprId/exercises/:apreId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteProgramRoutineExerciseSchema),
  deleteProgramRoutineExercise
);

export default router;
