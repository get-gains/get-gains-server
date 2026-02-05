import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import { GetClassSchema, RemoveClientSchema } from '../schemas/class.schema';
import { getClass, removeClient } from '../controllers/class.controller';

const router = Router();

/**
 * @route   GET /coach/class
 * @desc    List coach's clients (roster)
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.get(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClassSchema),
  getClass
);

/**
 * @route   DELETE /coach/class/:userId
 * @desc    Remove client from class
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.delete(
  '/:userId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(RemoveClientSchema),
  removeClient
);

export default router;
