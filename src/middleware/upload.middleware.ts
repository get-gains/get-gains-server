import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { BadRequestException } from '../lib/errors';

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
        next(
          new BadRequestException(
            'UPLOAD_FILE_TOO_LARGE',
            `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            [
              {
                code: 'UPLOAD_FILE_TOO_LARGE',
                message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
                field: 'avatar',
              },
            ]
          )
        );
        return;
      }
      next(
        new BadRequestException('UPLOAD_FAILED', err.message, [
          { code: 'UPLOAD_FAILED', message: err.message, field: 'avatar' },
        ])
      );
      return;
    }

    if (err instanceof Error) {
      next(
        new BadRequestException('UPLOAD_INVALID_FILE_TYPE', err.message, [
          {
            code: 'UPLOAD_INVALID_FILE_TYPE',
            message: err.message,
            field: 'avatar',
          },
        ])
      );
      return;
    }

    next();
  });
};
