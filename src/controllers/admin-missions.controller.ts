import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';
import { deleteFile } from '../services/upload.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '../lib/errors';
import { finalizeRaffleDraw } from '../services/raffle.service';
import {
  ensureMissionCoupon,
  deleteMissionCoupon,
} from '../services/coupon.service';
import {
  CreateMissionBody,
  UpdateMissionParams,
  UpdateMissionBody,
  MissionIdParams,
  ListMissionsQuery,
  DrawWinnersParams,
  DrawWinnersBody,
} from '../schemas/admin-missions.schema';

function serializeMission(
  mission: Prisma.missionGetPayload<{
    include: {
      partner: true;
      coupon: true;
      _count: { select: { user_missions: true; raffle_winners: true } };
    };
  }>
) {
  return {
    id: mission.id,
    partnerId: mission.partner_id,
    title: mission.title,
    description: mission.description,
    goalType: mission.goal_type,
    goalToReach: mission.goal_to_reach,
    rewardType: mission.reward_type,
    rewardCoins: mission.reward_coins,
    rewardTitle: mission.reward_title,
    rewardDescription: mission.reward_description,
    rewardImageKey: mission.reward_image_key,
    maxWinners: mission.max_winners,
    isRepeatable: mission.is_repeatable,
    isClosed: mission.is_closed,
    startsAt: mission.starts_at?.toISOString() ?? null,
    endsAt: mission.ends_at?.toISOString() ?? null,
    partner: mission.partner
      ? {
          id: mission.partner.id,
          name: mission.partner.name,
          logoKey: mission.partner.logo_key,
        }
      : null,
    coupon: mission.coupon
      ? {
          id: mission.coupon.id,
          offerTag: mission.coupon.offer_tag,
          description: mission.coupon.description,
          discountPercent: mission.coupon.discount_percent,
        }
      : null,
    stats: {
      completions: mission._count.user_missions,
      winners: mission._count.raffle_winners,
    },
    createdAt: mission.created_at.toISOString(),
    updatedAt: mission.updated_at.toISOString(),
  };
}

function validateMissionRules(body: {
  rewardType: string;
  isRepeatable?: boolean;
  maxWinners?: number | null;
  partnerId?: string | null;
  rewardCoins?: number;
}): void {
  if (body.rewardType === 'COUPON' && body.isRepeatable) {
    throw new BadRequestException(
      'MISSION_COUPON_NON_REPEATABLE',
      'Coupon missions must be non-repeatable'
    );
  }

  if (body.rewardType === 'RAFFLE') {
    if (!body.partnerId) {
      throw new BadRequestException(
        'MISSION_RAFFLE_REQUIRES_PARTNER',
        'Raffle missions require a partner'
      );
    }
    if (!body.maxWinners || body.maxWinners < 1) {
      throw new BadRequestException(
        'MISSION_RAFFLE_REQUIRES_MAX_WINNERS',
        'Raffle missions require max winners >= 1'
      );
    }
  }
}

/**
 * GET /api/admin/missions
 * List missions with optional filters and pagination.
 */
export const listMissions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { search, rewardType, status, limit, offset } = res.locals.validated
    ?.query as ListMissionsQuery;

  const where: Prisma.missionWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (rewardType) {
    where.reward_type = rewardType;
  }

  if (status === 'ACTIVE') {
    where.is_closed = false;
  } else if (status === 'CLOSED') {
    where.is_closed = true;
  }

  const [missions, total] = await Promise.all([
    prisma.mission.findMany({
      where,
      include: {
        partner: true,
        coupon: true,
        _count: {
          select: { user_missions: true, raffle_winners: true },
        },
      },
      orderBy: [{ created_at: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.mission.count({ where }),
  ]);

  sendSuccess(res, {
    missions: missions.map(serializeMission),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + missions.length < total,
    },
  });
};

/**
 * POST /api/admin/missions
 * Create a mission.
 */
export const createMission = async (
  req: Request,
  res: Response
): Promise<void> => {
  const body = res.locals.validated?.body as CreateMissionBody;
  validateMissionRules({
    rewardType: body.rewardType,
    isRepeatable: body.isRepeatable,
    maxWinners: body.maxWinners,
    partnerId: body.partnerId,
    rewardCoins: body.rewardCoins,
  });

  const mission = await prisma.$transaction(async (tx) => {
    const created = await tx.mission.create({
      data: {
        partner_id: body.partnerId,
        title: body.title,
        description: body.description,
        goal_type: body.goalType,
        goal_to_reach: body.goalToReach,
        reward_type: body.rewardType,
        reward_coins: body.rewardCoins,
        reward_title: body.rewardTitle,
        reward_description: body.rewardDescription,
        reward_image_key: body.rewardImageKey,
        max_winners: body.maxWinners,
        is_repeatable: body.isRepeatable,
        starts_at: body.startsAt,
        ends_at: body.endsAt,
      },
      include: { partner: true, coupon: true, _count: true },
    });

    if (body.rewardType === 'COUPON') {
      await ensureMissionCoupon(
        tx,
        created.id,
        body.offerTag ?? undefined,
        body.couponDescription ?? undefined
      );
    }

    return created;
  });

  logger.info('Mission created', {
    missionId: mission.id,
    title: mission.title,
  });

  const full = await prisma.mission.findUnique({
    where: { id: mission.id },
    include: {
      partner: true,
      coupon: true,
      _count: {
        select: { user_missions: true, raffle_winners: true },
      },
    },
  });

  sendSuccess(res, { mission: serializeMission(full!) }, 201);
};

/**
 * GET /api/admin/missions/:id
 * Get a single mission by ID.
 */
export const getMission = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as MissionIdParams;

  const mission = await prisma.mission.findUnique({
    where: { id },
    include: {
      partner: true,
      coupon: true,
      _count: {
        select: { user_missions: true, raffle_winners: true },
      },
    },
  });

  if (!mission) {
    throw new NotFoundException('MISSION_NOT_FOUND', 'Mission not found');
  }

  sendSuccess(res, { mission: serializeMission(mission) });
};

/**
 * PATCH /api/admin/missions/:id
 * Update a mission.
 */
export const updateMission = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as UpdateMissionParams;
  const body = res.locals.validated?.body as UpdateMissionBody;

  const existing = await prisma.mission.findUnique({
    where: { id },
    include: { coupon: true },
  });

  if (!existing) {
    throw new NotFoundException('MISSION_NOT_FOUND', 'Mission not found');
  }

  if (existing.is_closed) {
    throw new ConflictException(
      'MISSION_CLOSED',
      'Cannot edit a closed mission'
    );
  }

  const newRewardType = body.rewardType ?? existing.reward_type;
  const newIsRepeatable = body.isRepeatable ?? existing.is_repeatable;
  const newMaxWinners =
    body.maxWinners === undefined ? existing.max_winners : body.maxWinners;
  const newPartnerId =
    body.partnerId === undefined ? existing.partner_id : body.partnerId;

  validateMissionRules({
    rewardType: newRewardType,
    isRepeatable: newIsRepeatable,
    maxWinners: newMaxWinners,
    partnerId: newPartnerId,
    rewardCoins: body.rewardCoins ?? existing.reward_coins,
  });

  const data: Prisma.missionUpdateInput = {};
  if (body.partnerId !== undefined)
    data.partner = body.partnerId
      ? { connect: { id: body.partnerId } }
      : { disconnect: true };
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.goalType !== undefined) data.goal_type = body.goalType;
  if (body.goalToReach !== undefined) data.goal_to_reach = body.goalToReach;
  if (body.rewardType !== undefined) data.reward_type = body.rewardType;
  if (body.rewardCoins !== undefined) data.reward_coins = body.rewardCoins;
  if (body.rewardTitle !== undefined)
    data.reward_title = body.rewardTitle ?? null;
  if (body.rewardDescription !== undefined)
    data.reward_description = body.rewardDescription ?? null;
  if (body.rewardImageKey !== undefined) {
    data.reward_image_key = body.rewardImageKey ?? null;
    if (
      existing.reward_image_key &&
      body.rewardImageKey &&
      existing.reward_image_key !== body.rewardImageKey
    ) {
      try {
        await deleteFile(existing.reward_image_key);
      } catch {
        logger.warn('Failed to delete old mission reward image', {
          missionId: id,
          key: existing.reward_image_key,
        });
      }
    }
  }
  if (body.maxWinners !== undefined) data.max_winners = body.maxWinners;
  if (body.isRepeatable !== undefined) data.is_repeatable = body.isRepeatable;
  if (body.isClosed !== undefined) data.is_closed = body.isClosed;
  if (body.startsAt !== undefined) data.starts_at = body.startsAt;
  if (body.endsAt !== undefined) data.ends_at = body.endsAt;

  const wasCoupon = existing.reward_type === 'COUPON';

  const mission = await prisma.$transaction(async (tx) => {
    const updated = await tx.mission.update({
      where: { id },
      data,
      include: { partner: true, coupon: true, _count: true },
    });

    if (newRewardType === 'COUPON') {
      await ensureMissionCoupon(
        tx,
        updated.id,
        body.offerTag ?? existing.coupon?.offer_tag,
        body.couponDescription ?? existing.coupon?.description ?? undefined
      );
    } else if (wasCoupon) {
      await deleteMissionCoupon(tx, updated.id);
    }

    return updated;
  });

  logger.info('Mission updated', { missionId: id });

  const full = await prisma.mission.findUnique({
    where: { id: mission.id },
    include: {
      partner: true,
      coupon: true,
      _count: {
        select: { user_missions: true, raffle_winners: true },
      },
    },
  });

  sendSuccess(res, { mission: serializeMission(full!) });
};

/**
 * DELETE /api/admin/missions/:id
 * Soft-delete a mission by closing it.
 */
export const deleteMission = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as MissionIdParams;

  const existing = await prisma.mission.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException('MISSION_NOT_FOUND', 'Mission not found');
  }

  const mission = await prisma.mission.update({
    where: { id },
    data: { is_closed: true, ends_at: new Date() },
  });

  logger.info('Mission closed (soft-delete)', { missionId: id });
  sendSuccess(res, {
    mission: { id: mission.id, isClosed: mission.is_closed },
  });
};

/**
 * POST /api/admin/missions/:id/draw-winners
 * Draw raffle winners for a mission.
 */
export const drawWinners = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = res.locals.validated?.params as DrawWinnersParams;
  const { winnerCount } = res.locals.validated?.body as DrawWinnersBody;

  const mission = await prisma.mission.findUnique({
    where: { id },
    include: { _count: { select: { raffle_winners: true } } },
  });

  if (!mission) {
    throw new NotFoundException('MISSION_NOT_FOUND', 'Mission not found');
  }

  if (mission.reward_type !== 'RAFFLE') {
    throw new BadRequestException(
      'MISSION_NOT_RAFFLE',
      'This mission is not a raffle mission'
    );
  }

  if (mission.is_closed) {
    throw new ConflictException(
      'MISSION_ALREADY_CLOSED',
      'This mission is already closed'
    );
  }

  if (mission.max_winners && winnerCount > mission.max_winners) {
    throw new BadRequestException(
      'RAFFLE_TOO_MANY_WINNERS',
      `Cannot draw more than ${mission.max_winners} winners for this mission`
    );
  }

  const winners = await finalizeRaffleDraw(prisma, id, winnerCount);

  sendSuccess(res, {
    winners: winners.map((w) => ({
      userId: w.userId,
      rank: w.rank,
      email: w.email,
      fullName: w.fullName,
    })),
    mission: {
      id: mission.id,
      isClosed: true,
    },
  });
};
