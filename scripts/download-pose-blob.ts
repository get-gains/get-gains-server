/**
 * Download a pose-frames JSON blob from S3 to a local file.
 *
 * Uses the server's S3 configuration (server/.env) so credentials stay out of
 * committed code. Handy for pulling a specific recording into Unity for
 * retargeting/debugging.
 *
 * Usage:
 *   npx tsx scripts/download-pose-blob.ts \
 *     --key pose-frames/coach/<user>/<uuid>.json \
 *     --out ../unity/test-data/squat-45-right.json
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '../src/config/s3';
import { logger } from '../src/utils/logger';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const key = getArg('--key');
const outPath = getArg('--out');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!key) {
    logger.error('Missing required --key flag (S3 object key)');
    logger.info(
      'Usage: npx tsx scripts/download-pose-blob.ts --key pose-frames/coach/.../....json --out ../unity/test-data/blob.json'
    );
    process.exit(1);
  }

  if (!outPath) {
    logger.error('Missing required --out flag (destination file path)');
    process.exit(1);
  }

  if (!BUCKET_NAME) {
    logger.error('S3_BUCKET_NAME is not configured in .env');
    process.exit(1);
  }

  const resolvedOut = path.resolve(outPath);
  const outDir = path.dirname(resolvedOut);

  logger.info(`Downloading s3://${BUCKET_NAME}/${key} -> ${resolvedOut}`);

  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );

  if (!response.Body) {
    logger.error('S3 returned empty response body');
    process.exit(1);
  }

  const bytes = await response.Body.transformToByteArray();

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    logger.info(`Created output directory: ${outDir}`);
  }

  fs.writeFileSync(resolvedOut, bytes);

  const sizeKb = (bytes.length / 1024).toFixed(1);
  logger.info(`Downloaded ${sizeKb} KB to ${resolvedOut}`);
}

main().catch((error: unknown) => {
  logger.error('download-pose-blob script failed', error);
  process.exit(1);
});
