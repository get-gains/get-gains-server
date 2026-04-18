/**
 * Grant an active app subscription to a user by email (local/staging/dev).
 *
 * Usage:
 *   pnpm run seed:subscription -- <email>
 *   pnpm exec tsx scripts/seed-dev-subscription.ts <email>
 *
 * Requires DATABASE_URL. If no active subscription_plan exists, creates a
 * minimal `__dev_seed_plan__` row (otherwise prefers highest tier_level).
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BillingCycle,
  PrismaClient,
  Provider,
  SubscriptionStatus,
} from '@prisma/client';

const DEV_PLAN_NAME = '__dev_seed_plan__';

async function main(): Promise<number> {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: pnpm run seed:subscription -- <email>');
    return 1;
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    return 1;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`No user row found for email: ${email}`);
      return 1;
    }

    let plan = await prisma.subscription_plan.findFirst({
      where: { is_active: true },
      orderBy: [{ tier_level: 'desc' }, { sort_order: 'asc' }],
    });

    if (!plan) {
      plan = await prisma.subscription_plan.upsert({
        where: { name: DEV_PLAN_NAME },
        create: {
          name: DEV_PLAN_NAME,
          description: 'Created by seed-dev-subscription when no plans exist',
          features: ['dev'],
          tier_level: 2,
          billing_cycle: BillingCycle.MONTHLY,
          price_cents: 0,
          currency: 'USD',
          is_active: true,
          sort_order: 0,
        },
        update: { is_active: true },
      });
      console.log('No active plans in DB; using fallback dev plan:', plan.name);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const existing = await prisma.subscription.findFirst({
      where: {
        user_id: user.supabase_auth_id,
        status: SubscriptionStatus.ACTIVE,
        current_period_end: { gt: now },
      },
    });

    if (existing) {
      console.log(
        `User already has an active subscription (id=${existing.id}, plan=${existing.subscription_plan_id}). Skipping.`
      );
      return 0;
    }

    const externalId = `seed_dev_${crypto.randomUUID()}`;

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          user_id: user.supabase_auth_id,
          subscription_plan_id: plan.id,
          provider: Provider.GOOGLE_PLAY,
          status: SubscriptionStatus.ACTIVE,
          external_subscription_id: externalId,
          start_date: now,
          current_period_start: now,
          current_period_end: periodEnd,
          next_billing_date: periodEnd,
          auto_renew: true,
        },
      });

      await tx.subscription_plan_history.create({
        data: {
          subscription_id: sub.id,
          subscription_plan_id: plan.id,
          effective_from: now,
          effective_until: null,
          change_reason: 'seed_dev',
        },
      });

      return sub;
    });

    console.log('Seeded subscription:', {
      email: user.email,
      subscriptionId: subscription.id,
      planName: plan.name,
      planId: plan.id,
      tierLevel: plan.tier_level,
      currentPeriodEnd: periodEnd.toISOString(),
    });
    return 0;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
