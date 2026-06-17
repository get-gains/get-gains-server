import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';
import { deleteFile } from '../services/upload.service';
import { NotFoundException } from '../lib/errors';
import {
  CreateCosmeticBody,
  UpdateCosmeticParams,
  UpdateCosmeticBody,
  CosmeticIdParams,
  ListCosmeticsQuery,
} from '../schemas/admin-cosmetics.schema';

function serializeCosmetic(cosmetic: {
  id: string;
  name: string;
  description: string;
  tier: number;
  price: number;
  preview_image_key: string;
  unity_asset_ref: string;
  category: string;
  status: string;
  sort_order: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: cosmetic.id,
    name: cosmetic.name,
    description: cosmetic.description,
    tier: cosmetic.tier,
    price: cosmetic.price,
    previewImageKey: cosmetic.preview_image_key,
    unityAssetRef: cosmetic.unity_asset_ref,
    category: cosmetic.category,
    status: cosmetic.status,
    sortOrder: cosmetic.sort_order,
    deletedAt: cosmetic.deleted_at?.toISOString() ?? null,
    createdAt: cosmetic.created_at.toISOString(),
    updatedAt: cosmetic.updated_at.toISOString(),
  };
}

/**
 * GET /api/admin/cosmetics
 * List cosmetics with optional filters and pagination.
 */
export const listCosmetics = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { search, status, limit, offset } = res.locals.validated
    ?.query as ListCosmeticsQuery;

  const where: Prisma.cosmeticsWhereInput = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const [cosmetics, total] = await Promise.all([
    prisma.cosmetics.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.cosmetics.count({ where }),
  ]);

  sendSuccess(res, {
    cosmetics: cosmetics.map(serializeCosmetic),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + cosmetics.length < total,
    },
  });
};

/**
 * POST /api/admin/cosmetics
 * Create a new cosmetic.
 */
export const createCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    name,
    description,
    tier,
    price,
    category,
    previewImageKey,
    unityAssetRef,
    status,
    sortOrder,
  } = res.locals.validated?.body as CreateCosmeticBody;

  const cosmetic = await prisma.cosmetics.create({
    data: {
      name,
      description,
      tier,
      price,
      category,
      preview_image_key: previewImageKey,
      unity_asset_ref: unityAssetRef,
      status,
      sort_order: sortOrder,
    },
  });

  logger.info('Cosmetic created', { cosmeticId: cosmetic.id, name });
  sendSuccess(res, { cosmetic: serializeCosmetic(cosmetic) }, 201);
};

/**
 * GET /api/admin/cosmetics/:id
 * Get a single cosmetic by ID.
 */
export const getCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as CosmeticIdParams;

  const cosmetic = await prisma.cosmetics.findUnique({ where: { id } });
  if (!cosmetic) {
    throw new NotFoundException('COSMETIC_NOT_FOUND', 'Cosmetic not found');
  }

  sendSuccess(res, { cosmetic: serializeCosmetic(cosmetic) });
};

/**
 * PATCH /api/admin/cosmetics/:id
 * Update a cosmetic.
 */
export const updateCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as UpdateCosmeticParams;
  const body = res.locals.validated?.body as UpdateCosmeticBody;

  const existing = await prisma.cosmetics.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException('COSMETIC_NOT_FOUND', 'Cosmetic not found');
  }

  const data: Prisma.cosmeticsUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.tier !== undefined) data.tier = body.tier;
  if (body.price !== undefined) data.price = body.price;
  if (body.category !== undefined) data.category = body.category;
  if (body.previewImageKey !== undefined) {
    data.preview_image_key = body.previewImageKey;
    if (
      existing.preview_image_key &&
      existing.preview_image_key !== body.previewImageKey
    ) {
      try {
        await deleteFile(existing.preview_image_key);
      } catch {
        logger.warn('Failed to delete old cosmetic preview image', {
          cosmeticId: id,
          key: existing.preview_image_key,
        });
      }
    }
  }
  if (body.unityAssetRef !== undefined)
    data.unity_asset_ref = body.unityAssetRef;
  if (body.status !== undefined) data.status = body.status;
  if (body.sortOrder !== undefined) data.sort_order = body.sortOrder;

  const cosmetic = await prisma.cosmetics.update({ where: { id }, data });

  logger.info('Cosmetic updated', { cosmeticId: id });
  sendSuccess(res, { cosmetic: serializeCosmetic(cosmetic) });
};

/**
 * DELETE /api/admin/cosmetics/:id
 * Soft-delete a cosmetic by setting deleted_at.
 */
export const deleteCosmetic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as CosmeticIdParams;

  const existing = await prisma.cosmetics.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException('COSMETIC_NOT_FOUND', 'Cosmetic not found');
  }

  const cosmetic = await prisma.cosmetics.update({
    where: { id },
    data: { deleted_at: new Date(), status: 'INACTIVE' },
  });

  logger.info('Cosmetic soft-deleted', { cosmeticId: id });
  sendSuccess(res, { cosmetic: serializeCosmetic(cosmetic) });
};
