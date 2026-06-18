import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';
import { deleteFile } from '../services/upload.service';
import { NotFoundException, ConflictException } from '../lib/errors';
import {
  CreatePartnerBody,
  UpdatePartnerParams,
  UpdatePartnerBody,
  PartnerIdParams,
  ListPartnersQuery,
} from '../schemas/admin-partners.schema';

function serializePartner(partner: {
  id: string;
  name: string;
  logo_key: string;
  bio: string;
  social_links: string[];
  created_at: Date;
  updated_at: Date;
  _count?: { missions: number };
}) {
  return {
    id: partner.id,
    name: partner.name,
    logoKey: partner.logo_key,
    bio: partner.bio,
    socialLinks: partner.social_links,
    missionCount: partner._count?.missions ?? 0,
    createdAt: partner.created_at.toISOString(),
    updatedAt: partner.updated_at.toISOString(),
  };
}

/**
 * GET /api/admin/partners
 * List partners with optional search and pagination.
 */
export const listPartners = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { search, limit, offset } = res.locals.validated
    ?.query as ListPartnersQuery;

  const where: Prisma.partnerWhereInput = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      include: { _count: { select: { missions: true } } },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.partner.count({ where }),
  ]);

  sendSuccess(res, {
    partners: partners.map(serializePartner),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + partners.length < total,
    },
  });
};

/**
 * POST /api/admin/partners
 * Create a new partner.
 */
export const createPartner = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name, bio, logoKey, socialLinks } = res.locals.validated
    ?.body as CreatePartnerBody;

  const partner = await prisma.partner.create({
    data: {
      name,
      bio,
      logo_key: logoKey,
      social_links: socialLinks,
    },
  });

  logger.info('Partner created', { partnerId: partner.id, name });
  sendSuccess(res, { partner: serializePartner(partner) }, 201);
};

/**
 * GET /api/admin/partners/:id
 * Get a single partner by ID.
 */
export const getPartner = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as PartnerIdParams;

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { _count: { select: { missions: true } } },
  });

  if (!partner) {
    throw new NotFoundException('PARTNER_NOT_FOUND', 'Partner not found');
  }

  sendSuccess(res, { partner: serializePartner(partner) });
};

/**
 * PATCH /api/admin/partners/:id
 * Update a partner.
 */
export const updatePartner = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as UpdatePartnerParams;
  const body = res.locals.validated?.body as UpdatePartnerBody;

  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException('PARTNER_NOT_FOUND', 'Partner not found');
  }

  const data: Prisma.partnerUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.bio !== undefined) data.bio = body.bio;
  if (body.logoKey !== undefined) {
    data.logo_key = body.logoKey;
    if (existing.logo_key && existing.logo_key !== body.logoKey) {
      try {
        await deleteFile(existing.logo_key);
      } catch {
        logger.warn('Failed to delete old partner logo', {
          partnerId: id,
          key: existing.logo_key,
        });
      }
    }
  }
  if (body.socialLinks !== undefined) data.social_links = body.socialLinks;

  const partner = await prisma.partner.update({
    where: { id },
    data,
    include: { _count: { select: { missions: true } } },
  });

  logger.info('Partner updated', { partnerId: id });
  sendSuccess(res, { partner: serializePartner(partner) });
};

/**
 * DELETE /api/admin/partners/:id
 * Delete a partner. Fails if the partner has linked missions.
 */
export const deletePartner = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as PartnerIdParams;

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { _count: { select: { missions: true } } },
  });

  if (!partner) {
    throw new NotFoundException('PARTNER_NOT_FOUND', 'Partner not found');
  }

  if (partner._count.missions > 0) {
    throw new ConflictException(
      'PARTNER_HAS_MISSIONS',
      'Cannot delete a partner with linked missions. Reassign or delete the missions first.'
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.partner.delete({ where: { id } });
    if (partner.logo_key) {
      try {
        await deleteFile(partner.logo_key);
      } catch {
        logger.warn('Failed to delete partner logo on delete', {
          partnerId: id,
          key: partner.logo_key,
        });
      }
    }
  });

  logger.info('Partner deleted', { partnerId: id });
  sendSuccess(res, { deleted: true });
};
