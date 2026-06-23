import crypto from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { BadRequestException } from '../lib/errors';
import { sendEmailVerificationCode as sendVerificationEmail } from './email.service';

const VERIFICATION_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VERIFICATION_LENGTH = 6;
const VERIFICATION_EXPIRY_MINUTES = 10;
const VERIFICATION_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATIONS_PER_HOUR = 5;

const generateCode = (): string => {
  let code = '';
  const bytes = crypto.randomBytes(VERIFICATION_LENGTH);
  for (let i = 0; i < VERIFICATION_LENGTH; i++) {
    code += VERIFICATION_CHARSET[bytes[i] % VERIFICATION_CHARSET.length];
  }
  return code;
};

export const generateVerificationCode = async (
  email: string
): Promise<{ success: boolean; cooldownRemaining?: number }> => {
  const normalizedEmail = email.toLowerCase();

  // Rate limit: max 5 per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.email_verification_code.count({
    where: {
      email: normalizedEmail,
      created_at: { gte: oneHourAgo },
    },
  });

  if (recentCount >= MAX_VERIFICATIONS_PER_HOUR) {
    throw new BadRequestException(
      'AUTH_VERIFICATION_RATE_LIMITED',
      'Too many verification code requests. Please try again later.'
    );
  }

  // Check cooldown
  const existingCode = await prisma.email_verification_code.findFirst({
    where: {
      email: normalizedEmail,
      verified: false,
      cooldown_until: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (existingCode?.cooldown_until) {
    const remainingSeconds = Math.ceil(
      (existingCode.cooldown_until.getTime() - Date.now()) / 1000
    );
    return {
      success: false,
      cooldownRemaining: Math.max(1, remainingSeconds),
    };
  }

  // Generate and store code
  const code = generateCode();
  const expiresAt = new Date(
    Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000
  );
  const cooldownUntil = new Date(
    Date.now() + VERIFICATION_COOLDOWN_SECONDS * 1000
  );

  await prisma.email_verification_code.create({
    data: {
      email: normalizedEmail,
      code,
      expires_at: expiresAt,
      cooldown_until: cooldownUntil,
    },
  });

  logger.info('Email verification code generated', { email: normalizedEmail });

  await sendVerificationEmail(email, code);

  return { success: true };
};

export const verifyEmailCode = async (
  email: string,
  code: string
): Promise<void> => {
  const normalizedEmail = email.toLowerCase();
  const normalizedCode = code.toUpperCase();

  const record = await prisma.email_verification_code.findFirst({
    where: {
      email: normalizedEmail,
      verified: false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!record) {
    throw new BadRequestException(
      'AUTH_VERIFICATION_CODE_EXPIRED',
      'Verification code has expired. Please request a new one.'
    );
  }

  if (record.attempts >= record.max_attempts) {
    throw new BadRequestException(
      'AUTH_VERIFICATION_MAX_ATTEMPTS',
      'Too many incorrect attempts. Please request a new code.'
    );
  }

  if (record.code !== normalizedCode) {
    await prisma.email_verification_code.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    const remainingAttempts = record.max_attempts - record.attempts - 1;
    throw new BadRequestException(
      'AUTH_VERIFICATION_CODE_INVALID',
      remainingAttempts > 0
        ? `Invalid code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
        : 'Invalid code. No attempts remaining.'
    );
  }

  // Mark as verified
  await prisma.email_verification_code.update({
    where: { id: record.id },
    data: { verified: true },
  });

  logger.info('Email verification code validated', { email: normalizedEmail });
};
