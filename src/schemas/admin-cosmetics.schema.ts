import { z } from 'zod';

export const CosmeticCategoryEnum = z.enum([
  'HEADWEAR',
  'TOP',
  'BOTTOM',
  'ACCESSORY',
]);

export const CreateCosmeticSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    tier: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(1)
    ),
    price: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(0)
    ),
    category: CosmeticCategoryEnum,
    previewImageKey: z.string(),
    unityAssetRef: z.string().min(1, 'Unity asset reference is required'),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    sortOrder: z.preprocess(
      (val) => (val === undefined ? 0 : Number(val)),
      z.number().int().min(0)
    ),
  }),
});
export type CreateCosmeticBody = z.infer<typeof CreateCosmeticSchema>['body'];

export const UpdateCosmeticSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Cosmetic ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    tier: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(1).optional()
    ),
    price: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    category: CosmeticCategoryEnum.optional(),
    previewImageKey: z.string().min(1).optional(),
    unityAssetRef: z.string().min(1).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    sortOrder: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
  }),
});
export type UpdateCosmeticParams = z.infer<
  typeof UpdateCosmeticSchema
>['params'];
export type UpdateCosmeticBody = z.infer<typeof UpdateCosmeticSchema>['body'];

export const CosmeticIdParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Cosmetic ID is required'),
  }),
});
export type CosmeticIdParams = z.infer<typeof CosmeticIdParamsSchema>['params'];

export const ListCosmeticsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(),
    limit: z.preprocess(
      (val) => (val === undefined ? 20 : Number(val)),
      z.number().int().min(1).max(100)
    ),
    offset: z.preprocess(
      (val) => (val === undefined ? 0 : Number(val)),
      z.number().int().min(0)
    ),
  }),
});
export type ListCosmeticsQuery = z.infer<
  typeof ListCosmeticsQuerySchema
>['query'];
