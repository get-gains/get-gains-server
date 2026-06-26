import { z } from 'zod';

/**
 * Schema for admin login.
 */
export const AdminLoginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>['body'];

/**
 * Schema for creating a coach invitation.
 */
export const CreateInvitationSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type CreateInvitationInput = z.infer<
  typeof CreateInvitationSchema
>['body'];

/**
 * Schema for listing coach invitations.
 */
export const ListInvitationsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'REDEEMED', 'REVOKED']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type ListInvitationsQuery = z.infer<
  typeof ListInvitationsSchema
>['query'];

/**
 * Schema for revoking an invitation.
 */
export const RevokeInvitationSchema = z.object({
  params: z.object({
    id: z.string().cuid2('Invalid invitation ID'),
  }),
});

export type RevokeInvitationParams = z.infer<
  typeof RevokeInvitationSchema
>['params'];

/**
 * Schema for listing coaches in admin view.
 */
export const ListCoachesSchema = z.object({
  query: z.object({
    status: z.enum(['active', 'deactivated', 'all']).optional().default('all'),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type ListCoachesQuery = z.infer<typeof ListCoachesSchema>['query'];

/**
 * Schema for deactivating a coach.
 */
export const DeactivateCoachSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
});

export type DeactivateCoachParams = z.infer<
  typeof DeactivateCoachSchema
>['params'];

/**
 * Schema for reactivating a coach.
 */
export const ActivateCoachSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
});

export type ActivateCoachParams = z.infer<typeof ActivateCoachSchema>['params'];

/**
 * Schema for admin analytics query.
 */
export const AnalyticsQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).optional().default(30),
  }),
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>['query'];
