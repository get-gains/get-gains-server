import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, PRESIGNED_URL_TTL } from '../config/s3';
import { logger } from '../utils/logger';

/**
 * Generates a deterministic S3 object key for a user's avatar.
 * Format: avatars/<userId>/<timestamp>.<ext>
 */
export function buildAvatarKey(userId: string, originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  return `avatars/${userId}/${timestamp}.${ext}`;
}

/**
 * Uploads a file buffer to S3 and returns the object key.
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  logger.info('File uploaded to S3', { key, mimeType });
  return key;
}

/**
 * Deletes a file from S3 by its object key.
 * Silently succeeds if the key doesn't exist (S3 delete is idempotent).
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
  logger.info('File deleted from S3', { key });
}

/**
 * Generates a presigned GET URL for an S3 object key.
 * The URL expires after PRESIGNED_URL_TTL seconds (default: 1 hour).
 */
export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_TTL });
}

/**
 * Takes an S3 object key (or null) and resolves it to a presigned URL.
 * Returns null if the key is null/undefined.
 * Utility for attaching signed URLs to profile responses.
 */
export async function resolveAvatarUrl(
  avatarKey: string | null | undefined
): Promise<string | null> {
  if (!avatarKey) return null;

  try {
    return await getPresignedUrl(avatarKey);
  } catch (error) {
    logger.error('Failed to generate presigned URL for avatar', {
      avatarKey,
      error,
    });
    return null;
  }
}
