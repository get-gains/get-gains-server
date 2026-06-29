import { z } from 'zod';

export const ADMIN_SCOPES = [
  'manage_admins',
  'manage_coaches',
  'manage_cosmetics',
  'manage_missions',
  'manage_partners',
  'manage_analytics',
  'manage_uploads',
] as const;

export const ALL_ADMIN_SCOPES = ['super_admin', ...ADMIN_SCOPES] as const;

export type AdminScope = (typeof ALL_ADMIN_SCOPES)[number];

export const AdminScopeSchema = z.enum(ALL_ADMIN_SCOPES);

export const CreateAdminInvitationSchema = z.object({
  body: z.object({
    email: z.email(),
    scopes: z
      .array(z.enum(ADMIN_SCOPES))
      .min(1, 'At least one scope is required'),
  }),
});

export type CreateAdminInvitationInput = z.infer<
  typeof CreateAdminInvitationSchema
>['body'];

export const ListAdminInvitationsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type ListAdminInvitationsQuery = z.infer<
  typeof ListAdminInvitationsSchema
>['query'];

export const RevokeAdminInvitationSchema = z.object({
  params: z.object({
    id: z.string().cuid2('Invalid invitation ID'),
  }),
});

export type RevokeAdminInvitationParams = z.infer<
  typeof RevokeAdminInvitationSchema
>['params'];

export const AcceptAdminInvitationSchema = z.object({
  body: z.object({
    token: z.string().uuid('Invalid invitation token'),
  }),
});

export type AcceptAdminInvitationInput = z.infer<
  typeof AcceptAdminInvitationSchema
>['body'];

export const RemoveAdminSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
});

export type RemoveAdminParams = z.infer<typeof RemoveAdminSchema>['params'];

export const AdminIdParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
});

export type AdminIdParams = z.infer<typeof AdminIdParamsSchema>['params'];

export const UpdateAdminScopesSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
  body: z.object({
    scopes: z
      .array(z.enum(ADMIN_SCOPES))
      .min(1, 'At least one scope is required'),
  }),
});

export type UpdateAdminScopesInput = z.infer<
  typeof UpdateAdminScopesSchema
>['body'];

export type UpdateAdminScopesParams = z.infer<
  typeof UpdateAdminScopesSchema
>['params'];

export const ListAdminsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['active', 'deactivated', 'all']).optional().default('all'),
  }),
});

export type ListAdminsQuery = z.infer<typeof ListAdminsQuerySchema>['query'];
