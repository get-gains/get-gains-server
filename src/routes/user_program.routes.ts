import { Router } from 'express';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createSelfProgram,
  listSelfPrograms,
  getSelfProgramById,
  updateSelfProgram,
  deleteSelfProgram,
  addSelfProgramRoutine,
  updateSelfProgramRoutine,
  deleteSelfProgramRoutine,
  addSelfProgramRoutineExercise,
  updateSelfProgramRoutineExercise,
  deleteSelfProgramRoutineExercise,
} from '../controllers/user_program.controller';
import {
  CreateSelfProgramSchema,
  GetSelfProgramsSchema,
  GetSelfProgramByIdSchema,
  UpdateSelfProgramSchema,
  DeleteSelfProgramSchema,
  AddSelfProgramRoutineSchema,
  UpdateSelfProgramRoutineSchema,
  DeleteSelfProgramRoutineSchema,
  AddSelfProgramRoutineExerciseSchema,
  UpdateSelfProgramRoutineExerciseSchema,
  DeleteSelfProgramRoutineExerciseSchema,
} from '../schemas/user_program.schema';

const router = Router();

// All routes require an authenticated user
router.use(authenticateSupabaseUser);
router.use(requireAppUser);

// User Programs CRUD
router.post('/', validateRequest(CreateSelfProgramSchema), createSelfProgram);
router.get('/', validateRequest(GetSelfProgramsSchema), listSelfPrograms);
router.get(
  '/:programId',
  validateRequest(GetSelfProgramByIdSchema),
  getSelfProgramById
);
router.patch(
  '/:programId',
  validateRequest(UpdateSelfProgramSchema),
  updateSelfProgram
);
router.delete(
  '/:programId',
  validateRequest(DeleteSelfProgramSchema),
  deleteSelfProgram
);

// Program Routines
router.post(
  '/:programId/routines',
  validateRequest(AddSelfProgramRoutineSchema),
  addSelfProgramRoutine
);
router.patch(
  '/:programId/routines/:aprId',
  validateRequest(UpdateSelfProgramRoutineSchema),
  updateSelfProgramRoutine
);
router.delete(
  '/:programId/routines/:aprId',
  validateRequest(DeleteSelfProgramRoutineSchema),
  deleteSelfProgramRoutine
);

// Program Routine Exercises
router.post(
  '/:programId/routines/:aprId/exercises',
  validateRequest(AddSelfProgramRoutineExerciseSchema),
  addSelfProgramRoutineExercise
);
router.patch(
  '/:programId/routines/:aprId/exercises/:apreId',
  validateRequest(UpdateSelfProgramRoutineExerciseSchema),
  updateSelfProgramRoutineExercise
);
router.delete(
  '/:programId/routines/:aprId/exercises/:apreId',
  validateRequest(DeleteSelfProgramRoutineExerciseSchema),
  deleteSelfProgramRoutineExercise
);

export default router;
