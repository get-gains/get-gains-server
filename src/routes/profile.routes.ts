import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
  requireCoach,
} from '../middleware/auth.middleware';
import {
  CreateUserProfileSchema,
  UpdateUserProfileSchema,
  GetClientProfileSchema,
} from '../schemas/profile.schema';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  getClientProfile,
} from '../controllers/profile.controller';

const router = Router();

// ─── User profile CRUD (authenticated user) ────────────────────────

// GET    /api/profile       → Retrieve own profile (null if not set up)
router.get('/', authenticateSupabaseUser, requireAppUser, getUserProfile);

// POST   /api/profile       → Create profile (onboarding)
router.post(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(CreateUserProfileSchema),
  createUserProfile
);

// PATCH  /api/profile       → Partial update
router.patch(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateUserProfileSchema),
  updateUserProfile
);

// PUT    /api/profile       → Full update (same handler, schema validates)
router.put(
  '/',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateUserProfileSchema),
  updateUserProfile
);

// ─── Coach: view a subscribed client's profile ──────────────────────

// GET    /api/profile/clients/:userId  → Coach reads client profile
router.get(
  '/clients/:userId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetClientProfileSchema),
  getClientProfile
);

export default router;
