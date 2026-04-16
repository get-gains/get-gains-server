-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'REVOKED', 'PAUSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'FAILED', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CameraAngle" AS ENUM ('FRONT', 'SIDE_LEFT', 'SIDE_RIGHT', 'REAR', 'ANGLE_45_LEFT', 'ANGLE_45_RIGHT');

-- CreateEnum
CREATE TYPE "BodySegment" AS ENUM ('HEAD_NECK', 'LEFT_ARM', 'RIGHT_ARM', 'TORSO', 'LEFT_LEG', 'RIGHT_LEG', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('SESSION_REWARD', 'SHOP_PURCHASE');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GOOGLE_PLAY', 'APPLE');

-- CreateTable
CREATE TABLE "user" (
    "supabase_auth_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "is_coach" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "avatar_key" TEXT,
    "height_cm" INTEGER,
    "weight_kg" INTEGER,
    "sex" TEXT,
    "date_of_birth" TIMESTAMPTZ,
    "equipment_available" TEXT[],
    "experience_level" TEXT,
    "active_weekdays" TEXT[],
    "coin_balance" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("supabase_auth_id")
);

-- CreateTable
CREATE TABLE "coach" (
    "user_id" TEXT NOT NULL,
    "certifications" TEXT[],
    "specialties" TEXT[],
    "social_links" TEXT[],
    "max_clients" INTEGER NOT NULL DEFAULT 40,
    "accepting_clients" BOOLEAN NOT NULL DEFAULT true,
    "is_discoverable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coach_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "subscribed_coach" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscribed_coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_duration_minutes" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_muscles" TEXT[],
    "active_segments" TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_form" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "camera_angle" "CameraAngle" NOT NULL,
    "recorded_frames_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exercise_form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assigned_program" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "notes" TEXT,
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assigned_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assigned_program_routine" (
    "id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "assigned_program_id" TEXT NOT NULL,
    "days_of_week" TEXT[],
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assigned_program_routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assigned_program_routine_exercise" (
    "id" TEXT NOT NULL,
    "assigned_program_routine_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps_min" INTEGER NOT NULL,
    "reps_max" INTEGER NOT NULL,
    "rest_seconds" INTEGER NOT NULL,
    "order_in_routine" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assigned_program_routine_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_session" (
    "id" TEXT NOT NULL,
    "assigned_program_routine_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "feedback" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workout_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performed_set" (
    "id" TEXT NOT NULL,
    "workout_session_id" TEXT NOT NULL,
    "assigned_program_routine_exercise_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "recorded_frames_key" TEXT,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "performed_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cosmetics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "preview_image_key" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cosmetics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cosmetic" (
    "user_id" TEXT NOT NULL,
    "cosmetic_id" TEXT NOT NULL,
    "equipped_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_cosmetic_pkey" PRIMARY KEY ("user_id","cosmetic_id")
);

-- CreateTable
CREATE TABLE "coin_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_type" "CoinTransactionType" NOT NULL,
    "value" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "set_coins" INTEGER,
    "accuracy_multiplier" DOUBLE PRECISION,
    "completion_bonus" INTEGER,
    "duration_bonus" INTEGER,
    "streak_bonus" INTEGER,
    "streak_value" INTEGER,
    "sets_completed" INTEGER,
    "avg_accuracy" DOUBLE PRECISION,
    "session_duration_min" INTEGER,
    "workout_session_id" TEXT,
    "user_cosmetic_user_id" TEXT,
    "user_cosmetic_cosmetic_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_key" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "social_links" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goal_type" TEXT NOT NULL,
    "goal_to_reach" INTEGER NOT NULL,
    "reward_title" TEXT,
    "reward_description" TEXT,
    "reward_image_key" TEXT,
    "max_winners" INTEGER,
    "is_repeatable" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mission" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_entry" (
    "id" TEXT NOT NULL,
    "user_mission_id" TEXT NOT NULL,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "raffle_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "tier_level" INTEGER NOT NULL DEFAULT 0,
    "billing_cycle" "BillingCycle" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "trial_period_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_plan" (
    "id" TEXT NOT NULL,
    "subscription_plan_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "provider_product_id" TEXT NOT NULL,
    "provider_subscription_id" TEXT,
    "provider_base_plan_id" TEXT,
    "provider_metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "provider_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_plan_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "external_subscription_id" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "next_billing_date" TIMESTAMPTZ NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "trial_start_date" TIMESTAMPTZ,
    "trial_end_date" TIMESTAMPTZ,
    "purchase_token" TEXT,
    "order_id" TEXT,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "provider_metadata" JSONB,
    "is_discounted" BOOLEAN NOT NULL DEFAULT false,
    "discount_description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_history" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "subscription_plan_id" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ NOT NULL,
    "effective_until" TIMESTAMPTZ,
    "change_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plan_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "subscription_plan_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_date" TIMESTAMPTZ NOT NULL,
    "provider_order_id" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "payment_method" TEXT,
    "refunded_at" TIMESTAMPTZ,
    "refund_amount_cents" INTEGER,
    "refund_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "event_type" TEXT NOT NULL,
    "subscription_id" TEXT,
    "raw_payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_event" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_status" "SubscriptionStatus",
    "to_status" "SubscriptionStatus",
    "triggered_by" TEXT,
    "reason" TEXT,
    "webhook_event_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "subscribed_coach_user_id_idx" ON "subscribed_coach"("user_id");

-- CreateIndex
CREATE INDEX "subscribed_coach_coach_id_idx" ON "subscribed_coach"("coach_id");

-- CreateIndex
CREATE INDEX "program_user_id_idx" ON "program"("user_id");

-- CreateIndex
CREATE INDEX "routine_user_id_idx" ON "routine"("user_id");

-- CreateIndex
CREATE INDEX "exercise_user_id_idx" ON "exercise"("user_id");

-- CreateIndex
CREATE INDEX "exercise_is_public_idx" ON "exercise"("is_public");

-- CreateIndex
CREATE INDEX "exercise_form_exercise_id_camera_angle_idx" ON "exercise_form"("exercise_id", "camera_angle");

-- CreateIndex
CREATE INDEX "assigned_program_user_id_idx" ON "assigned_program"("user_id");

-- CreateIndex
CREATE INDEX "assigned_program_program_id_idx" ON "assigned_program"("program_id");

-- CreateIndex
CREATE INDEX "assigned_program_routine_assigned_program_id_idx" ON "assigned_program_routine"("assigned_program_id");

-- CreateIndex
CREATE INDEX "assigned_program_routine_routine_id_idx" ON "assigned_program_routine"("routine_id");

-- CreateIndex
CREATE INDEX "assigned_program_routine_exercise_assigned_program_routine__idx" ON "assigned_program_routine_exercise"("assigned_program_routine_id");

-- CreateIndex
CREATE INDEX "assigned_program_routine_exercise_exercise_id_idx" ON "assigned_program_routine_exercise"("exercise_id");

-- CreateIndex
CREATE INDEX "workout_session_assigned_program_routine_id_idx" ON "workout_session"("assigned_program_routine_id");

-- CreateIndex
CREATE INDEX "workout_session_completed_at_idx" ON "workout_session"("completed_at");

-- CreateIndex
CREATE INDEX "performed_set_workout_session_id_idx" ON "performed_set"("workout_session_id");

-- CreateIndex
CREATE INDEX "performed_set_assigned_program_routine_exercise_id_idx" ON "performed_set"("assigned_program_routine_exercise_id");

-- CreateIndex
CREATE INDEX "cosmetics_category_idx" ON "cosmetics"("category");

-- CreateIndex
CREATE INDEX "user_cosmetic_user_id_idx" ON "user_cosmetic"("user_id");

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_created_at_idx" ON "coin_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "coin_transactions_workout_session_id_idx" ON "coin_transactions"("workout_session_id");

-- CreateIndex
CREATE INDEX "mission_partner_id_idx" ON "mission"("partner_id");

-- CreateIndex
CREATE INDEX "mission_starts_at_ends_at_idx" ON "mission"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "user_mission_user_id_idx" ON "user_mission"("user_id");

-- CreateIndex
CREATE INDEX "user_mission_mission_id_idx" ON "user_mission"("mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_mission_user_id_mission_id_key" ON "user_mission"("user_id", "mission_id");

-- CreateIndex
CREATE INDEX "raffle_entry_user_mission_id_idx" ON "raffle_entry"("user_mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_name_key" ON "subscription_plan"("name");

-- CreateIndex
CREATE INDEX "subscription_plan_is_active_sort_order_idx" ON "subscription_plan"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "provider_plan_provider_provider_subscription_id_idx" ON "provider_plan"("provider", "provider_subscription_id");

-- CreateIndex
CREATE INDEX "provider_plan_subscription_plan_id_idx" ON "provider_plan"("subscription_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_plan_provider_provider_product_id_key" ON "provider_plan"("provider", "provider_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_external_subscription_id_key" ON "subscription"("external_subscription_id");

-- CreateIndex
CREATE INDEX "subscription_user_id_status_current_period_end_idx" ON "subscription"("user_id", "status", "current_period_end");

-- CreateIndex
CREATE INDEX "subscription_purchase_token_idx" ON "subscription"("purchase_token");

-- CreateIndex
CREATE INDEX "subscription_user_id_created_at_idx" ON "subscription"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_plan_history_subscription_id_effective_until_idx" ON "subscription_plan_history"("subscription_id", "effective_until");

-- CreateIndex
CREATE INDEX "subscription_plan_history_subscription_id_effective_from_idx" ON "subscription_plan_history"("subscription_id", "effective_from");

-- CreateIndex
CREATE INDEX "payment_history_user_id_payment_date_idx" ON "payment_history"("user_id", "payment_date");

-- CreateIndex
CREATE INDEX "payment_history_status_idx" ON "payment_history"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_history_subscription_id_provider_order_id_key" ON "payment_history"("subscription_id", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_idempotency_key_key" ON "webhook_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_event_status_created_at_idx" ON "webhook_event"("status", "created_at");

-- CreateIndex
CREATE INDEX "webhook_event_subscription_id_idx" ON "webhook_event"("subscription_id");

-- CreateIndex
CREATE INDEX "webhook_event_provider_event_type_idx" ON "webhook_event"("provider", "event_type");

-- CreateIndex
CREATE INDEX "subscription_event_subscription_id_created_at_idx" ON "subscription_event"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_event_webhook_event_id_idx" ON "subscription_event"("webhook_event_id");

-- AddForeignKey
ALTER TABLE "coach" ADD CONSTRAINT "coach_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribed_coach" ADD CONSTRAINT "subscribed_coach_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribed_coach" ADD CONSTRAINT "subscribed_coach_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine" ADD CONSTRAINT "routine_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_form" ADD CONSTRAINT "exercise_form_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program" ADD CONSTRAINT "assigned_program_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program" ADD CONSTRAINT "assigned_program_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program_routine" ADD CONSTRAINT "assigned_program_routine_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program_routine" ADD CONSTRAINT "assigned_program_routine_assigned_program_id_fkey" FOREIGN KEY ("assigned_program_id") REFERENCES "assigned_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program_routine_exercise" ADD CONSTRAINT "assigned_program_routine_exercise_assigned_program_routine_fkey" FOREIGN KEY ("assigned_program_routine_id") REFERENCES "assigned_program_routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program_routine_exercise" ADD CONSTRAINT "assigned_program_routine_exercise_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_assigned_program_routine_id_fkey" FOREIGN KEY ("assigned_program_routine_id") REFERENCES "assigned_program_routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performed_set" ADD CONSTRAINT "performed_set_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "workout_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performed_set" ADD CONSTRAINT "performed_set_assigned_program_routine_exercise_id_fkey" FOREIGN KEY ("assigned_program_routine_exercise_id") REFERENCES "assigned_program_routine_exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cosmetic" ADD CONSTRAINT "user_cosmetic_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cosmetic" ADD CONSTRAINT "user_cosmetic_cosmetic_id_fkey" FOREIGN KEY ("cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "workout_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_cosmetic_user_id_user_cosmetic_cosm_fkey" FOREIGN KEY ("user_cosmetic_user_id", "user_cosmetic_cosmetic_id") REFERENCES "user_cosmetic"("user_id", "cosmetic_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission" ADD CONSTRAINT "mission_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mission" ADD CONSTRAINT "user_mission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mission" ADD CONSTRAINT "user_mission_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_entry" ADD CONSTRAINT "raffle_entry_user_mission_id_fkey" FOREIGN KEY ("user_mission_id") REFERENCES "user_mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_plan" ADD CONSTRAINT "provider_plan_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_history" ADD CONSTRAINT "subscription_plan_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_history" ADD CONSTRAINT "subscription_plan_history_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_event" ADD CONSTRAINT "subscription_event_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_event" ADD CONSTRAINT "subscription_event_webhook_event_id_fkey" FOREIGN KEY ("webhook_event_id") REFERENCES "webhook_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
