import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export interface RaffleWinnerResult {
  userId: string;
  rank: number;
  email: string;
  fullName: string;
}

/**
 * Draw `winnerCount` unique winners from all raffle entries for a mission.
 * Each raffle entry is one weighted ticket; users with more entries have a
 * higher chance of winning. Winners are returned in rank order.
 *
 * @param tx           Prisma transaction client
 * @param missionId    Mission to draw winners for
 * @param winnerCount  Number of unique winners to draw
 * @returns Array of winners (ranked 1..N)
 * @throws Error if there are no entries or winnerCount < 1
 */
export async function drawRaffleWinners(
  tx: Prisma.TransactionClient,
  missionId: string,
  winnerCount: number
): Promise<RaffleWinnerResult[]> {
  if (winnerCount < 1) {
    throw new Error('winnerCount must be at least 1');
  }

  const entries = await tx.raffle_entry.findMany({
    where: {
      user_mission: { mission_id: missionId },
    },
    include: {
      user_mission: {
        include: {
          user: {
            select: {
              supabase_auth_id: true,
              email: true,
              full_name: true,
            },
          },
        },
      },
    },
  });

  if (entries.length === 0) {
    throw new Error('No raffle entries for this mission');
  }

  // Fisher-Yates shuffle of entries to give each ticket equal weight.
  const shuffled = shuffle([...entries]);

  const seenUsers = new Set<string>();
  const winners: RaffleWinnerResult[] = [];

  for (const entry of shuffled) {
    const userId = entry.user_mission.user.supabase_auth_id;
    if (seenUsers.has(userId)) {
      continue;
    }
    seenUsers.add(userId);
    winners.push({
      userId,
      rank: winners.length + 1,
      email: entry.user_mission.user.email,
      fullName: entry.user_mission.user.full_name,
    });
    if (winners.length >= winnerCount) {
      break;
    }
  }

  if (winners.length === 0) {
    throw new Error('No winners could be drawn');
  }

  logger.info('Raffle winners drawn', {
    missionId,
    winnerCount: winners.length,
    userIds: winners.map((w) => w.userId),
  });

  return winners;
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Persist raffle winners, close the mission, and create notifications.
 *
 * @param prisma  Prisma client (will start its own transaction)
 * @param missionId Mission ID
 * @param winnerCount Number of winners to draw
 * @returns Persisted winners
 */
export async function finalizeRaffleDraw(
  prisma: PrismaClient,
  missionId: string,
  winnerCount: number
): Promise<RaffleWinnerResult[]> {
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.findUnique({
      where: { id: missionId },
    });

    if (!mission) {
      throw new Error('Mission not found');
    }

    if (mission.reward_type !== 'RAFFLE') {
      throw new Error('Mission is not a raffle mission');
    }

    if (mission.is_closed) {
      throw new Error('Mission is already closed');
    }

    const winners = await drawRaffleWinners(tx, missionId, winnerCount);

    await tx.raffle_winner.createMany({
      data: winners.map((w) => ({
        mission_id: missionId,
        user_id: w.userId,
        rank: w.rank,
      })),
    });

    await tx.notification.createMany({
      data: winners.map((w) => ({
        user_id: w.userId,
        type: 'mission_raffle_won' as const,
        title: 'You won!',
        body: "Congratulations! You've won the mission raffle. You'll be contacted by email soon.",
        data: { missionId, rank: w.rank },
      })),
    });

    await tx.mission.update({
      where: { id: missionId },
      data: { is_closed: true, ends_at: new Date() },
    });

    return winners;
  });
}
