import { Request, Response } from 'express';
import { uploadFile, getPresignedUrl } from '../services/upload.service';
import { sendSuccess, sendSingleError } from '../utils/response';
import { logger } from '../utils/logger';

const VALID_PREFIXES = ['missions', 'partners', 'cosmetics'] as const;
type KeyPrefix = (typeof VALID_PREFIXES)[number];

interface UploadBody {
  prefix: KeyPrefix;
  entityId: string;
}

/**
 * POST /api/admin/upload/image
 * Generic admin image upload. Expects multipart/form-data with "image" file field,
 * plus JSON/form fields "prefix" and "entityId" to build the S3 key path.
 */
export const uploadAdminImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  const file = req.file;
  if (!file) {
    sendSingleError(res, 'UPLOAD_MISSING_FILE', 'No image file provided.', 400);
    return;
  }

  const { prefix, entityId } = res.locals.validated?.body as UploadBody;

  if (!VALID_PREFIXES.includes(prefix)) {
    sendSingleError(
      res,
      'UPLOAD_INVALID_PREFIX',
      'Invalid upload prefix.',
      400
    );
    return;
  }

  const key = `${prefix}/${entityId}/${Date.now()}.${file.originalname.split('.').pop()?.toLowerCase() || 'jpg'}`;

  try {
    await uploadFile(key, file.buffer, file.mimetype);
    sendSuccess(res, { key }, 201);
  } catch (error) {
    logger.error('Admin image upload failed', { prefix, entityId, error });
    sendSingleError(
      res,
      'UPLOAD_FAILED',
      'Failed to upload image. Please try again.',
      500
    );
  }
};

/**
 * GET /api/admin/upload/image-url?key=<s3-key>
 * Returns a presigned URL for the given S3 object key so the admin UI
 * can display image previews without exposing the S3 bucket directly.
 */
export const getAdminImageUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { key } = res.locals.validated?.query as { key: string };

  try {
    const url = await getPresignedUrl(key);
    sendSuccess(res, { url });
  } catch (error) {
    logger.error('Failed to generate presigned URL for admin', { key, error });
    sendSingleError(
      res,
      'UPLOAD_PRESIGN_FAILED',
      'Failed to generate image URL.',
      500
    );
  }
};
