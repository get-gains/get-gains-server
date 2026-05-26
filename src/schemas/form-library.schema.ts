import { z } from 'zod';

export const FormLibraryQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    muscleGroup: z.string().optional(),
    sort: z.enum(['most_rated', 'newest']).optional().default('most_rated'),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type FormLibraryQuery = z.infer<typeof FormLibraryQuerySchema>['query'];
