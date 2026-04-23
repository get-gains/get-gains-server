-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "RcSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStore" AS ENUM ('APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "RcEventType" AS ENUM ('INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE', 'TRANSFER', 'SUBSCRIPTION_PAUSED', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT', 'REFUND', 'TEST');

-- CreateEnum
CREATE TYPE "RcEventStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "active_subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "user_subscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "status" "RcSubscriptionStatus" NOT NULL,
    "store" "SubscriptionStore" NOT NULL,
    "entitlement_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rc_original_tx_id" TEXT,
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "trial_ends_at" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "will_renew" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rc_subscription_event" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" "RcEventType" NOT NULL,
    "status" "RcEventStatus" NOT NULL DEFAULT 'PENDING',
    "from_tier" "SubscriptionTier",
    "to_tier" "SubscriptionTier",
    "from_status" "RcSubscriptionStatus",
    "to_status" "RcSubscriptionStatus",
    "store" "SubscriptionStore",
    "product_id" TEXT,
    "entitlement_id" TEXT,
    "rc_event_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rc_subscription_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_subscription_user_id_key" ON "user_subscription"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscription_rc_original_tx_id_key" ON "user_subscription"("rc_original_tx_id");

-- CreateIndex
CREATE INDEX "user_subscription_status_current_period_end_idx" ON "user_subscription"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "user_subscription_tier_status_idx" ON "user_subscription"("tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rc_subscription_event_rc_event_id_key" ON "rc_subscription_event"("rc_event_id");

-- CreateIndex
CREATE INDEX "rc_subscription_event_user_id_occurred_at_idx" ON "rc_subscription_event"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "rc_subscription_event_status_created_at_idx" ON "rc_subscription_event"("status", "created_at");

-- AddForeignKey
ALTER TABLE "user_subscription" ADD CONSTRAINT "user_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rc_subscription_event" ADD CONSTRAINT "rc_subscription_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Set active_subscription_tier = PREMIUM for users with active GP subscriptions
UPDATE "user" u
SET "active_subscription_tier" = 'PREMIUM'
FROM "subscription" s
JOIN "subscription_plan" sp ON sp."id" = s."subscription_plan_id"
WHERE s."user_id" = u."supabase_auth_id"
  AND s."status" = 'ACTIVE'
  AND s."current_period_end" > NOW()
  AND sp."tier_level" >= 1;
