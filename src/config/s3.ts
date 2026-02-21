import { S3Client } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

// Railway Buckets (S3-compatible) configuration
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

if (
  !S3_ENDPOINT ||
  !S3_ACCESS_KEY_ID ||
  !S3_SECRET_ACCESS_KEY ||
  !S3_BUCKET_NAME
) {
  logger.warn(
    'S3 environment variables not fully configured. File uploads will be unavailable.'
  );
}

export const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || '',
    secretAccessKey: S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Required for S3-compatible services like Railway Buckets
});

export const BUCKET_NAME = S3_BUCKET_NAME || '';

/** Presigned URL TTL in seconds (1 hour) */
export const PRESIGNED_URL_TTL = 3600;
