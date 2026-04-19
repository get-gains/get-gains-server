/**
 * Backfill script: Sync RevenueCat customer data to user_subscription table.
 *
 * For every user, fetches their RC customer entitlements and upserts
 * user_subscription + sets user.active_subscription_tier.
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-revenuecat.ts [--dry-run]
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { logger } from '../src/utils/logger';
import { getRevenueCatCustomer } from '../src/services/revenuecat.service';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  logger.info(`Starting RevenueCat backfill${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const users = await prisma.user.findMany({
    select: { supabase_auth_id: true },
  });

  logger.info(`Found ${users.length} users to process`);

  let synced = 0;
  const skipped = 0;
  let errors = 0;
  let free = 0;

  for (const user of users) {
    try {
      const rcData = await getRevenueCatCustomer(user.supabase_auth_id);

      if (!rcData || !rcData.entitlementId || !rcData.productId) {
        // No RC entitlement — set to FREE
        if (!DRY_RUN) {
          await prisma.user.update({
            where: { supabase_auth_id: user.supabase_auth_id },
            data: { active_subscription_tier: 'FREE' },
          });
        }
        free++;
        continue;
      }

      if (DRY_RUN) {
        logger.info(`[DRY RUN] Would sync user ${user.supabase_auth_id}`, {
          tier: rcData.tier,
          status: rcData.status,
          productId: rcData.productId,
        });
        synced++;
        continue;
      }

      await prisma.$transaction([
        prisma.user_subscription.upsert({
          where: { user_id: user.supabase_auth_id },
          create: {
            user_id: user.supabase_auth_id,
            tier: rcData.tier,
            status: rcData.status,
            store: rcData.store,
            entitlement_id: rcData.entitlementId,
            product_id: rcData.productId,
            rc_original_tx_id: rcData.originalTxId,
            current_period_start: rcData.periodStart ?? new Date(),
            current_period_end: rcData.periodEnd ?? new Date(),
          },
          update: {
            tier: rcData.tier,
            status: rcData.status,
            store: rcData.store,
            entitlement_id: rcData.entitlementId,
            product_id: rcData.productId,
            rc_original_tx_id: rcData.originalTxId ?? undefined,
            current_period_start: rcData.periodStart ?? undefined,
            current_period_end: rcData.periodEnd ?? undefined,
          },
        }),
        prisma.user.update({
          where: { supabase_auth_id: user.supabase_auth_id },
          data: { active_subscription_tier: rcData.tier },
        }),
      ]);

      synced++;
      logger.debug(`Synced user ${user.supabase_auth_id}: ${rcData.tier}`);
    } catch (error) {
      errors++;
      logger.error(`Failed to sync user ${user.supabase_auth_id}`, error);
    }

    // Rate-limit: RC API rate limit is generous but let's be safe
    if (users.indexOf(user) % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  logger.info('RevenueCat backfill complete', {
    total: users.length,
    synced,
    free,
    skipped,
    errors,
    dryRun: DRY_RUN,
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error('Backfill script failed', error);
  process.exit(1);
});
