/**
 * Reusable filter for nested includes on soft-deletable models.
 *
 * Prisma's query extension does NOT auto-filter nested `include`/`select` relations.
 * Use this constant in any `include` clause that references a soft-deletable model:
 *
 * @example
 * ```ts
 * const program = await prisma.program.findUnique({
 *   where: { id },
 *   include: {
 *     programRoutines: {
 *       ...notDeleted,
 *       include: {
 *         routine: {
 *           include: {
 *             routineExercises: {
 *               ...notDeleted,
 *               include: { exercise: true },
 *             },
 *           },
 *         },
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const notDeleted = { where: { deletedAt: null } } as const;

/**
 * Recursively strip `deletedAt` from an object and all nested objects/arrays.
 * Use this to sanitize Prisma results before sending in API responses,
 * ensuring the internal soft-delete field is never exposed to clients.
 *
 * @example
 * ```ts
 * const form = await prisma.exerciseForm.findUnique({ ... });
 * sendSuccess(res, { form: stripDeletedAt(form) });
 * ```
 */
export function stripDeletedAt<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripDeletedAt) as T;
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'deletedAt') continue;
      result[key] = stripDeletedAt(value);
    }
    return result as T;
  }
  return obj;
}
