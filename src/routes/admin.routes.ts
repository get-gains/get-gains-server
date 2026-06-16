import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import {
  AdminLoginSchema,
  CreateInvitationSchema,
  ListInvitationsSchema,
  RevokeInvitationSchema,
  ListCoachesSchema,
  DeactivateCoachSchema,
  ActivateCoachSchema,
  AnalyticsQuerySchema,
} from '../schemas/admin.schema';
import {
  adminLogin,
  listInvitations,
  createInvitation,
  revokeInvitation,
  listCoaches,
  deactivateCoach,
  activateCoach,
  getAnalytics,
} from '../controllers/admin.controller';

const router = Router();

/**
 * @route   POST /admin/auth/login
 * @desc    Admin login with Supabase credentials
 * @access  Public
 */
router.post('/auth/login', validateRequest(AdminLoginSchema), adminLogin);

/**
 * @route   GET /admin/invitations
 * @desc    List coach invitations
 * @access  Admin only
 */
router.get(
  '/invitations',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(ListInvitationsSchema),
  listInvitations
);

/**
 * @route   POST /admin/invitations
 * @desc    Create a coach invitation
 * @access  Admin only
 */
router.post(
  '/invitations',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(CreateInvitationSchema),
  createInvitation
);

/**
 * @route   PATCH /admin/invitations/:id/revoke
 * @desc    Revoke a pending coach invitation
 * @access  Admin only
 */
router.patch(
  '/invitations/:id/revoke',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(RevokeInvitationSchema),
  revokeInvitation
);

/**
 * @route   GET /admin/coaches
 * @desc    List coaches for management
 * @access  Admin only
 */
router.get(
  '/coaches',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(ListCoachesSchema),
  listCoaches
);

/**
 * @route   PATCH /admin/coaches/:userId/deactivate
 * @desc    Deactivate a coach
 * @access  Admin only
 */
router.patch(
  '/coaches/:userId/deactivate',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(DeactivateCoachSchema),
  deactivateCoach
);

/**
 * @route   PATCH /admin/coaches/:userId/activate
 * @desc    Reactivate a deactivated coach
 * @access  Admin only
 */
router.patch(
  '/coaches/:userId/activate',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(ActivateCoachSchema),
  activateCoach
);

/**
 * @route   GET /admin/analytics
 * @desc    Aggregate admin analytics
 * @access  Admin only
 */
router.get(
  '/analytics',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(AnalyticsQuerySchema),
  getAnalytics
);

export default router;
