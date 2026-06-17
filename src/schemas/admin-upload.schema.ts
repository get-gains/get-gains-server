import { z } from 'zod';

export const UploadAdminImageSchema = z.object({
  body: z.object({
    prefix: z.enum(['missions', 'partners', 'cosmetics']),
    entityId: z.string().min(1, 'Entity ID is required'),
  }),
});

export type UploadAdminImageBody = z.infer<
  typeof UploadAdminImageSchema
>['body'];
