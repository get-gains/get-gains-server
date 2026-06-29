import { Router } from 'express';
import {
  authenticateSupabaseUser,
  maybeAuthenticateSupabaseUser,
} from '../middleware/auth.middleware';
import {
  requireAdmin,
  requireAdminScope,
} from '../middleware/admin.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  CreateAdminInvitationSchema,
  ListAdminInvitationsSchema,
  RevokeAdminInvitationSchema,
  AcceptAdminInvitationSchema,
  RemoveAdminSchema,
  AdminIdParamsSchema,
  ListAdminsQuerySchema,
  UpdateAdminScopesSchema,
} from '../schemas/admin-admins.schema';
import {
  listAdmins,
  removeAdmin,
  deactivateAdmin,
  activateAdmin,
  updateAdminScopes,
  createAdminInvitation,
  listAdminInvitations,
  revokeAdminInvitation,
  acceptAdminInvitation,
} from '../controllers/admin-admins.controller';

const router = Router();

router.get(
  '/',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(ListAdminsQuerySchema),
  listAdmins
);

router.delete(
  '/:userId',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(RemoveAdminSchema),
  removeAdmin
);

router.patch(
  '/:userId/deactivate',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(AdminIdParamsSchema),
  deactivateAdmin
);

router.patch(
  '/:userId/activate',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(AdminIdParamsSchema),
  activateAdmin
);

router.patch(
  '/:userId/scopes',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(UpdateAdminScopesSchema),
  updateAdminScopes
);

router.post(
  '/invitations',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(CreateAdminInvitationSchema),
  createAdminInvitation
);

router.get(
  '/invitations',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(ListAdminInvitationsSchema),
  listAdminInvitations
);

router.patch(
  '/invitations/:id/revoke',
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_admins'),
  validateRequest(RevokeAdminInvitationSchema),
  revokeAdminInvitation
);

router.post(
  '/invitations/accept',
  maybeAuthenticateSupabaseUser,
  validateRequest(AcceptAdminInvitationSchema),
  acceptAdminInvitation
);

export default router;
