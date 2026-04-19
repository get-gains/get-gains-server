import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { EquipBody, UnequipBody } from '../schemas/cosmetics.schema';
import { getPresignedUrl } from '../services/upload.service';
import { NotFoundException, BadRequestException } from '../lib/errors';

async function resolvePreviewUrl(key: string): Promise<string> {
  if (!key) return '';
  try {
    return await getPresignedUrl(key);
  } catch {
    return '';
  }
}

/**
 * Build an equipped map keyed by category string.
 * Input rows must have cosmetic_id and category.
 * Returns { [category: string]: cosmeticId | null } for all categories seen.
 */
function buildEquippedMap(
  equippedRows: { cosmetic_id: string; category: string }[]
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const row of equippedRows) {
    map[row.category] = row.cosmetic_id;
  }
  return map;
}

/**
 * GET /api/cosmetics/inventory
 * Get all cosmetics owned by the current user, with equipped state.
 */
export const getInventory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;

  const ownedRecords = await prisma.user_cosmetic.findMany({
    where: { user_id: userId },
    include: { cosmetic: true },
    orderBy: { created_at: 'desc' },
  });

  const equippedRows = ownedRecords
    .filter((uc) => uc.equipped_at !== null)
    .map((uc) => ({
      cosmetic_id: uc.cosmetic_id,
      category: uc.cosmetic.category,
    }));

  const equippedMap = buildEquippedMap(equippedRows);

  const equippedCosmeticIds = new Set(equippedRows.map((r) => r.cosmetic_id));

  const owned = await Promise.all(
    ownedRecords.map(async (uc) => ({
      id: uc.cosmetic_id,
      cosmeticId: uc.cosmetic_id,
      name: uc.cosmetic.name,
      description: uc.cosmetic.description,
      tier: uc.cosmetic.tier,
      category: uc.cosmetic.category,
      previewImageUrl: await resolvePreviewUrl(
        uc.cosmetic.preview_image_key ?? ''
      ),
      unityAssetRef: uc.cosmetic.unity_asset_ref ?? '',
      purchasedAt: uc.created_at,
      isEquipped: equippedCosmeticIds.has(uc.cosmetic_id),
    }))
  );

  sendSuccess(res, {
    owned,
    equipped: equippedMap,
  });
};

/**
 * POST /api/cosmetics/equip
 * Equip a cosmetic in its category slot. Replaces any previously equipped item in that slot.
 */
export const equipCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const { cosmeticId } = res.locals.validated?.body as EquipBody;

  // 1. Verify cosmetic exists and is not soft-deleted
  const cosmetic = await prisma.cosmetics.findUnique({
    where: { id: cosmeticId },
    select: { id: true, category: true, deleted_at: true },
  });

  if (!cosmetic || cosmetic.deleted_at) {
    throw new NotFoundException('COSMETIC_NOT_FOUND', 'Cosmetic not found.');
  }

  // 2. Verify user owns this cosmetic
  const ownership = await prisma.user_cosmetic.findUnique({
    where: {
      user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
    },
  });

  if (!ownership) {
    throw new BadRequestException(
      'COSMETIC_NOT_OWNED',
      'You do not own this cosmetic.'
    );
  }

  // 3. Apply B8 equip transaction: unequip current in same category, then equip this one
  const { category } = cosmetic;
  await prisma.$transaction([
    prisma.user_cosmetic.updateMany({
      where: {
        user_id: userId,
        equipped_at: { not: null },
        cosmetic: { category },
      },
      data: { equipped_at: null },
    }),
    prisma.user_cosmetic.update({
      where: {
        user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
      },
      data: { equipped_at: new Date() },
    }),
  ]);

  // 4. Return updated equipped state
  const equippedRecords = await prisma.user_cosmetic.findMany({
    where: { user_id: userId, equipped_at: { not: null } },
    include: {
      cosmetic: {
        select: { id: true, category: true, unity_asset_ref: true },
      },
    },
  });

  const equippedMap = buildEquippedMap(
    equippedRecords.map((uc) => ({
      cosmetic_id: uc.cosmetic_id,
      category: uc.cosmetic.category,
    }))
  );

  sendSuccess(res, {
    equipped: equippedMap,
    equippedCosmetics: equippedRecords.map((uc) => ({
      cosmeticId: uc.cosmetic_id,
      category: uc.cosmetic.category,
      unityAssetRef: uc.cosmetic.unity_asset_ref ?? '',
      equippedAt: uc.equipped_at,
    })),
  });
};

/**
 * POST /api/cosmetics/unequip
 * Unequip a specific cosmetic by ID.
 */
export const unequipCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const { cosmeticId } = res.locals.validated?.body as UnequipBody;

  // 1. Find the user_cosmetic row
  const row = await prisma.user_cosmetic.findUnique({
    where: {
      user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
    },
  });

  if (!row) {
    throw new BadRequestException(
      'COSMETIC_NOT_OWNED',
      'You do not own this cosmetic.'
    );
  }

  if (row.equipped_at === null) {
    throw new BadRequestException(
      'COSMETIC_NOT_EQUIPPABLE',
      'This cosmetic is not currently equipped.'
    );
  }

  // 2. Unequip by setting equipped_at to null
  await prisma.user_cosmetic.update({
    where: {
      user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
    },
    data: { equipped_at: null },
  });

  // 3. Return updated equipped state
  const equippedRecords = await prisma.user_cosmetic.findMany({
    where: { user_id: userId, equipped_at: { not: null } },
    include: {
      cosmetic: {
        select: { id: true, category: true, unity_asset_ref: true },
      },
    },
  });

  const equippedMap = buildEquippedMap(
    equippedRecords.map((uc) => ({
      cosmetic_id: uc.cosmetic_id,
      category: uc.cosmetic.category,
    }))
  );

  sendSuccess(res, {
    equipped: equippedMap,
    equippedCosmetics: equippedRecords.map((uc) => ({
      cosmeticId: uc.cosmetic_id,
      category: uc.cosmetic.category,
      unityAssetRef: uc.cosmetic.unity_asset_ref ?? '',
      equippedAt: uc.equipped_at,
    })),
  });
};

/**
 * GET /api/cosmetics/equipped
 * Get only the currently equipped cosmetics.
 */
export const getEquipped = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;

  const equippedRecords = await prisma.user_cosmetic.findMany({
    where: { user_id: userId, equipped_at: { not: null } },
    include: {
      cosmetic: {
        select: { id: true, category: true, unity_asset_ref: true },
      },
    },
  });

  sendSuccess(res, {
    equippedCosmetics: equippedRecords.map((uc) => ({
      cosmeticId: uc.cosmetic_id,
      category: uc.cosmetic.category,
      unityAssetRef: uc.cosmetic.unity_asset_ref ?? '',
      equippedAt: uc.equipped_at,
    })),
  });
};
