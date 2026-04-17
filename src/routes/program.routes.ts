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
  CreateRoutineSchema,
  GetCoachRoutinesSchema,
  GetCoachRoutineByIdSchema,
  UpdateRoutineSchema,
  DeleteRoutineSchema,
  AssignRoutineToProgramSchema,
  UpdateProgramRoutineSchema,
  RemoveProgramRoutineSchema,
  AddRoutineExerciseSchema,
  UpdateRoutineExerciseSchema,
  DeleteRoutineExerciseSchema,
  AssignProgramSchema,
} from '../schemas/program.schema';
import {
  createProgram,
  getCoachPrograms,
  getCoachProgramById,
  updateProgram,
  deleteProgram,
  createRoutine,
  getCoachRoutines,
  getCoachRoutineById,
  updateRoutine,
  deleteRoutine,
  assignRoutineToProgram,
  updateProgramRoutine,
  removeProgramRoutine,
  addRoutineExercise,
  updateRoutineExercise,
  deleteRoutineExercise,
  assignProgram,
} from '../controllers/program.controller';

const router = Router();

// ============== Program CRUD ==============

router.get(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachProgramsSchema),
  getCoachPrograms
);
router.post(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateProgramSchema),
  createProgram
);
router.get(
  '/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachProgramByIdSchema),
  getCoachProgramById
);
router.patch(
  '/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateProgramSchema),
  updateProgram
);
router.delete(
  '/:programId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteProgramSchema),
  deleteProgram
);

// ============== Assignment ==============

router.post(
  '/:programId/routines',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AssignRoutineToProgramSchema),
  assignRoutineToProgram
);
router.patch(
  '/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateProgramRoutineSchema),
  updateProgramRoutine
);
router.delete(
  '/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(RemoveProgramRoutineSchema),
  removeProgramRoutine
);

router.post(
  '/routines/:routineId/exercises',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AddRoutineExerciseSchema),
  addRoutineExercise
);
router.patch(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateRoutineExerciseSchema),
  updateRoutineExercise
);
router.delete(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteRoutineExerciseSchema),
  deleteRoutineExercise
);

router.post(
  '/:programId/assign',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AssignProgramSchema),
  assignProgram
);

// ============== Routine CRUD (under /coach/programs/routines) ==============

router.post(
  '/routines',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateRoutineSchema),
  createRoutine
);
router.get(
  '/routines',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachRoutinesSchema),
  getCoachRoutines
);
router.get(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachRoutineByIdSchema),
  getCoachRoutineById
);
router.patch(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateRoutineSchema),
  updateRoutine
);
router.delete(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteRoutineSchema),
  deleteRoutine
);

export default router;
