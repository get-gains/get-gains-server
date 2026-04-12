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
  CreatePersonalProgramSchema,
  GetPersonalProgramsSchema,
  GetPersonalProgramByIdSchema,
  UpdatePersonalProgramSchema,
  DeletePersonalProgramSchema,
  GetStandaloneTodaySchema,
  StartStandaloneSessionSchema,
  CompleteStandaloneSessionSchema,
  GetStandaloneSessionsSchema,
  GetStandaloneSessionByIdSchema,
  GetStandaloneWeeklyStatsSchema,
  CreateStandaloneAssignmentSchema,
  GetStandaloneAssignmentsSchema,
  GetStandaloneAssignmentByIdSchema,
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
  createPersonalProgram,
  getPersonalPrograms,
  getPersonalProgramById,
  updatePersonalProgram,
  deletePersonalProgram,
  createStandaloneAssignment,
  getStandaloneAssignments,
  getStandaloneAssignmentById,
  getStandaloneToday,
  startStandaloneSession,
  getStandaloneActiveSession,
  completeStandaloneSession,
  getStandaloneSessions,
  getStandaloneSessionById,
  getStandaloneWeeklyStats,
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
  '/programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreatePersonalProgramSchema),
  createPersonalProgram
);
router.get(
  '/programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalProgramsSchema),
  getPersonalPrograms
);
router.get(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPersonalProgramByIdSchema),
  getPersonalProgramById
);
router.patch(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdatePersonalProgramSchema),
  updatePersonalProgram
);
router.delete(
  '/programs/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeletePersonalProgramSchema),
  deletePersonalProgram
);

// ============== Assignment Routes ==============

router.post(
  '/assigned-programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreateStandaloneAssignmentSchema),
  createStandaloneAssignment
);
router.get(
  '/assigned-programs',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneAssignmentsSchema),
  getStandaloneAssignments
);
router.get(
  '/assigned-programs/:assignedProgramId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneAssignmentByIdSchema),
  getStandaloneAssignmentById
);

// ============== Today Route ==============

router.get(
  '/today',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneTodaySchema),
  getStandaloneToday
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

// ============== Stats Route ==============

router.get(
  '/stats/weekly',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetStandaloneWeeklyStatsSchema),
  getStandaloneWeeklyStats
);

export default router;
