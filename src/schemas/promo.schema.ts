import { z } from 'zod';

// ============== Admin Promo Code Schemas ==============

/**
 * Schema for creating a promo code (admin)
 */
export const CreatePromoCodeSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(20, 'Code must be at most 20 characters')
      .regex(
        /^[A-Za-z0-9_-]+$/,
        'Code can only contain letters, numbers, underscores, and hyphens'
      ),
    description: z.string().max(500).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    discountValue: z.number().int().min(1, 'Discount value must be at least 1'),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date().optional(),
    maxUses: z.number().int().min(1).optional(),
    applicablePlans: z.array(z.string()).optional(),
    firstTimeOnly: z.boolean().optional().default(false),
  }),
});

export type CreatePromoCodeInput = z.infer<
  typeof CreatePromoCodeSchema
>['body'];

/**
 * Schema for listing promo codes (admin)
 */
export const ListPromoCodesSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
});

export type ListPromoCodesQuery = z.infer<typeof ListPromoCodesSchema>['query'];

/**
 * Schema for getting a promo code by ID (admin)
 */
export const GetPromoCodeByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Promo code ID is required'),
  }),
});

export type GetPromoCodeByIdParams = z.infer<
  typeof GetPromoCodeByIdSchema
>['params'];

/**
 * Schema for deactivating a promo code (admin)
 */
export const DeactivatePromoCodeSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Promo code ID is required'),
  }),
});

export type DeactivatePromoCodeParams = z.infer<
  typeof DeactivatePromoCodeSchema
>['params'];

// ============== User Promo Code Schemas ==============

/**
 * Schema for validating a promo code
 */
export const ValidatePromoCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Promo code is required'),
    planId: z.string().optional(),
  }),
});

export type ValidatePromoCodeInput = z.infer<
  typeof ValidatePromoCodeSchema
>['body'];

/**
 * Schema for redeeming a promo code
 */
export const RedeemPromoCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Promo code is required'),
    subscriptionId: z.string().optional(),
  }),
});

export type RedeemPromoCodeInput = z.infer<
  typeof RedeemPromoCodeSchema
>['body'];
