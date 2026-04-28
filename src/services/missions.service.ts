import type { PrismaClient, mission, user_mission } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export const MISSION_STATUS_IN_PROGRESS = 'in_progress';
export const MISSION_STATUS_COMPLETED = 'completed';

/** Application-level mission goal kinds (stored in mission.goal_type). */
export const GOAL_TYPE_COMPLETE_WORKOUTS = 'COMPLETE_WORKOUTS';
export const GOAL_TYPE_EARN_COINS = 'EARN_COINS';

const SUPPORTED_GOAL_TYPES = [
  GOAL_TYPE_COMPLETE_WORKOUTS,
  GOAL_TYPE_EARN_COINS,
] as const;

type SupportedGoal = (typeof SUPPORTED_GOAL_TYPES)[number];

function isSupportedGoal(goal: string): goal is SupportedGoal {
  return (SUPPORTED_GOAL_TYPES as readonly string[]).includes(goal);
}

function missionWhereActive(now: Date): Prisma.missionWhereInput {
  return {
    AND: [
      { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
      { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      { goal_type: { in: [...SUPPORTED_GOAL_TYPES] } },
    ],
  };
}

/**
 * After a successful session coin award: advance COMPLETE_WORKOUTS (+1) and
 * EARN_COINS (+session coin total) for all active missions, then complete when
 * progress reaches goal_to_reach (coins + raffle + repeatable reset).
 */
export async function recordMissionProgressAfterSession(
  userId: string,
  sessionCoinsEarned: number,
  prisma: PrismaClient
): Promise<void> {
  if (sessionCoinsEarned < 0) {
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const missions = await tx.mission.findMany({
        where: missionWhereActive(now),
      });

      for (const mission of missions) {
        if (!isSupportedGoal(mission.goal_type)) {
          continue;
        }
        await processMissionIncrementForSession(
          tx,
          userId,
          mission,
          mission.goal_type === GOAL_TYPE_COMPLETE_WORKOUTS
            ? { workoutDelta: 1, coinDelta: 0 }
            : { workoutDelta: 0, coinDelta: sessionCoinsEarned }
        );
      }
    });
  } catch (error) {
    logger.error('recordMissionProgressAfterSession failed', {
      userId,
      sessionCoinsEarned,
      error,
    });
  }
}

async function processMissionIncrementForSession(
  tx: Prisma.TransactionClient,
  userId: string,
  mission: mission,
  deltas: { workoutDelta: number; coinDelta: number }
): Promise<void> {
  const delta =
    mission.goal_type === GOAL_TYPE_COMPLETE_WORKOUTS
      ? deltas.workoutDelta
      : deltas.coinDelta;

  if (delta <= 0 && mission.goal_type === GOAL_TYPE_EARN_COINS) {
    return;
  }
  if (delta <= 0 && mission.goal_type === GOAL_TYPE_COMPLETE_WORKOUTS) {
    return;
  }

  let um = await tx.user_mission.findUnique({
    where: {
      user_id_mission_id: { user_id: userId, mission_id: mission.id },
    },
  });

  if (!um) {
    um = await tx.user_mission.create({
      data: {
        user_id: userId,
        mission_id: mission.id,
        status: MISSION_STATUS_IN_PROGRESS,
        progress: 0,
      },
    });
  }

  if (um.status === MISSION_STATUS_COMPLETED && !mission.is_repeatable) {
    return;
  }

  if (um.status === MISSION_STATUS_COMPLETED && mission.is_repeatable) {
    um = await tx.user_mission.update({
      where: { id: um.id },
      data: {
        status: MISSION_STATUS_IN_PROGRESS,
        progress: 0,
        completed_at: null,
      },
    });
  }

  let progress = um.progress + delta;
  const goal = mission.goal_to_reach;

  if (!mission.is_repeatable) {
    if (progress < goal) {
      await tx.user_mission.update({
        where: { id: um.id },
        data: { progress },
      });
      return;
    }
    await tx.user_mission.update({
      where: { id: um.id },
      data: { progress: goal },
    });
    await finalizeMissionCompletion(tx, userId, um.id, mission);
    return;
  }

  // Repeatable: allow multiple completions in one session (mainly EARN_COINS).
  while (progress >= goal) {
    await tx.user_mission.update({
      where: { id: um.id },
      data: { progress: goal },
    });
    await finalizeMissionCompletion(tx, userId, um.id, mission);
    progress -= goal;
  }
  await tx.user_mission.update({
    where: { id: um.id },
    data: { progress },
  });
}

/**
 * Count missions already marked completed (global cap for max_winners).
 */
async function countGlobalCompletions(
  tx: Prisma.TransactionClient,
  missionId: string
): Promise<number> {
  return tx.user_mission.count({
    where: {
      mission_id: missionId,
      status: MISSION_STATUS_COMPLETED,
    },
  });
}

/**
 * Awards coins, optional raffle entry, then resets repeatable missions for the next cycle.
 */
async function finalizeMissionCompletion(
  tx: Prisma.TransactionClient,
  userId: string,
  userMissionId: string,
  mission: mission
): Promise<void> {
  // Repeatable missions reset status to in_progress after reward, so a global
  // "completed" count is meaningless for caps; ignore max_winners / raffle cap.
  const effectiveMaxWinners = mission.is_repeatable
    ? null
    : mission.max_winners;
  const completedBefore = await countGlobalCompletions(tx, mission.id);
  const slotAvailable =
    effectiveMaxWinners == null || completedBefore < effectiveMaxWinners;

  const rewardCoins = slotAvailable ? mission.reward_coins : 0;

  if (rewardCoins > 0) {
    const [userRow] = await tx.$queryRaw<Array<{ coin_balance: number }>>`
      SELECT coin_balance FROM "user" WHERE supabase_auth_id = ${userId} FOR UPDATE
    `;
    if (!userRow) {
      logger.warn('finalizeMissionCompletion: user missing', { userId });
    } else {
      const newBalance = userRow.coin_balance + rewardCoins;
      await tx.coin_transactions.create({
        data: {
          user_id: userId,
          transaction_type: 'MISSION_REWARD',
          value: rewardCoins,
          balance_after: newBalance,
          user_mission_id: userMissionId,
        },
      });
      await tx.user.update({
        where: { supabase_auth_id: userId },
        data: { coin_balance: newBalance },
      });
    }
  }

  if (effectiveMaxWinners != null && slotAvailable) {
    await tx.raffle_entry.create({
      data: { user_mission_id: userMissionId },
    });
  }

  await tx.user_mission.update({
    where: { id: userMissionId },
    data: {
      status: MISSION_STATUS_COMPLETED,
      completed_at: new Date(),
    },
  });

  if (mission.is_repeatable) {
    await tx.user_mission.update({
      where: { id: userMissionId },
      data: {
        status: MISSION_STATUS_IN_PROGRESS,
        progress: 0,
        completed_at: null,
      },
    });
  }
}

export type MissionListItem = {
  id: string;
  partnerId: string | null;
  title: string;
  description: string;
  goalType: string;
  goalToReach: number;
  rewardCoins: number;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardImageKey: string | null;
  maxWinners: number | null;
  isRepeatable: boolean;
  startsAt: string | null;
  endsAt: string | null;
  partner: {
    id: string;
    name: string;
    logoKey: string;
  } | null;
  userMission: {
    id: string;
    status: string;
    progress: number;
    completedAt: string | null;
  } | null;
};

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function serializeUserMission(um: user_mission) {
  return {
    id: um.id,
    status: um.status,
    progress: um.progress,
    completedAt: toIso(um.completed_at),
  };
}

/**
 * Active missions (time window + supported goal types) with optional user progress.
 */
export async function listActiveMissionsForUser(
  userId: string,
  prisma: PrismaClient
): Promise<MissionListItem[]> {
  const now = new Date();
  const rows = await prisma.mission.findMany({
    where: missionWhereActive(now),
    include: {
      partner: true,
      user_missions: { where: { user_id: userId }, take: 1 },
    },
    orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
  });

  return rows.map((m) => {
    const um = m.user_missions[0];
    return {
      id: m.id,
      partnerId: m.partner_id,
      title: m.title,
      description: m.description,
      goalType: m.goal_type,
      goalToReach: m.goal_to_reach,
      rewardCoins: m.reward_coins,
      rewardTitle: m.reward_title,
      rewardDescription: m.reward_description,
      rewardImageKey: m.reward_image_key,
      maxWinners: m.max_winners,
      isRepeatable: m.is_repeatable,
      startsAt: toIso(m.starts_at),
      endsAt: toIso(m.ends_at),
      partner: m.partner
        ? {
            id: m.partner.id,
            name: m.partner.name,
            logoKey: m.partner.logo_key,
          }
        : null,
      userMission: um ? serializeUserMission(um) : null,
    };
  });
}
