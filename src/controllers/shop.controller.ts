import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { ShopCatalogQuery, PurchaseBody } from '../schemas/shop.schema';

/**
 * GET /api/shop/catalog
 * Browse the cosmetic shop catalog. Returns only active (non-deleted) items.
 * Includes user balance and owned cosmetic IDs for client-side affordability/ownership display.
 */
export const getCatalog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;
    const { tier, category } = (res.locals.validated?.query ??
      {}) as ShopCatalogQuery;

    // Build filter for active cosmetics (deleted_at null = active)
    const where: Record<string, unknown> = { deleted_at: null };
    if (tier !== undefined) {
      where.tier = tier;
    }
    if (category !== undefined) {
      where.category = category;
    }

    // Fetch catalog and owned cosmetic IDs in parallel; balance lives on user record
    const [items, ownedCosmetics] = await Promise.all([
      prisma.cosmetics.findMany({
        where,
        orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      }),
      prisma.user_cosmetic.findMany({
        where: { user_id: userId },
        select: { cosmetic_id: true },
      }),
    ]);

    sendSuccess(res, {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        tier: item.tier,
        price: item.price,
        category: item.category,
        previewImageKey: item.preview_image_key,
      })),
      userBalance: req.appUser!.coin_balance,
      ownedCosmeticIds: ownedCosmetics.map((uc) => uc.cosmetic_id),
    });
  } catch (error) {
    logger.error('Error fetching shop catalog', error);
    sendSingleError(res, 'Failed to fetch shop catalog', 500);
  }
};

/**
 * POST /api/shop/purchase
 * Purchase a cosmetic item. Atomic: locks user row, validates balance, deducts coins,
 * grants ownership, and records the transaction.
 * Uses Serializable isolation + SELECT FOR UPDATE to prevent race conditions (B2).
 */
export const purchaseCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.supabase_auth_id;
    const { cosmeticId } = res.locals.validated?.body as PurchaseBody;

    // Pre-transaction checks (no lock needed yet)
    const cosmetic = await prisma.cosmetics.findUnique({
      where: { id: cosmeticId },
    });

    if (!cosmetic || cosmetic.deleted_at !== null) {
      sendSingleError(res, 'Cosmetic not found or no longer available.', 404);
      return;
    }

    const existingOwnership = await prisma.user_cosmetic.findUnique({
      where: {
        user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
      },
    });

    if (existingOwnership) {
      sendSingleError(res, 'You already own this cosmetic.', 400, 'cosmeticId');
      return;
    }

    // Atomic balance deduction via SELECT FOR UPDATE + Serializable transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Lock the user row and read current balance
        const rows = await tx.$queryRaw<{ coin_balance: number }[]>`
          SELECT coin_balance FROM "user" WHERE supabase_auth_id = ${userId} FOR UPDATE
        `;
        const currentBalance = rows[0].coin_balance;

        // 2. Check sufficient balance
        if (currentBalance < cosmetic.price) {
          const deficit = cosmetic.price - currentBalance;
          return {
            error: 'insufficient_balance' as const,
            message: `Insufficient coin balance. You need ${deficit} more coins.`,
          };
        }

        const newBalance = currentBalance - cosmetic.price;

        // 3. Create UserCosmetic ownership record
        const userCosmetic = await tx.user_cosmetic.create({
          data: {
            user_id: userId,
            cosmetic_id: cosmeticId,
          },
        });

        // 4. Record the coin transaction
        await tx.coin_transactions.create({
          data: {
            user_id: userId,
            transaction_type: 'SHOP_PURCHASE',
            value: -cosmetic.price,
            balance_after: newBalance,
            user_cosmetic_user_id: userId,
            user_cosmetic_cosmetic_id: cosmeticId,
          },
        });

        // 5. Update user's coin balance
        await tx.user.update({
          where: { supabase_auth_id: userId },
          data: { coin_balance: newBalance },
        });

        return {
          error: null,
          purchase: {
            cosmeticId: cosmetic.id,
            cosmeticName: cosmetic.name,
            price: cosmetic.price,
            purchasedAt: userCosmetic.created_at,
          },
          newBalance,
        };
      },
      { isolationLevel: 'Serializable' }
    );

    if (result.error === 'insufficient_balance') {
      sendSingleError(res, result.message, 400, 'cosmeticId');
      return;
    }

    sendSuccess(res, {
      purchase: result.purchase,
      newBalance: result.newBalance,
    });
  } catch (error) {
    logger.error('Error purchasing cosmetic', error);
    sendSingleError(res, 'Failed to process purchase', 500);
  }
};
