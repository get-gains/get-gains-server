import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { hashCode } from '../utils/hash';
import { sendAdminInvitationEmail } from '../services/email.service';
import type {
  CreateAdminInvitationInput,
  ListAdminInvitationsQuery,
  RevokeAdminInvitationParams,
  AcceptAdminInvitationInput,
  RemoveAdminParams,
  AdminIdParams,
  UpdateAdminScopesInput,
  ListAdminsQuery,
} from '../schemas/admin-admins.schema';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '../lib/errors';

const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';

const INVITE_CREATOR_INCLUDE = {
  created_by_user: {
    select: { email: true, full_name: true },
  },
};

/**
 * List admin users with their scopes.
 *
 * Queries users who have at least one admin_scope row (includes deactivated admins
 * whose scopes are preserved). Supports optional status filter.
 */
export const listAdmins = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { status } = res.locals.validated?.query as ListAdminsQuery;

  const where: Record<string, unknown> = {
    admin_scopes: { some: {} },
    deleted_at: null,
  };

  if (status === 'active') {
    where.is_admin = true;
  } else if (status === 'deactivated') {
    where.is_admin = false;
  }

  const admins = await prisma.user.findMany({
    where,
    select: {
      supabase_auth_id: true,
      email: true,
      full_name: true,
      is_admin: true,
      admin_scopes: { select: { scope: true } },
      created_at: true,
    },
    orderBy: { created_at: 'asc' },
  });

  sendSuccess(res, {
    admins: admins.map((admin) => ({
      supabase_auth_id: admin.supabase_auth_id,
      email: admin.email,
      full_name: admin.full_name,
      scopes: admin.admin_scopes.map((s) => s.scope),
      status: admin.is_admin ? 'active' : 'deactivated',
      createdAt: admin.created_at,
    })),
  });
};

/**
 * Deactivate an admin — sets is_admin = false, preserves scopes.
 * Cannot deactivate yourself or a super admin.
 */
export const deactivateAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = res.locals.validated?.params as AdminIdParams;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  if (admin.supabase_auth_id === userId) {
    throw new BadRequestException(
      'ADMIN_SELF_REMOVE',
      'You cannot deactivate your own admin access'
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { supabase_auth_id: userId },
    include: { admin_scopes: { select: { scope: true } } },
  });

  if (!targetUser || targetUser.admin_scopes.length === 0) {
    throw new NotFoundException('USER_NOT_FOUND', 'Admin not found');
  }

  if (targetUser.admin_scopes.some((s) => s.scope === 'super_admin')) {
    throw new ForbiddenException(
      'ADMIN_SUPER_ADMIN_REQUIRED',
      'Cannot deactivate a super admin'
    );
  }

  if (!targetUser.is_admin) {
    throw new ConflictException(
      'COACH_ALREADY_DEACTIVATED',
      'Admin is already deactivated'
    );
  }

  await prisma.user.update({
    where: { supabase_auth_id: userId },
    data: { is_admin: false },
  });

  logger.info('Admin deactivated', {
    deactivatedBy: admin.supabase_auth_id,
    deactivatedUser: userId,
  });

  sendSuccess(res, {
    userId,
    status: 'deactivated',
  });
};

/**
 * Reactivate a deactivated admin. Requires the user to have existing scopes
 * and currently be deactivated (is_admin = false).
 */
export const activateAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = res.locals.validated?.params as AdminIdParams;

  const targetUser = await prisma.user.findUnique({
    where: { supabase_auth_id: userId },
    include: { admin_scopes: { select: { scope: true } } },
  });

  if (!targetUser || targetUser.admin_scopes.length === 0) {
    throw new NotFoundException('USER_NOT_FOUND', 'Admin not found');
  }

  if (targetUser.is_admin) {
    throw new ConflictException(
      'COACH_NOT_DEACTIVATED',
      'Admin is already active'
    );
  }

  await prisma.user.update({
    where: { supabase_auth_id: userId },
    data: { is_admin: true },
  });

  logger.info('Admin reactivated', { reactivatedUser: userId });

  sendSuccess(res, {
    userId,
    status: 'active',
    scopes: targetUser.admin_scopes.map((s) => s.scope),
  });
};

/**
 * Update an admin's scopes. Replaces all existing scopes with the new set.
 * Cannot edit self, cannot add/remove super_admin scope.
 */
export const updateAdminScopes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = res.locals.validated?.params as AdminIdParams;
  const { scopes: newScopes } = res.locals.validated
    ?.body as UpdateAdminScopesInput;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  if (admin.supabase_auth_id === userId) {
    throw new BadRequestException(
      'ADMIN_SELF_REMOVE',
      'You cannot edit your own scopes'
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { supabase_auth_id: userId },
    include: { admin_scopes: { select: { scope: true } } },
  });

  if (!targetUser || targetUser.admin_scopes.length === 0) {
    throw new NotFoundException('USER_NOT_FOUND', 'Admin not found');
  }

  if (targetUser.admin_scopes.some((s) => s.scope === 'super_admin')) {
    throw new ForbiddenException(
      'ADMIN_SUPER_ADMIN_REQUIRED',
      'Cannot modify super admin scopes'
    );
  }

  if (!targetUser.is_admin) {
    throw new BadRequestException(
      'COACH_ALREADY_DEACTIVATED',
      'Cannot update scopes for a deactivated admin'
    );
  }

  await prisma.$transaction([
    prisma.admin_scope.deleteMany({
      where: { supabase_auth_id: userId },
    }),
    prisma.admin_scope.createMany({
      data: newScopes.map((scope) => ({
        supabase_auth_id: userId,
        scope,
      })),
    }),
  ]);

  logger.info('Admin scopes updated', {
    updatedBy: admin.supabase_auth_id,
    targetUser: userId,
    newScopes,
  });

  sendSuccess(res, {
    userId,
    scopes: newScopes,
  });
};

/**
 * Permanently remove an admin — delete their scopes and set is_admin = false.
 * Cannot remove yourself or a super admin.
 */
export const removeAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = res.locals.validated?.params as RemoveAdminParams;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  if (admin.supabase_auth_id === userId) {
    throw new BadRequestException(
      'ADMIN_SELF_REMOVE',
      'You cannot remove your own admin access'
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { supabase_auth_id: userId },
    include: { admin_scopes: { select: { scope: true } } },
  });

  if (!targetUser || targetUser.admin_scopes.length === 0) {
    throw new NotFoundException('USER_NOT_FOUND', 'Admin not found');
  }

  if (targetUser.admin_scopes.some((s) => s.scope === 'super_admin')) {
    throw new ForbiddenException(
      'ADMIN_SUPER_ADMIN_REQUIRED',
      'Cannot remove a super admin'
    );
  }

  await prisma.$transaction([
    prisma.admin_scope.deleteMany({ where: { supabase_auth_id: userId } }),
    prisma.user.update({
      where: { supabase_auth_id: userId },
      data: { is_admin: false },
    }),
  ]);

  logger.info('Admin removed', {
    removedBy: admin.supabase_auth_id,
    removedUser: userId,
  });

  sendSuccess(res, { removed: true });
};

/**
 * Create an admin invitation. Generates a crypto-random token, hashes it,
 * stores the invitation, and sends an email with the acceptance link.
 */
export const createAdminInvitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, scopes } = res.locals.validated
    ?.body as CreateAdminInvitationInput;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const rawToken = crypto.randomUUID();
  const tokenHash = hashCode(rawToken);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.admin_invitation.create({
    data: {
      email: email.toLowerCase(),
      token_hash: tokenHash,
      scopes,
      created_by: admin.supabase_auth_id,
      expires_at: expiresAt,
    },
  });

  const acceptanceUrl = `${WEB_APP_URL}/admin/accept-invite?token=${rawToken}`;

  await sendAdminInvitationEmail(email, acceptanceUrl);

  logger.info('Admin invitation created', {
    invitationId: invitation.id,
    email,
    scopes,
    createdBy: admin.supabase_auth_id,
  });

  sendSuccess(
    res,
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        scopes: invitation.scopes,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      },
    },
    201
  );
};

/**
 * List admin invitations with optional status filter and pagination.
 */
export const listAdminInvitations = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { status, limit, offset } = res.locals.validated
    ?.query as ListAdminInvitationsQuery;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [invitations, total] = await Promise.all([
    prisma.admin_invitation.findMany({
      where,
      include: INVITE_CREATOR_INCLUDE,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.admin_invitation.count({ where }),
  ]);

  sendSuccess(res, {
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      scopes: inv.scopes,
      status: inv.status,
      attempts: inv.attempts,
      maxAttempts: inv.max_attempts,
      expiresAt: inv.expires_at,
      createdBy: inv.created_by_user
        ? {
            email: inv.created_by_user.email,
            fullName: inv.created_by_user.full_name,
          }
        : null,
      acceptedBy: inv.accepted_by,
      acceptedAt: inv.accepted_at,
      revokedBy: inv.revoked_by,
      revokedAt: inv.revoked_at,
      createdAt: inv.created_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + invitations.length < total,
    },
  });
};

/**
 * Revoke a pending admin invitation.
 */
export const revokeAdminInvitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as RevokeAdminInvitationParams;
  const admin = req.appUser;

  if (!admin) {
    throw new UnauthorizedException(
      'UNAUTHENTICATED',
      'Authentication required'
    );
  }

  const invitation = await prisma.admin_invitation.findUnique({
    where: { id },
  });

  if (!invitation) {
    throw new NotFoundException(
      'ADMIN_INVITATION_NOT_FOUND',
      'Invitation not found'
    );
  }

  if (invitation.status !== 'PENDING') {
    throw new BadRequestException(
      'ADMIN_INVITATION_ALREADY_ACCEPTED',
      `Cannot revoke invitation with status ${invitation.status.toLowerCase()}`
    );
  }

  const updated = await prisma.admin_invitation.update({
    where: { id },
    data: {
      status: 'REVOKED',
      revoked_by: admin.supabase_auth_id,
      revoked_at: new Date(),
    },
  });

  logger.info('Admin invitation revoked', {
    invitationId: id,
    revokedBy: admin.supabase_auth_id,
  });

  sendSuccess(res, {
    invitation: {
      id: updated.id,
      status: updated.status,
      revokedAt: updated.revoked_at,
    },
  });
};

/**
 * Accept an admin invitation using a raw token.
 *
 * If the request has a valid authenticated user, the invitation is accepted
 * and scopes are assigned immediately. If unauthenticated, returns the invited
 * email so the web app can prompt login/signup.
 */
export const acceptAdminInvitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { token } = res.locals.validated?.body as AcceptAdminInvitationInput;
  const tokenHash = hashCode(token);

  const invitation = await prisma.admin_invitation.findUnique({
    where: { token_hash: tokenHash },
    include: INVITE_CREATOR_INCLUDE,
  });

  if (!invitation) {
    throw new NotFoundException(
      'ADMIN_INVITATION_NOT_FOUND',
      'Invitation not found or invalid token'
    );
  }

  if (invitation.status === 'REVOKED') {
    throw new BadRequestException(
      'ADMIN_INVITATION_REVOKED',
      'This invitation has been revoked'
    );
  }

  if (invitation.status === 'ACCEPTED') {
    throw new BadRequestException(
      'ADMIN_INVITATION_ALREADY_ACCEPTED',
      'This invitation has already been accepted'
    );
  }

  if (invitation.status === 'EXPIRED' || new Date() > invitation.expires_at) {
    if (invitation.status !== 'EXPIRED') {
      await prisma.admin_invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
    }
    throw new BadRequestException(
      'ADMIN_INVITATION_EXPIRED',
      'This invitation has expired'
    );
  }

  if (invitation.attempts >= invitation.max_attempts) {
    throw new BadRequestException(
      'ADMIN_INVITATION_MAX_ATTEMPTS',
      'Too many attempts. This invitation has been locked.'
    );
  }

  const supabaseUser = req.user as { id: string; email?: string } | undefined;

  if (!supabaseUser) {
    sendSuccess(res, {
      requiresAuth: true,
      email: invitation.email,
    });
    return;
  }

  const appUser = await prisma.user.findUnique({
    where: { supabase_auth_id: supabaseUser.id },
  });

  if (
    !appUser ||
    appUser.email.toLowerCase() !== invitation.email.toLowerCase()
  ) {
    await prisma.admin_invitation.update({
      where: { id: invitation.id },
      data: { attempts: { increment: 1 } },
    });
    throw new BadRequestException(
      'ADMIN_EMAIL_MISMATCH',
      'Your email does not match the invitation email'
    );
  }

  await prisma.$transaction([
    prisma.admin_scope.createMany({
      data: invitation.scopes.map((scope) => ({
        supabase_auth_id: appUser.supabase_auth_id,
        scope,
      })),
      skipDuplicates: true,
    }),
    prisma.user.update({
      where: { supabase_auth_id: appUser.supabase_auth_id },
      data: { is_admin: true },
    }),
    prisma.admin_invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        accepted_by: appUser.supabase_auth_id,
        accepted_at: new Date(),
      },
    }),
  ]);

  logger.info('Admin invitation accepted', {
    invitationId: invitation.id,
    email: invitation.email,
    acceptedBy: appUser.supabase_auth_id,
  });

  const userScopes = await prisma.admin_scope.findMany({
    where: { supabase_auth_id: appUser.supabase_auth_id },
    select: { scope: true },
  });

  sendSuccess(res, {
    accepted: true,
    scopes: userScopes.map((s) => s.scope),
  });
};
