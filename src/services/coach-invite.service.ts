import crypto from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendCoachInvitationCode } from './email.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../lib/errors';
import type { Prisma } from '@prisma/client';

const INVITE_CODE_LENGTH = 6;
const INVITE_EXPIRY_DAYS = 7;
const MAX_ATTEMPTS = 3;

/**
 * Generate a zero-padded 6-digit numeric invitation code.
 */
const generateInviteCode = (): string => {
  const value = crypto.randomInt(0, 1_000_000);
  return value.toString().padStart(INVITE_CODE_LENGTH, '0');
};

/**
 * Calculate the default invitation expiry date.
 */
const getInviteExpiry = (): Date => {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
};

/**
 * Create a new coach invitation for the given email.
 *
 * Revokes any existing pending invitations for the same email so only one
 * active pending code exists at a time. Rejects if the email already belongs
 * to an active coach.
 *
 * @param email     Email address to invite (lowercased internally)
 * @param createdBy Admin user ID creating the invite
 * @returns The created invitation record
 */
export const createCoachInvitation = async (
  email: string,
  createdBy: string
) => {
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { supabase_auth_id: true, is_coach: true },
  });

  if (existingUser?.is_coach) {
    throw new ConflictException(
      'COACH_INVITE_EMAIL_ALREADY_COACH',
      'This email is already associated with a coach account'
    );
  }

  await prisma.coach_invitation.updateMany({
    where: {
      email: normalizedEmail,
      status: 'PENDING',
    },
    data: {
      status: 'REVOKED',
      revoked_by: createdBy,
      revoked_at: new Date(),
    },
  });

  const code = generateInviteCode();

  const invitation = await prisma.coach_invitation.create({
    data: {
      email: normalizedEmail,
      code,
      max_attempts: MAX_ATTEMPTS,
      expires_at: getInviteExpiry(),
      created_by: createdBy,
    },
  });

  logger.info('Coach invitation created', {
    email: normalizedEmail,
    invitationId: invitation.id,
    createdBy,
  });

  await sendCoachInvitationCode(normalizedEmail, code);

  return invitation;
};

/**
 * Verify a coach invitation code for the authenticated user's email.
 *
 * Increments attempts on invalid codes and enforces max-attempt and expiry rules.
 *
 * @param code  6-digit invitation code
 * @param email Email of the authenticated user (lowercased internally)
 * @returns The validated invitation record
 */
export const verifyCoachInviteCode = async (code: string, email: string) => {
  const normalizedEmail = email.toLowerCase();
  const normalizedCode = code.trim();

  const invitation = await prisma.coach_invitation.findFirst({
    where: {
      code: normalizedCode,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!invitation) {
    throw new NotFoundException(
      'COACH_INVITE_NOT_FOUND',
      'Invitation code not found or expired'
    );
  }

  if (invitation.status === 'REVOKED') {
    throw new BadRequestException(
      'COACH_INVITE_REVOKED',
      'This invitation has been revoked'
    );
  }

  if (invitation.status === 'REDEEMED') {
    throw new BadRequestException(
      'COACH_INVITE_ALREADY_REDEEMED',
      'This invitation has already been redeemed'
    );
  }

  if (invitation.attempts >= invitation.max_attempts) {
    throw new BadRequestException(
      'COACH_INVITE_MAX_ATTEMPTS',
      'Too many incorrect attempts. Please request a new invitation.'
    );
  }

  if (invitation.email !== normalizedEmail) {
    await prisma.coach_invitation.update({
      where: { id: invitation.id },
      data: { attempts: { increment: 1 } },
    });

    const remaining = invitation.max_attempts - invitation.attempts - 1;
    throw new BadRequestException(
      'COACH_INVITE_EMAIL_MISMATCH',
      remaining > 0
        ? `Invalid code for this account. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Invalid code. No attempts remaining.'
    );
  }

  return invitation;
};

/**
 * Mark a coach invitation as redeemed inside a Prisma transaction.
 *
 * @param invitationId Invitation to mark redeemed
 * @param redeemedBy   User ID redeeming the invitation
 * @param tx           Prisma transaction client
 */
export const markInvitationRedeemed = async (
  invitationId: string,
  redeemedBy: string,
  tx: Prisma.TransactionClient
): Promise<void> => {
  await tx.coach_invitation.update({
    where: { id: invitationId },
    data: {
      status: 'REDEEMED',
      redeemed_by: redeemedBy,
      redeemed_at: new Date(),
    },
  });

  logger.info('Coach invitation redeemed', {
    invitationId,
    redeemedBy,
  });
};
