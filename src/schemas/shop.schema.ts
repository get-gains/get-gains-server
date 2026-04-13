import { z } from 'zod';

// ── Shop Catalog Query ──

export const ShopCatalogQuerySchema = z.object({
  query: z.object({
    tier: z.coerce.number().int().min(1).max(3).optional(),
    category: z.string().optional(),
  }),
});

export type ShopCatalogQuery = z.infer<typeof ShopCatalogQuerySchema>['query'];

// ── Purchase Body ──

export const PurchaseBodySchema = z.object({
  body: z.object({
    cosmeticId: z.string().min(1, 'Cosmetic ID is required'),
  }),
});

export type PurchaseBody = z.infer<typeof PurchaseBodySchema>['body'];
