import { z } from 'zod';

/**
 * Schema for getting coach's class (client roster)
 */
export const GetClassSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetClassQuery = z.infer<typeof GetClassSchema>['query'];

/**
 * Schema for adding a client to the coach's class
 */
export const AddClientSchema = z.object({
  body: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
});

export type AddClientInput = z.infer<typeof AddClientSchema>['body'];

/**
 * Schema for removing a client from the coach's class
 */
export const RemoveClientSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
});

export type RemoveClientParams = z.infer<typeof RemoveClientSchema>['params'];
