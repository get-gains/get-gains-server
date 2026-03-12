import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  CreatePromoCodeInput,
  ListPromoCodesQuery,
  GetPromoCodeByIdParams,
  DeactivatePromoCodeParams,
  ValidatePromoCodeInput,
  RedeemPromoCodeInput,
} from '../schemas/promo.schema';
import {
  createPromoCode as createPromoCodeService,
  listPromoCodes,
  getPromoCodeById,
  deactivatePromoCode as deactivatePromoCodeService,
  validatePromoCode as validatePromoCodeService,
  redeemPromoCode as redeemPromoCodeService,
  getUserRedemptions,
  calculateDiscount,
} from '../services/promo.service';
import { DiscountType } from '@prisma/client';
import prisma from '../config/database';

// ============== Admin Controllers ==============

/**
 * Create a new promo code (admin)
 */
export const createPromoCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const input = res.locals.validated?.body as CreatePromoCodeInput;

    logger.debug('Creating promo code', { code: input.code });

    const result = await createPromoCodeService({
      code: input.code,
      description: input.description,
      discountType: input.discountType as DiscountType,
      discountValue: input.discountValue,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      maxUses: input.maxUses,
      applicablePlans: input.applicablePlans,
      firstTimeOnly: input.firstTimeOnly,
    });

    if (!result.success) {
      sendSingleError(res, result.error || 'Failed to create promo code', 400);
      return;
    }

    sendSuccess(
      res,
      {
        promoCode: {
          id: result.promoCode!.id,
          code: result.promoCode!.code,
          description: result.promoCode!.description,
          discountType: result.promoCode!.discountType,
          discountValue: result.promoCode!.discountValue,
          validFrom: result.promoCode!.validFrom,
          validUntil: result.promoCode!.validUntil,
          maxUses: result.promoCode!.maxUses,
          currentUses: result.promoCode!.currentUses,
          isActive: result.promoCode!.isActive,
          createdAt: result.promoCode!.createdAt,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Failed to create promo code', error);
    sendSingleError(res, 'Failed to create promo code', 500);
  }
};

/**
 * List all promo codes (admin)
 */
export const listAllPromoCodes = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit, offset, includeInactive } = res.locals.validated
      ?.query as ListPromoCodesQuery;

    logger.debug('Listing promo codes', { limit, offset, includeInactive });

    const { promoCodes, total } = await listPromoCodes(
      limit,
      offset,
      includeInactive
    );

    sendSuccess(res, {
      promoCodes: promoCodes.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        discountType: p.discountType,
        discountValue: p.discountValue,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
        maxUses: p.maxUses,
        currentUses: p.currentUses,
        redemptionCount: p._count.redemptions,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset! + promoCodes.length < total,
      },
    });
  } catch (error) {
    logger.error('Failed to list promo codes', error);
    sendSingleError(res, 'Failed to list promo codes', 500);
  }
};

/**
 * Get promo code details (admin)
 */
export const getPromoCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = res.locals.validated?.params as GetPromoCodeByIdParams;

    logger.debug('Fetching promo code', { id });

    const promoCode = await getPromoCodeById(id);

    if (!promoCode) {
      sendSingleError(res, 'Promo code not found', 404);
      return;
    }

    sendSuccess(res, {
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        validFrom: promoCode.validFrom,
        validUntil: promoCode.validUntil,
        maxUses: promoCode.maxUses,
        currentUses: promoCode.currentUses,
        applicablePlans: promoCode.applicablePlans,
        firstTimeOnly: promoCode.firstTimeOnly,
        isActive: promoCode.isActive,
        redemptionCount: promoCode._count.redemptions,
        recentRedemptions: promoCode.redemptions.map((r) => ({
          id: r.id,
          userId: r.userId,
          userEmail: r.user.email,
          userName: r.user.name,
          redeemedAt: r.redeemedAt,
        })),
        createdAt: promoCode.createdAt,
        updatedAt: promoCode.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch promo code', error);
    sendSingleError(res, 'Failed to fetch promo code', 500);
  }
};

/**
 * Deactivate a promo code (admin)
 */
export const deactivatePromoCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = res.locals.validated?.params as DeactivatePromoCodeParams;

    logger.debug('Deactivating promo code', { id });

    const result = await deactivatePromoCodeService(id);

    if (!result.success) {
      sendSingleError(
        res,
        result.error || 'Failed to deactivate promo code',
        404
      );
      return;
    }

    sendSuccess(res, {
      message: 'Promo code deactivated successfully',
      promoCode: {
        id: result.promoCode!.id,
        code: result.promoCode!.code,
        isActive: result.promoCode!.isActive,
      },
    });
  } catch (error) {
    logger.error('Failed to deactivate promo code', error);
    sendSingleError(res, 'Failed to deactivate promo code', 500);
  }
};

// ============== User Controllers ==============

/**
 * Validate a promo code for the current user
 */
export const validatePromoCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const { code, planId } = res.locals.validated
      ?.body as ValidatePromoCodeInput;

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.debug('Validating promo code', { code, userId: dbUser.id });

    const result = await validatePromoCodeService(code, dbUser.id, planId);

    if (!result.isValid) {
      sendSingleError(res, result.error || 'Invalid promo code', 400);
      return;
    }

    // Calculate example discount if planId provided
    let exampleDiscount = null;
    if (planId && result.promoCode) {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (plan) {
        const discountAmount = calculateDiscount(
          plan.priceCents,
          result.promoCode.discountType,
          result.promoCode.discountValue
        );
        exampleDiscount = {
          originalPriceCents: plan.priceCents,
          discountAmountCents: discountAmount,
          finalPriceCents: plan.priceCents - discountAmount,
        };
      }
    }

    sendSuccess(res, {
      isValid: true,
      promoCode: {
        code: result.promoCode!.code,
        discountType: result.promoCode!.discountType,
        discountValue: result.promoCode!.discountValue,
        description: result.promoCode!.description,
      },
      exampleDiscount,
    });
  } catch (error) {
    logger.error('Failed to validate promo code', error);
    sendSingleError(res, 'Failed to validate promo code', 500);
  }
};

/**
 * Redeem a promo code for the current user
 */
export const redeemPromoCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const { code, subscriptionId } = res.locals.validated
      ?.body as RedeemPromoCodeInput;

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.debug('Redeeming promo code', { code, userId: dbUser.id });

    const result = await redeemPromoCodeService(
      code,
      dbUser.id,
      subscriptionId
    );

    if (!result.success) {
      sendSingleError(res, result.error || 'Failed to redeem promo code', 400);
      return;
    }

    sendSuccess(res, {
      success: true,
      redemption: {
        id: result.redemption!.id,
        code: result.redemption!.promoCode.code,
        discountType: result.redemption!.promoCode.discountType,
        discountValue: result.redemption!.promoCode.discountValue,
        redeemedAt: result.redemption!.redeemedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to redeem promo code', error);
    sendSingleError(res, 'Failed to redeem promo code', 500);
  }
};

/**
 * Get user's promo code redemption history
 */
export const getMyRedemptions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    logger.debug('Fetching user redemptions', { userId: dbUser.id });

    const redemptions = await getUserRedemptions(dbUser.id);

    sendSuccess(res, {
      redemptions: redemptions.map((r) => ({
        id: r.id,
        code: r.promoCode.code,
        description: r.promoCode.description,
        discountType: r.promoCode.discountType,
        discountValue: r.promoCode.discountValue,
        redeemedAt: r.redeemedAt,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch redemptions', error);
    sendSingleError(res, 'Failed to fetch redemptions', 500);
  }
};
