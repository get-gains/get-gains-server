/**
 * Plan Sync Script
 *
 * Fetches subscription products from payment providers (Google Play)
 * and syncs them to the database.
 *
 * Usage:
 *   npm run sync:plans
 *   npx tsx scripts/sync-plans.ts
 *
 * Environment Variables Required:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - GOOGLE_PLAY_PACKAGE_NAME: Android package name
 *   - GOOGLE_SERVICE_ACCOUNT_KEY_PATH: Path to service account JSON (default: google-services.json)
 */

import 'dotenv/config';
import { syncPlansFromProviders } from '../src/services/subscription.service';
import { logger } from '../src/utils/logger';

const main = async () => {
  logger.info('Starting plan sync from payment providers...');

  try {
    const results = await syncPlansFromProviders();

    logger.info('Plan sync completed', {
      added: results.added,
      skipped: results.skipped,
      errors: results.errors.length,
    });

    if (results.errors.length > 0) {
      logger.warn('Some providers had errors:', { errors: results.errors });
    }

    console.log('\n=== Plan Sync Results ===');
    console.log(`  Added:   ${results.added}`);
    console.log(`  Skipped: ${results.skipped} (already exist)`);
    console.log(`  Errors:  ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach((err) => console.log(`  - ${err}`));
    }

    process.exit(results.errors.length > 0 ? 1 : 0);
  } catch (error) {
    logger.error('Plan sync failed', error);
    console.error('Plan sync failed:', error);
    process.exit(1);
  }
};

main();
