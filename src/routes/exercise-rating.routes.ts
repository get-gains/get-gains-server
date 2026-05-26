import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import {
  CreateRatingSchema,
  DeleteRatingSchema,
} from '../schemas/exercise-rating.schema';
import {
  rateExercise,
  removeRating,
} from '../controllers/exercise-rating.controller';

const router = Router();

/**
 * @route   POST /exercise-ratings
 * @desc    Rate an exercise with a thumbs-up (idempotent)
 * @access  Protected
 */
router.post(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreateRatingSchema),
  rateExercise
);

/**
 * @route   DELETE /exercise-ratings/:exerciseId
 * @desc    Remove a thumbs-up rating from an exercise (idempotent)
 * @access  Protected
 */
router.delete(
  '/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DeleteRatingSchema),
  removeRating
);

export default router;
