import prisma from '../config/database';
import { logger } from '../utils/logger';
import { DiscountType } from '@prisma/client';

/**
 * Promo code service handles all promo code business logic
 */

export interface CreatePromoCodeInput {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  validFrom: Date;
  validUntil?: Date;
  maxUses?: number;
  applicablePlans?: string[];
  firstTimeOnly?: boolean;
}

export interface ValidatePromoCodeResult {
  isValid: boolean;
  promoCode?: {
    id: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    description?: string | null;
  };
  error?: string;
}

/**
 * Create a new promo code (admin)
 */
export const createPromoCode = async (input: CreatePromoCodeInput) => {
  // Check for existing code
  const existing = await prisma.promoCode.findUnique({
    where: { code: input.code.toUpperCase() },
  });

  if (existing) {
    return { success: false, error: 'Promo code already exists' };
  }

  const promoCode = await prisma.promoCode.create({
    data: {
      code: input.code.toUpperCase(),
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      maxUses: input.maxUses,
      applicablePlans: input.applicablePlans || [],
      firstTimeOnly: input.firstTimeOnly || false,
      isActive: true,
    },
  });

  logger.info('Promo code created', { code: promoCode.code });
  return { success: true, promoCode };
};

/**
 * List all promo codes (admin)
 */
export const listPromoCodes = async (
  limit = 50,
  offset = 0,
  includeInactive = false
) => {
  const where = includeInactive ? {} : { isActive: true };

  const [promoCodes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    }),
    prisma.promoCode.count({ where }),
  ]);

  return { promoCodes, total };
};

/**
 * Get promo code by ID (admin)
 */
export const getPromoCodeById = async (id: string) => {
  return prisma.promoCode.findUnique({
    where: { id },
    include: {
      redemptions: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { redeemedAt: 'desc' },
        take: 50,
      },
      _count: {
        select: { redemptions: true },
      },
    },
  });
};

/**
 * Deactivate a promo code (admin)
 */
export const deactivatePromoCode = async (id: string) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id },
  });

  if (!promoCode) {
    return { success: false, error: 'Promo code not found' };
  }

  const updated = await prisma.promoCode.update({
    where: { id },
    data: { isActive: false },
  });

  logger.info('Promo code deactivated', { code: updated.code });
  return { success: true, promoCode: updated };
};

/**
 * Validate a promo code for a user
 */
export const validatePromoCode = async (
  code: string,
  userId: string,
  planId?: string
): Promise<ValidatePromoCodeResult> => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!promoCode) {
    return { isValid: false, error: 'Promo code not found' };
  }

  // Check if active
  if (!promoCode.isActive) {
    return { isValid: false, error: 'Promo code is no longer active' };
  }

  // Check validity period
  const now = new Date();
  if (now < promoCode.validFrom) {
    return { isValid: false, error: 'Promo code is not yet valid' };
  }
  if (promoCode.validUntil && now > promoCode.validUntil) {
    return { isValid: false, error: 'Promo code has expired' };
  }

  // Check max uses
  if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
    return { isValid: false, error: 'Promo code has reached maximum uses' };
  }

  // Check applicable plans
  if (planId && promoCode.applicablePlans.length > 0) {
    if (!promoCode.applicablePlans.includes(planId)) {
      return { isValid: false, error: 'Promo code not valid for this plan' };
    }
  }

  // Check first time only
  if (promoCode.firstTimeOnly) {
    const previousSubscription = await prisma.subscription.findFirst({
      where: { userId },
    });

    if (previousSubscription) {
      return {
        isValid: false,
        error: 'Promo code is only valid for first-time subscribers',
      };
    }
  }

  // Check if user already redeemed this code
  const existingRedemption = await prisma.promoRedemption.findFirst({
    where: {
      promoCodeId: promoCode.id,
      userId,
    },
  });

  if (existingRedemption) {
    return { isValid: false, error: 'You have already used this promo code' };
  }

  return {
    isValid: true,
    promoCode: {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      description: promoCode.description,
    },
  };
};

/**
 * Redeem a promo code for a user
 */
export const redeemPromoCode = async (
  code: string,
  userId: string,
  subscriptionId?: string
) => {
  // Validate first
  const validation = await validatePromoCode(code, userId);

  if (!validation.isValid || !validation.promoCode) {
    return { success: false, error: validation.error };
  }

  // Create redemption record
  const redemption = await prisma.$transaction(async (tx) => {
    // Increment usage count
    await tx.promoCode.update({
      where: { id: validation.promoCode!.id },
      data: { currentUses: { increment: 1 } },
    });

    // Create redemption
    return tx.promoRedemption.create({
      data: {
        promoCodeId: validation.promoCode!.id,
        userId,
        subscriptionId,
      },
      include: {
        promoCode: true,
      },
    });
  });

  logger.info('Promo code redeemed', {
    code: validation.promoCode.code,
    userId,
  });

  return { success: true, redemption };
};

/**
 * Get user's promo code redemptions
 */
export const getUserRedemptions = async (userId: string) => {
  return prisma.promoRedemption.findMany({
    where: { userId },
    include: {
      promoCode: {
        select: {
          id: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
    orderBy: { redeemedAt: 'desc' },
  });
};

/**
 * Calculate discount amount
 */
export const calculateDiscount = (
  originalAmountCents: number,
  discountType: DiscountType,
  discountValue: number
): number => {
  if (discountType === DiscountType.PERCENTAGE) {
    return Math.round(originalAmountCents * (discountValue / 100));
  } else {
    // FIXED_AMOUNT - discountValue is in cents
    return Math.min(discountValue, originalAmountCents);
  }
};
