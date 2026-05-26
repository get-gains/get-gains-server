import { z } from 'zod';

export const ListNotificationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    unreadOnly: z.coerce.boolean().default(false),
    after: z.string().optional(),
  }),
});

export type ListNotificationsQuery = z.infer<
  typeof ListNotificationsSchema
>['query'];

export const MarkReadParamsSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export type MarkReadParams = z.infer<typeof MarkReadParamsSchema>['params'];
