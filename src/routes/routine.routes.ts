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

router.post(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(CreateRoutineSchema),
  createRoutine
);
router.get(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachRoutinesSchema),
  getCoachRoutines
);
router.get(
  '/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetCoachRoutineByIdSchema),
  getCoachRoutineById
);
router.patch(
  '/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateRoutineSchema),
  updateRoutine
);
router.delete(
  '/:routineId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(DeleteRoutineSchema),
  deleteRoutine
);

export default router;
