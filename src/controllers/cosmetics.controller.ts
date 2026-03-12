import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { EquipBody, UnequipBody } from '../schemas/cosmetics.schema';
import { CosmeticCategory } from '@prisma/client';

const ALL_CATEGORIES: CosmeticCategory[] = [
  'HEADWEAR',
  'TOP',
  'BOTTOM',
  'ACCESSORY',
];

/**
 * Build the full equipped map { HEADWEAR: id|null, TOP: id|null, ... }
 * from a list of EquippedCosmetic records.
 */
function buildEquippedMap(
  equippedRows: { cosmeticId: string; category: CosmeticCategory }[]
): Record<CosmeticCategory, string | null> {
  const map: Record<string, string | null> = {};
  for (const cat of ALL_CATEGORIES) {
    map[cat] = null;
  }
  for (const row of equippedRows) {
    map[row.category] = row.cosmeticId;
  }
  return map as Record<CosmeticCategory, string | null>;
}

/**
 * GET /api/cosmetics/inventory
 * Get all cosmetics owned by the current user, with equipped state.
 */
export const getInventory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;

    // Fetch owned cosmetics and equipped state in parallel
    const [ownedRecords, equippedRecords] = await Promise.all([
      prisma.userCosmetic.findMany({
        where: { userId },
        include: { cosmetic: true },
        orderBy: { purchasedAt: 'desc' },
      }),
      prisma.equippedCosmetic.findMany({
        where: { userId },
        select: { cosmeticId: true, category: true },
      }),
    ]);

    const equippedMap = buildEquippedMap(equippedRecords);
    const equippedCosmeticIds = new Set(
      equippedRecords.map((e) => e.cosmeticId)
    );

    const owned = ownedRecords.map((uc) => ({
      id: uc.id,
      cosmeticId: uc.cosmeticId,
      name: uc.cosmetic.name,
      description: uc.cosmetic.description,
      tier: uc.cosmetic.tier,
      category: uc.cosmetic.category,
      previewImageUrl: uc.cosmetic.previewImageUrl,
      unityAssetRef: uc.cosmetic.unityAssetRef,
      purchasedAt: uc.purchasedAt,
      isEquipped: equippedCosmeticIds.has(uc.cosmeticId),
    }));

    sendSuccess(res, {
      owned,
      equipped: equippedMap,
    });
  } catch (error) {
    logger.error('Error fetching cosmetics inventory', error);
    sendSingleError(res, 'Failed to fetch inventory', 500);
  }
};

/**
 * POST /api/cosmetics/equip
 * Equip a cosmetic in its category slot. Replaces any previously equipped item in that slot.
 */
export const equipCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { cosmeticId } = res.locals.validated?.body as EquipBody;

    // 1. Verify cosmetic exists
    const cosmetic = await prisma.cosmetic.findUnique({
      where: { id: cosmeticId },
      select: { id: true, category: true },
    });

    if (!cosmetic) {
      sendSingleError(res, 'Cosmetic not found.', 404);
      return;
    }

    // 2. Verify user owns this cosmetic
    const ownership = await prisma.userCosmetic.findUnique({
      where: {
        userId_cosmeticId: { userId, cosmeticId },
      },
    });

    if (!ownership) {
      sendSingleError(res, 'You do not own this cosmetic.', 400, 'cosmeticId');
      return;
    }

    // 3. Upsert EquippedCosmetic for (userId, category)
    await prisma.equippedCosmetic.upsert({
      where: {
        userId_category: { userId, category: cosmetic.category },
      },
      update: {
        cosmeticId,
        equippedAt: new Date(),
      },
      create: {
        userId,
        cosmeticId,
        category: cosmetic.category,
      },
    });

    // 4. Return full equipped state
    const equippedRecords = await prisma.equippedCosmetic.findMany({
      where: { userId },
      include: {
        cosmetic: {
          select: {
            id: true,
            category: true,
            unityAssetRef: true,
          },
        },
      },
    });

    const equippedMap = buildEquippedMap(
      equippedRecords.map((e) => ({
        cosmeticId: e.cosmeticId,
        category: e.category,
      }))
    );

    sendSuccess(res, {
      equipped: equippedMap,
      equippedCosmetics: equippedRecords.map((e) => ({
        cosmeticId: e.cosmeticId,
        category: e.category,
        unityAssetRef: e.cosmetic.unityAssetRef,
        equippedAt: e.equippedAt,
      })),
    });
  } catch (error) {
    logger.error('Error equipping cosmetic', error);
    sendSingleError(res, 'Failed to equip cosmetic', 500);
  }
};

/**
 * POST /api/cosmetics/unequip
 * Unequip a cosmetic from its category slot.
 */
export const unequipCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;
    const { category } = res.locals.validated?.body as UnequipBody;

    // 1. Check if there is something equipped in the slot
    const existing = await prisma.equippedCosmetic.findUnique({
      where: {
        userId_category: {
          userId,
          category: category as CosmeticCategory,
        },
      },
    });

    if (!existing) {
      sendSingleError(
        res,
        'No cosmetic equipped in this slot.',
        400,
        'category'
      );
      return;
    }

    // 2. Delete the equipped record
    await prisma.equippedCosmetic.delete({
      where: {
        userId_category: {
          userId,
          category: category as CosmeticCategory,
        },
      },
    });

    // 3. Return full equipped state
    const equippedRecords = await prisma.equippedCosmetic.findMany({
      where: { userId },
      include: {
        cosmetic: {
          select: {
            id: true,
            category: true,
            unityAssetRef: true,
          },
        },
      },
    });

    const equippedMap = buildEquippedMap(
      equippedRecords.map((e) => ({
        cosmeticId: e.cosmeticId,
        category: e.category,
      }))
    );

    sendSuccess(res, {
      equipped: equippedMap,
      equippedCosmetics: equippedRecords.map((e) => ({
        cosmeticId: e.cosmeticId,
        category: e.category,
        unityAssetRef: e.cosmetic.unityAssetRef,
        equippedAt: e.equippedAt,
      })),
    });
  } catch (error) {
    logger.error('Error unequipping cosmetic', error);
    sendSingleError(res, 'Failed to unequip cosmetic', 500);
  }
};

/**
 * GET /api/cosmetics/equipped
 * Get only the currently equipped cosmetics (lightweight endpoint for Unity widget loading).
 */
export const getEquipped = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.appUser!.id;

    const equippedRecords = await prisma.equippedCosmetic.findMany({
      where: { userId },
      include: {
        cosmetic: {
          select: {
            id: true,
            category: true,
            unityAssetRef: true,
          },
        },
      },
    });

    sendSuccess(res, {
      equippedCosmetics: equippedRecords.map((e) => ({
        cosmeticId: e.cosmeticId,
        category: e.category,
        unityAssetRef: e.cosmetic.unityAssetRef,
      })),
    });
  } catch (error) {
    logger.error('Error fetching equipped cosmetics', error);
    sendSingleError(res, 'Failed to fetch equipped cosmetics', 500);
  }
};
