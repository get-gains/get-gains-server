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
