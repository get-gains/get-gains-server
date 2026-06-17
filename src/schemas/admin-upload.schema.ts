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

export const AdminImageUrlSchema = z.object({
  query: z.object({
    key: z.string().min(1, 'S3 key is required'),
  }),
});
