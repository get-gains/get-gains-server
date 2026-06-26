import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import {
  AppException,
  UnexpectedException,
  ValidationException,
  mapPrismaError,
  mapSupabaseError,
} from '../lib/errors';
import type { ApiError } from '../utils/response';

/**
 * Global Express error handler.
 *
 * Normalises every thrown/next(err) value into the `{ data, errors }` envelope.
 * Dispatches by error type:
 *  1. AppException        → use its code/status directly
 *  2. ZodError            → wrap into ValidationException
 *  3. PrismaClientKnown…  → map via prisma-error-mapper
 *  4. SupabaseAuthError   → map via supabase-error-mapper
 *  5. anything else       → 500 UNEXPECTED_EXCEPTION
 *
 * Must be registered **after** all routes in index.ts.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let exc: AppException;

  if (err instanceof AppException) {
    exc = err;
  } else if (err instanceof ZodError) {
    exc = new ValidationException(
      err.issues.map((i) => ({
        field: i.path.join('.'),
        code: 'VALIDATION_ERROR' as const,
        message: i.message,
      }))
    );
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    exc = mapPrismaError(err);
  } else if (err instanceof SupabaseAuthError) {
    exc = mapSupabaseError(err);
  } else {
    logger.error('Unhandled error', { path: req.path, err });
    exc = new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Something went wrong'
    );
  }

  if (exc.status >= 500) {
    logger.error('Server exception', { code: exc.code, err });
  } else {
    logger.warn('Client exception', { code: exc.code, path: req.path });
  }

  const errors: ApiError[] = exc.details?.length
    ? exc.details.map((d) => ({
        code: d.code,
        message: d.message,
        field: d.field,
        meta: d.meta,
      }))
    : [
        {
          code: exc.code,
          message: exc.message,
          meta: exc.meta,
        },
      ];

  res.status(exc.status).json({ data: null, errors });
};
