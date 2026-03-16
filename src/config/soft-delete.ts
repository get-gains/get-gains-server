import { Prisma } from '@prisma/client';

/**
 * Whitelist of models that have a `deletedAt` column.
 * Only these models will have soft-delete filtering and delete-override behavior.
 */
const SOFT_DELETE_MODELS: string[] = [
  'User',
  'Coach',
  'Exercise',
  'Routine',
  'RoutineExercise',
  'Program',
  'ProgramRoutine',
  'AssignedProgram',
  'WorkoutSession',
  'PerformedSet',
  'ExerciseForm',
  'ExercisePoseConfig',
  'FormComparisonResult',
  'EquippedCosmetic',
  'UserCosmetic',
  'CoinTransaction',
];

/**
 * Check if a model is soft-deletable (has `deletedAt` column).
 */
function isSoftDeletable(model: string | undefined): boolean {
  return model !== undefined && SOFT_DELETE_MODELS.includes(model);
}

/**
 * Inject `deletedAt: null` into the `where` clause of a query,
 * unless the caller has already specified a `deletedAt` filter (opt-out).
 */
function injectDeletedAtFilter(args: any): void {
  if (!args.where) {
    args.where = { deletedAt: null };
  } else if (args.where.deletedAt === undefined) {
    args.where.deletedAt = null;
  }
  // If deletedAt is already specified, respect the caller's intent (opt-out)
}

/**
 * Prisma Client Extension for soft-delete behavior.
 *
 * - **Read operations**: Automatically injects `where: { deletedAt: null }` on
 *   findMany, findFirst, findFirstOrThrow, findUnique, findUniqueOrThrow,
 *   count, aggregate, and groupBy for soft-deletable models.
 *
 * - **Delete operations**: Converts `delete` to an idempotent `update` that sets
 *   `deletedAt = new Date()`. If already soft-deleted, returns the existing record
 *   without modification (R7 idempotency). Converts `deleteMany` to `updateMany`.
 *
 * Uses the base `prisma` client (callback param) for update calls to avoid recursion.
 */
export const softDeleteExtension = Prisma.defineExtension((prisma) =>
  prisma.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        // ── Read operations: inject deletedAt filter ──

        async findMany({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async findFirstOrThrow({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async findUniqueOrThrow({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async count({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async aggregate({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        async groupBy({ model, args, query }) {
          if (isSoftDeletable(model)) {
            injectDeletedAtFilter(args);
          }
          return query(args);
        },

        // ── Delete operations: convert to soft-delete ──

        async delete({ model, args }) {
          if (!isSoftDeletable(model)) {
            // Non-soft-deletable model: perform actual delete via base client
            const modelKey = model!.charAt(0).toLowerCase() + model!.slice(1);
            return (prisma as any)[modelKey].delete(args);
          }

          const modelKey = model!.charAt(0).toLowerCase() + model!.slice(1);

          // Idempotency check (R7): if already soft-deleted, return as-is
          const existing = await (prisma as any)[modelKey].findUnique({
            where: args.where,
          });

          if (!existing) {
            // Record doesn't exist — let Prisma throw its standard NotFoundError
            return (prisma as any)[modelKey].delete(args);
          }

          if (existing.deletedAt) {
            // Already soft-deleted — return without modification
            return existing;
          }

          // Perform soft-delete via update on the base client (avoids recursion)
          return (prisma as any)[modelKey].update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },

        async deleteMany({ model, args }) {
          if (!isSoftDeletable(model)) {
            const modelKey = model!.charAt(0).toLowerCase() + model!.slice(1);
            return (prisma as any)[modelKey].deleteMany(args);
          }

          const modelKey = model!.charAt(0).toLowerCase() + model!.slice(1);

          // Convert deleteMany to updateMany: set deletedAt on non-deleted records
          const where = {
            ...args?.where,
            deletedAt: null, // Only soft-delete records that aren't already deleted
          };

          return (prisma as any)[modelKey].updateMany({
            where,
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  })
);
