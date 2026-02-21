/**
 * TypeScript module augmentation for Express.
 *
 * Adds `res.locals.validated` so controllers can access the fully-coerced Zod
 * output produced by `validateRequest` middleware — without touching the
 * read-only `req.query` / `req.params` properties introduced in Express 5.
 *
 * Usage in a controller:
 *   import type { MyQuery } from '../schemas/my.schema';
 *   const { limit, offset } = res.locals.validated?.query as MyQuery;
 */
declare namespace Express {
  interface Locals {
    /**
     * The fully-parsed (coerced + defaulted) result from `validateRequest`.
     * Available on every route that uses the `validateRequest` middleware.
     */
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}
