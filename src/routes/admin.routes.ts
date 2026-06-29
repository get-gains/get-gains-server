import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import {
  requireAdmin,
  requireAdminScope,
} from '../middleware/admin.middleware';
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
  adminMe,
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
 * @route   GET /admin/auth/me
 * @desc    Get current admin user info + scopes
 * @access  Admin only
 */
router.get('/auth/me', authenticateSupabaseUser, requireAdmin, adminMe);

/**
 * @route   GET /admin/invitations
 * @desc    List coach invitations
 * @access  Admin only
 */
router.get(
  '/invitations',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_coaches'),
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
  requireAdminScope('manage_coaches'),
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
  requireAdminScope('manage_coaches'),
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
  requireAdminScope('manage_coaches'),
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
  requireAdminScope('manage_coaches'),
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
  requireAdminScope('manage_coaches'),
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
  requireAdminScope('manage_analytics'),
  validateRequest(AnalyticsQuerySchema),
  getAnalytics
);

export default router;
