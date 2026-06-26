import prisma from '../src/config/database';
import { logger } from '../src/utils/logger';

/**
 * One-time script to promote a user to admin by email.
 *
 * Usage:
 *   npx tsx scripts/make-admin.ts admin@example.com
 */
const run = async (): Promise<void> => {
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;

  if (!email) {
    console.error(
      'Usage: npx tsx scripts/make-admin.ts <email>\n' +
        '   or set ADMIN_EMAIL environment variable.'
    );
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    console.error(`No user found with email: ${normalizedEmail}`);
    process.exit(1);
  }

  if (user.is_admin) {
    console.log(`${normalizedEmail} is already an admin.`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { supabase_auth_id: user.supabase_auth_id },
    data: { is_admin: true },
  });

  logger.info(`Promoted ${normalizedEmail} to admin`, {
    userId: user.supabase_auth_id,
  });

  console.log(`✅ ${normalizedEmail} is now an admin.`);
};

run()
  .catch((error) => {
    logger.error('make-admin failed', error);
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
