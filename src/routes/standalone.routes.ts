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
  CreateStandaloneProgramSchema,
  GetStandaloneProgramsSchema,
  GetStandaloneProgramByIdSchema,
  UpdateStandaloneProgramSchema,
  DeleteStandaloneProgramSchema,
  ActivateStandaloneProgramSchema,
  AddStandaloneProgramRoutineSchema,
  UpdateStandaloneProgramRoutineSchema,
  DeleteStandaloneProgramRoutineSchema,
  AddStandaloneRoutineExerciseSchema,
  UpdateStandaloneRoutineExerciseSchema,
  DeleteStandaloneRoutineExerciseSchema,
  BuildStandaloneProgramSchema,
  StartStandaloneSessionSchema,
  CompleteStandaloneSessionSchema,
  GetStandaloneSessionsSchema,
  GetStandaloneSessionByIdSchema,
  LogStandaloneSetSchema,
  UpdateStandaloneSetSchema,
  DeleteStandaloneSetSchema,
  GetStandaloneStatsSchema,
  GetStandaloneExerciseStatSchema,
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
  createStandaloneProgram,
  getStandalonePrograms,
  getActiveStandaloneProgram,
  getStandaloneProgramById,
  updateStandaloneProgram,
  deleteStandaloneProgram,
  activateStandaloneProgram,
  deactivateStandaloneProgram,
  buildStandaloneProgram,
  addStandaloneProgramRoutine,
  updateStandaloneProgramRoutine,
  deleteStandaloneProgramRoutine,
  addStandaloneRoutineExercise,
  updateStandaloneRoutineExercise,
  deleteStandaloneRoutineExercise,
  startStandaloneSession,
  getStandaloneActiveSession,
  completeStandaloneSession,
  getStandaloneSessions,
  getStandaloneSessionById,
  logStandaloneSet,
  updateStandaloneSet,
  deleteStandaloneSet,
  getStandaloneStats,
  getStandaloneExerciseStat,
} from '../controllers/standalone.controller';

const router = Router();

// ============== Exercise Routes ==============

router.post(
  '/exercises',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreatePersonalExerciseSchema),
  createPersonalExercise
);
router.get(
  '/exercises',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalExercisesSchema),
  getPersonalExercises
);
router.patch(
  '/exercises/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdatePersonalExerciseSchema),
  updatePersonalExercise
);
router.delete(
  '/exercises/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeletePersonalExerciseSchema),
  deletePersonalExercise
);

// ============== Routine Routes ==============

router.post(
  '/routines',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreatePersonalRoutineSchema),
  createPersonalRoutine
);
router.get(
  '/routines',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalRoutinesSchema),
  getPersonalRoutines
);
router.get(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalRoutineByIdSchema),
  getPersonalRoutineById
);
router.patch(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdatePersonalRoutineSchema),
  updatePersonalRoutine
);
router.delete(
  '/routines/:routineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeletePersonalRoutineSchema),
  deletePersonalRoutine
);

// ============== Program Routes ==============

router.post(
  '/programs/build',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(BuildStandaloneProgramSchema),
  buildStandaloneProgram
);

router.get(
  '/programs/active',
  authenticateSupabaseUser,
  requireAppUser,
  getActiveStandaloneProgram
);

router.post(
  '/programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreateStandaloneProgramSchema),
  createStandaloneProgram
);
router.get(
  '/programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneProgramsSchema),
  getStandalonePrograms
);
router.get(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneProgramByIdSchema),
  getStandaloneProgramById
);
router.patch(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateStandaloneProgramSchema),
  updateStandaloneProgram
);
router.delete(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeleteStandaloneProgramSchema),
  deleteStandaloneProgram
);

router.post(
  '/programs/:programId/activate',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ActivateStandaloneProgramSchema),
  activateStandaloneProgram
);
router.post(
  '/programs/:programId/deactivate',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ActivateStandaloneProgramSchema),
  deactivateStandaloneProgram
);

// ============== Program Routine Routes ==============

router.post(
  '/programs/:programId/routines',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(AddStandaloneProgramRoutineSchema),
  addStandaloneProgramRoutine
);
router.patch(
  '/programs/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateStandaloneProgramRoutineSchema),
  updateStandaloneProgramRoutine
);
router.delete(
  '/programs/:programId/routines/:programRoutineId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeleteStandaloneProgramRoutineSchema),
  deleteStandaloneProgramRoutine
);

// ============== Routine Exercise Routes ==============

router.post(
  '/routines/:routineId/exercises',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(AddStandaloneRoutineExerciseSchema),
  addStandaloneRoutineExercise
);
router.patch(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateStandaloneRoutineExerciseSchema),
  updateStandaloneRoutineExercise
);
router.delete(
  '/routines/:routineId/exercises/:routineExerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeleteStandaloneRoutineExerciseSchema),
  deleteStandaloneRoutineExercise
);

// ============== Session Routes ==============

router.post(
  '/sessions',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(StartStandaloneSessionSchema),
  startStandaloneSession
);
router.get(
  '/sessions/active',
  authenticateSupabaseUser,
  requireAppUser,
  getStandaloneActiveSession
);
router.get(
  '/sessions',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneSessionsSchema),
  getStandaloneSessions
);
router.get(
  '/sessions/:sessionId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneSessionByIdSchema),
  getStandaloneSessionById
);
router.post(
  '/sessions/:sessionId/complete',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CompleteStandaloneSessionSchema),
  completeStandaloneSession
);

// ============== Performed Set Routes ==============

router.post(
  '/sessions/:sessionId/sets',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(LogStandaloneSetSchema),
  logStandaloneSet
);
router.patch(
  '/sessions/:sessionId/sets/:setId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateStandaloneSetSchema),
  updateStandaloneSet
);
router.delete(
  '/sessions/:sessionId/sets/:setId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeleteStandaloneSetSchema),
  deleteStandaloneSet
);

// ============== Stats Routes ==============

router.get(
  '/stats/summary',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneStatsSchema),
  getStandaloneStats
);
router.get(
  '/stats/exercise/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneExerciseStatSchema),
  getStandaloneExerciseStat
);

export default router;
