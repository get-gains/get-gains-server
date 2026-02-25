import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { sendSingleError } from '../utils/response';

/** Max file size: 5 MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Multer instance configured for in-memory storage.
 * Files are held in memory as Buffer objects — never written to disk.
 * This keeps the server stateless and works in containerized environments.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
        )
      );
    }
  },
});

/**
 * Middleware: Accept a single file upload under the "avatar" field name.
 * Wraps multer errors into the standard API response envelope.
 */
export const uploadAvatar = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const handler = upload.single('avatar');

  handler(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        sendSingleError(
          res,
          `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          400,
          'avatar'
        );
        return;
      }
      sendSingleError(res, err.message, 400, 'avatar');
      return;
    }

    if (err instanceof Error) {
      sendSingleError(res, err.message, 400, 'avatar');
      return;
    }

    next();
  });
};
