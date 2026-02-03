import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  GetClassSchema,
  AddClientSchema,
  RemoveClientSchema,
} from '../schemas/class.schema';
import {
  getClass,
  addClient,
  removeClient,
} from '../controllers/class.controller';

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
 * @route   POST /coach/class
 * @desc    Add client to class
 * @access  Protected (authenticateSupabaseUser + requireCoach)
 */
router.post(
  '/',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(AddClientSchema),
  addClient
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
