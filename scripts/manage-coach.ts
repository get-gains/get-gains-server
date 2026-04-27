/**
 * Manage coach status for a user by email.
 *
 * Promotes a user to coach (creates coach row + sets is_coach=true),
 * or demotes (removes coach row + sets is_coach=false) with --remove.
 *
 * Dry-run by default — pass --commit to apply changes.
 *
 * Usage:
 *   npx tsx scripts/manage-coach.ts --email user@example.com [--remove] [--commit]
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { logger } from '../src/utils/logger';

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const email = getArg('--email');
const REMOVE = args.includes('--remove');
const COMMIT = args.includes('--commit');

async function main(): Promise<void> {
  if (!email) {
    logger.error('Missing required --email flag');
    logger.info(
      'Usage: npx tsx scripts/manage-coach.ts --email user@example.com [--remove] [--commit]'
    );
    process.exit(1);
  }

  const mode = REMOVE ? 'DEMOTE' : 'PROMOTE';
  logger.info(
    `Coach ${mode} for ${email}${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}`
  );

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      supabase_auth_id: true,
      email: true,
      full_name: true,
      is_coach: true,
    },
  });

  if (!user) {
    logger.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  logger.info(`Found user: ${user.full_name} (${user.email})`, {
    supabaseId: user.supabase_auth_id,
    isCoach: user.is_coach,
  });

  if (REMOVE) {
    await demote(user.supabase_auth_id, user.is_coach);
  } else {
    await promote(user.supabase_auth_id, user.is_coach);
  }

  await prisma.$disconnect();
}

async function promote(userId: string, isAlreadyCoach: boolean): Promise<void> {
  const existingCoach = await prisma.coach.findUnique({
    where: { user_id: userId },
  });

  if (existingCoach && isAlreadyCoach) {
    logger.info('User is already a coach — nothing to do');
    return;
  }

  if (!COMMIT) {
    logger.info('[DRY RUN] Would create coach record and set is_coach=true');
    return;
  }

  await prisma.$transaction([
    prisma.coach.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        certifications: [],
        specialties: [],
        social_links: [],
      },
      update: {},
    }),
    prisma.user.update({
      where: { supabase_auth_id: userId },
      data: { is_coach: true },
    }),
  ]);

  logger.info('User promoted to coach successfully');
}

async function demote(userId: string, isCoach: boolean): Promise<void> {
  if (!isCoach) {
    const coachRow = await prisma.coach.findUnique({
      where: { user_id: userId },
    });
    if (!coachRow) {
      logger.info('User is not a coach — nothing to do');
      return;
    }
  }

  const activeClients = await prisma.subscribed_coach.count({
    where: { coach_id: userId, ended_at: null },
  });

  if (activeClients > 0) {
    logger.warn(
      `Coach has ${activeClients} active client(s) — their subscriptions will be ended`
    );
  }

  if (!COMMIT) {
    logger.info(
      '[DRY RUN] Would remove coach record, end client subscriptions, and set is_coach=false'
    );
    return;
  }

  await prisma.$transaction([
    // End all active client relationships
    prisma.subscribed_coach.updateMany({
      where: { coach_id: userId, ended_at: null },
      data: { ended_at: new Date() },
    }),
    // Delete coach record
    prisma.coach.delete({ where: { user_id: userId } }),
    // Clear flag on user
    prisma.user.update({
      where: { supabase_auth_id: userId },
      data: { is_coach: false },
    }),
  ]);

  logger.info('Coach status removed successfully', {
    clientsEnded: activeClients,
  });
}

main().catch((error: unknown) => {
  logger.error('manage-coach script failed', error);
  process.exit(1);
});
