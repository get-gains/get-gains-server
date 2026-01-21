import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';
import { sendError, sendSingleError } from '../utils/response';

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
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      logger.debug('Request validation passed', {
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors,
        });

        sendError(res, errors, 400);
        return;
      }

      logger.error('Unexpected validation error', error);
      sendSingleError(res, 'Internal server error', 500);
    }
  };
};
