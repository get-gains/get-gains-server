import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { EquipBody, UnequipBody } from '../schemas/cosmetics.schema';
import { getPresignedUrl } from '../services/upload.service';
import { NotFoundException, BadRequestException } from '../lib/errors';

/** Max simultaneously equipped items (matches Wardrobe slot UI). */
const MAX_EQUIPPED_COSMETICS = 4;

/** Stable slot keys for the `equipped` map (oldest equipped → first key). */
const EQUIPPED_SLOT_KEYS = ['HEADWEAR', 'TOP', 'BOTTOM', 'ACCESSORY'] as const;

async function resolvePreviewUrl(key: string): Promise<string> {
  if (!key) return '';
  try {
    return await getPresignedUrl(key);
  } catch {
    return '';
  }
}

type EquippedRow = {
  cosmetic_id: string;
  equipped_at: Date | null;
  cosmetic: { unity_asset_ref: string };
};

function sortEquippedAsc<T extends { equipped_at: Date | null }>(
  rows: T[]
): T[] {
  return [...rows].sort(
    (a, b) => (a.equipped_at?.getTime() ?? 0) - (b.equipped_at?.getTime() ?? 0)
  );
}

/**
 * Map fixed slot keys to cosmetic IDs by equip order (FIFO slots).
 */
function buildSlotEquippedMap(
  rows: { cosmetic_id: string; equipped_at: Date | null }[]
): Record<string, string | null> {
  const sorted = sortEquippedAsc(rows);
  const map: Record<string, string | null> = {};
  for (const key of EQUIPPED_SLOT_KEYS) {
    map[key] = null;
  }
  sorted.forEach((row, i) => {
    if (i < EQUIPPED_SLOT_KEYS.length) {
      map[EQUIPPED_SLOT_KEYS[i]] = row.cosmetic_id;
    }
  });
  return map;
}

function buildEquippedCosmeticsPayload(rows: EquippedRow[]) {
  const sorted = sortEquippedAsc(rows);
  return sorted.map((uc, i) => ({
    cosmeticId: uc.cosmetic_id,
    category: EQUIPPED_SLOT_KEYS[i] ?? `SLOT_${i}`,
    unityAssetRef: uc.cosmetic.unity_asset_ref ?? '',
    equippedAt: uc.equipped_at,
  }));
}

async function fetchEquippedRowsForUser(
  userId: string
): Promise<EquippedRow[]> {
  return prisma.user_cosmetic.findMany({
    where: { user_id: userId, equipped_at: { not: null } },
    include: {
      cosmetic: {
        select: { unity_asset_ref: true },
      },
    },
  });
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
      equipped_at: uc.equipped_at,
    }));

  const equippedMap = buildSlotEquippedMap(equippedRows);

  const equippedCosmeticIds = new Set(equippedRows.map((r) => r.cosmetic_id));

  const owned = await Promise.all(
    ownedRecords.map(async (uc) => ({
      id: uc.cosmetic_id,
      cosmeticId: uc.cosmetic_id,
      name: uc.cosmetic.name,
      description: uc.cosmetic.description,
      tier: uc.cosmetic.tier,
      category: '',
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
 * Equip a cosmetic. Up to MAX_EQUIPPED_COSMETICS at once; oldest is unequipped when full.
 */
export const equipCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const { cosmeticId } = res.locals.validated?.body as EquipBody;

  const cosmetic = await prisma.cosmetics.findUnique({
    where: { id: cosmeticId },
    select: { id: true, deleted_at: true },
  });

  if (!cosmetic || cosmetic.deleted_at) {
    throw new NotFoundException('COSMETIC_NOT_FOUND', 'Cosmetic not found.');
  }

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

  await prisma.$transaction(async (tx) => {
    const currentlyEquipped = await tx.user_cosmetic.findMany({
      where: { user_id: userId, equipped_at: { not: null } },
      orderBy: { equipped_at: 'asc' },
    });

    const alreadyEquipped = currentlyEquipped.some(
      (r) => r.cosmetic_id === cosmeticId
    );
    if (alreadyEquipped) {
      return;
    }

    if (currentlyEquipped.length >= MAX_EQUIPPED_COSMETICS) {
      const n = currentlyEquipped.length - MAX_EQUIPPED_COSMETICS + 1;
      const victims = currentlyEquipped.slice(0, n);
      for (const row of victims) {
        await tx.user_cosmetic.update({
          where: {
            user_id_cosmetic_id: {
              user_id: userId,
              cosmetic_id: row.cosmetic_id,
            },
          },
          data: { equipped_at: null },
        });
      }
    }

    await tx.user_cosmetic.update({
      where: {
        user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
      },
      data: { equipped_at: new Date() },
    });
  });

  const equippedRecords = await fetchEquippedRowsForUser(userId);
  const equippedMap = buildSlotEquippedMap(equippedRecords);

  sendSuccess(res, {
    equipped: equippedMap,
    equippedCosmetics: buildEquippedCosmeticsPayload(equippedRecords),
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

  await prisma.user_cosmetic.update({
    where: {
      user_id_cosmetic_id: { user_id: userId, cosmetic_id: cosmeticId },
    },
    data: { equipped_at: null },
  });

  const equippedRecords = await fetchEquippedRowsForUser(userId);
  const equippedMap = buildSlotEquippedMap(equippedRecords);

  sendSuccess(res, {
    equipped: equippedMap,
    equippedCosmetics: buildEquippedCosmeticsPayload(equippedRecords),
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

  const equippedRecords = await fetchEquippedRowsForUser(userId);

  sendSuccess(res, {
    equippedCosmetics: buildEquippedCosmeticsPayload(equippedRecords),
  });
};
