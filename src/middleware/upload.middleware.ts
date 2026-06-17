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
 * Build a multer error handler for a single file upload under a named field.
 */
function buildSingleUploadMiddleware(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const handler = upload.single(fieldName);

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
                  field: fieldName,
                },
              ]
            )
          );
          return;
        }
        next(
          new BadRequestException('UPLOAD_FAILED', err.message, [
            {
              code: 'UPLOAD_FAILED',
              message: err.message,
              field: fieldName,
            },
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
              field: fieldName,
            },
          ])
        );
        return;
      }

      next();
    });
  };
}

/**
 * Middleware: Accept a single file upload under the "image" field name plus
 * the accompanying text fields (e.g. `prefix`, `entityId`).
 *
 * Uses `upload.fields([...])` rather than `upload.single(...)` so that
 * non-file form fields are still parsed into `req.body` and available to
 * the Zod validator that runs after this middleware.
 */
export const uploadGenericImageWithFields = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const handler = upload.fields([{ name: 'image', maxCount: 1 }]);

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
                field: 'image',
              },
            ]
          )
        );
        return;
      }
      next(
        new BadRequestException('UPLOAD_FAILED', err.message, [
          {
            code: 'UPLOAD_FAILED',
            message: err.message,
            field: 'image',
          },
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
            field: 'image',
          },
        ])
      );
      return;
    }

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    req.file = files?.image?.[0];

    next();
  });
};

/**
 * Middleware: Accept a single file upload under the "avatar" field name.
 * Wraps multer errors into the standard API response envelope.
 */
export const uploadAvatar = buildSingleUploadMiddleware('avatar');

/**
 * Middleware: Accept a single generic image upload under the "image" field name.
 */
export const uploadGenericImage = buildSingleUploadMiddleware('image');
