import type { PrismaClient } from '@prisma/client';
import {
  MISSION_SEED,
  PARTNER_SEED,
  SUPPORTED_SEED_GOAL_TYPES,
} from './missions-seed.config';

function parseOptionalDate(iso: string | null): Date | null {
  if (iso == null || iso === '') {
    return null;
  }
  return new Date(iso);
}

/**
 * Idempotent: upserts partners then missions by stable `id` values.
 * Re-run `npx prisma db seed` to refresh copy, dates, and numbers from config.
 */
export async function seedMissions(prisma: PrismaClient): Promise<void> {
  console.log('Seeding partners and missions...');

  for (const p of PARTNER_SEED) {
    await prisma.partner.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        logo_key: p.logoKey,
        bio: p.bio,
        social_links: p.socialLinks,
      },
      update: {
        name: p.name,
        logo_key: p.logoKey,
        bio: p.bio,
        social_links: p.socialLinks,
      },
    });
    console.log(`  ✓ partner — ${p.name} (${p.id})`);
  }

  for (const m of MISSION_SEED) {
    if (!SUPPORTED_SEED_GOAL_TYPES.includes(m.goalType)) {
      throw new Error(
        `missions-seed: unsupported goalType "${m.goalType}" for mission ${m.id}`
      );
    }
    if (m.partnerId != null) {
      const exists = await prisma.partner.findUnique({
        where: { id: m.partnerId },
        select: { id: true },
      });
      if (!exists) {
        throw new Error(
          `missions-seed: partner_id ${m.partnerId} not found for mission ${m.id}`
        );
      }
    }

    await prisma.mission.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        partner_id: m.partnerId,
        title: m.title,
        description: m.description,
        goal_type: m.goalType,
        goal_to_reach: m.goalToReach,
        reward_coins: m.rewardCoins,
        reward_title: m.rewardTitle ?? null,
        reward_description: m.rewardDescription ?? null,
        reward_image_key: m.rewardImageKey ?? null,
        max_winners: m.maxWinners ?? null,
        is_repeatable: m.isRepeatable,
        starts_at: parseOptionalDate(m.startsAt),
        ends_at: parseOptionalDate(m.endsAt),
      },
      update: {
        partner_id: m.partnerId,
        title: m.title,
        description: m.description,
        goal_type: m.goalType,
        goal_to_reach: m.goalToReach,
        reward_coins: m.rewardCoins,
        reward_title: m.rewardTitle ?? null,
        reward_description: m.rewardDescription ?? null,
        reward_image_key: m.rewardImageKey ?? null,
        max_winners: m.maxWinners ?? null,
        is_repeatable: m.isRepeatable,
        starts_at: parseOptionalDate(m.startsAt),
        ends_at: parseOptionalDate(m.endsAt),
      },
    });
    console.log(`  ✓ mission — ${m.title} (${m.id})`);
  }

  console.log(
    `\nSeeded ${PARTNER_SEED.length} partners and ${MISSION_SEED.length} missions.`
  );
}
