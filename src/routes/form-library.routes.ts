import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { FormLibraryQuerySchema } from '../schemas/form-library.schema';
import { getFormLibraryHandler } from '../controllers/form-library.controller';

const router = Router();

/**
 * @route   GET /form-library
 * @desc    Get public exercises with form recordings for browsing (free tier)
 * @access  Protected
 */
router.get(
  '/',
  authenticateSupabaseUser,
  validateRequest(FormLibraryQuerySchema),
  getFormLibraryHandler
);

export default router;
