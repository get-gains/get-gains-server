import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ValidationException } from '../lib/errors';

/**
 * Middleware factory that validates request against a Zod schema.
 * Validates params, query, and body as defined in the schema.
 *
 * @param schema - Zod schema with optional params, query, body properties
 * @returns Express middleware function
 */
export const validateRequest = <T extends z.ZodTypeAny>(schema: T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and coerce request data. Express 5 makes req.query/params read-only,
      // so we store the fully-coerced result in res.locals.validated instead of
      // mutating req. Controllers must read from res.locals.validated to get
      // properly typed/coerced values (booleans, numbers, dates, defaults).
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      res.locals.validated = parsed as {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };

      logger.debug('Request validation passed', {
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          code: 'VALIDATION_ERROR' as const,
          message: issue.message,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: details,
        });

        throw new ValidationException(details);
      }

      // Re-throw unexpected errors for the global handler
      throw error;
    }
  };
};
