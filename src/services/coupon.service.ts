import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const DEFAULT_MISSION_OFFER_TAG = 'mission-20-off';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Ensure a coupon configuration exists for a coupon-type mission.
 * Called on mission creation/update.
 */
export async function ensureMissionCoupon(
  tx: Prisma.TransactionClient,
  missionId: string,
  offerTag?: string,
  description?: string
): Promise<void> {
  await tx.coupon.upsert({
    where: { mission_id: missionId },
    create: {
      mission_id: missionId,
      offer_tag: offerTag || DEFAULT_MISSION_OFFER_TAG,
      description:
        description || '20% off your first month of Premium — mission reward',
      discount_percent: 20,
    },
    update: {
      offer_tag: offerTag || DEFAULT_MISSION_OFFER_TAG,
      description:
        description || '20% off your first month of Premium — mission reward',
    },
  });
}

/**
 * Delete a mission's coupon configuration.
 */
export async function deleteMissionCoupon(
  tx: Prisma.TransactionClient,
  missionId: string
): Promise<void> {
  await tx.coupon.deleteMany({ where: { mission_id: missionId } });
}

/**
 * Grant a coupon to a user when they complete a coupon-type mission.
 * Idempotent: returns existing claim if already granted.
 *
 * @param prisma  Prisma client or transaction client
 * @param userId  User receiving the coupon
 * @param missionId  Mission the coupon is bound to
 */
export async function grantCouponOnMissionCompletion(
  prisma: PrismaLike,
  userId: string,
  missionId: string
): Promise<{ userCouponId: string; alreadyClaimed: boolean }> {
  const coupon = await prisma.coupon.findUnique({
    where: { mission_id: missionId },
  });

  if (!coupon) {
    throw new Error(`No coupon configured for mission ${missionId}`);
  }

  const existing = await prisma.user_coupon.findUnique({
    where: {
      user_id_coupon_id: { user_id: userId, coupon_id: coupon.id },
    },
  });

  if (existing) {
    return { userCouponId: existing.id, alreadyClaimed: true };
  }

  const userCoupon = await prisma.user_coupon.create({
    data: {
      user_id: userId,
      coupon_id: coupon.id,
    },
  });

  await prisma.notification.create({
    data: {
      user_id: userId,
      type: 'mission_coupon_earned',
      title: 'Coupon earned!',
      body: 'You earned a 20% off Premium coupon. Redeem it in the subscription screen.',
      data: { missionId, couponId: coupon.id },
    },
  });

  logger.info('Coupon granted on mission completion', {
    userId,
    missionId,
    couponId: coupon.id,
  });

  return { userCouponId: userCoupon.id, alreadyClaimed: false };
}
