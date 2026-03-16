import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { ShopCatalogQuery } from '../schemas/shop.schema';
import { PurchaseBody } from '../schemas/shop.schema';

/**
 * GET /api/shop/catalog
 * Browse the cosmetic shop catalog. Returns only ACTIVE items.
 * Includes user balance and owned cosmetic IDs for client-side affordability/ownership display.
 */
export const getCatalog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { tier, category } = (res.locals.validated?.query ??
      {}) as ShopCatalogQuery;

    // Build filter for active cosmetics
    const where: Record<string, unknown> = { status: 'ACTIVE' };
    if (tier !== undefined) {
      where.tier = tier;
    }
    if (category !== undefined) {
      where.category = category;
    }

    // Fetch catalog, user balance, and owned cosmetic IDs in parallel
    const [items, balance, ownedCosmetics] = await Promise.all([
      prisma.cosmetic.findMany({
        where,
        orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.coinBalance.findUnique({
        where: { userId },
        select: { currentBalance: true },
      }),
      prisma.userCosmetic.findMany({
        where: { userId },
        select: { cosmeticId: true },
      }),
    ]);

    sendSuccess(res, {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        tier: item.tier,
        coinCost: item.coinCost,
        category: item.category,
        previewImageUrl: item.previewImageUrl,
        unityAssetRef: item.unityAssetRef,
        sortOrder: item.sortOrder,
      })),
      userBalance: balance?.currentBalance ?? 0,
      ownedCosmeticIds: ownedCosmetics.map((uc) => uc.cosmeticId),
    });
  } catch (error) {
    logger.error('Error fetching shop catalog', error);
    sendSingleError(res, 'Failed to fetch shop catalog', 500);
  }
};

/**
 * POST /api/shop/purchase
 * Purchase a cosmetic item. Atomic: validates balance, deducts coins, grants ownership.
 * Uses Serializable isolation to prevent race conditions (R-003).
 */
export const purchaseCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { cosmeticId } = res.locals.validated?.body as PurchaseBody;

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Verify cosmetic exists and is ACTIVE
        const cosmetic = await tx.cosmetic.findUnique({
          where: { id: cosmeticId },
        });

        if (!cosmetic || cosmetic.status !== 'ACTIVE') {
          return {
            error: 'not_found' as const,
            message: 'Cosmetic not found or no longer available.',
          };
        }

        // 2. Verify user doesn't already own it
        const existingOwnership = await tx.userCosmetic.findFirst({
          where: { userId, cosmeticId },
        });

        if (existingOwnership) {
          return {
            error: 'already_owned' as const,
            message: 'You already own this cosmetic.',
          };
        }

        // 3. Load CoinBalance, verify sufficient funds
        const balance = await tx.coinBalance.findUnique({
          where: { userId },
        });

        const currentBalance = balance?.currentBalance ?? 0;

        if (currentBalance < cosmetic.coinCost) {
          const deficit = cosmetic.coinCost - currentBalance;
          return {
            error: 'insufficient_balance' as const,
            message: `Insufficient coin balance. You need ${deficit} more coins.`,
          };
        }

        // 4. Decrement balance, increment lifetimeSpent
        const updatedBalance = await tx.coinBalance.update({
          where: { userId },
          data: {
            currentBalance: { decrement: cosmetic.coinCost },
            lifetimeSpent: { increment: cosmetic.coinCost },
          },
        });

        // 5. Create UserCosmetic ownership record
        const userCosmetic = await tx.userCosmetic.create({
          data: {
            userId,
            cosmeticId,
          },
        });

        // 6. Create CoinTransaction (spending record)
        const transaction = await tx.coinTransaction.create({
          data: {
            userId,
            type: 'SHOP_PURCHASE',
            amount: -cosmetic.coinCost,
            balanceAfter: updatedBalance.currentBalance,
            userCosmeticId: userCosmetic.id,
          },
        });

        return {
          error: null,
          purchase: {
            id: userCosmetic.id,
            cosmeticId: cosmetic.id,
            cosmeticName: cosmetic.name,
            coinCost: cosmetic.coinCost,
            purchasedAt: userCosmetic.purchasedAt,
          },
          transaction: {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            balanceAfter: transaction.balanceAfter,
          },
          newBalance: updatedBalance.currentBalance,
        };
      },
      { isolationLevel: 'Serializable' }
    );

    // Handle error results from the transaction
    if (result.error === 'not_found') {
      sendSingleError(res, result.message, 404);
      return;
    }

    if (result.error === 'already_owned') {
      sendSingleError(res, result.message, 400, 'cosmeticId');
      return;
    }

    if (result.error === 'insufficient_balance') {
      sendSingleError(res, result.message, 400, 'cosmeticId');
      return;
    }

    sendSuccess(res, {
      purchase: result.purchase,
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  } catch (error) {
    logger.error('Error purchasing cosmetic', error);
    sendSingleError(res, 'Failed to process purchase', 500);
  }
};
