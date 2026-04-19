-- DropForeignKey
ALTER TABLE "payment_history" DROP CONSTRAINT "payment_history_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_history" DROP CONSTRAINT "payment_history_subscription_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_history" DROP CONSTRAINT "payment_history_user_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_plan" DROP CONSTRAINT "provider_plan_subscription_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_subscription_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_user_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_event" DROP CONSTRAINT "subscription_event_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_event" DROP CONSTRAINT "subscription_event_webhook_event_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_plan_history" DROP CONSTRAINT "subscription_plan_history_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_plan_history" DROP CONSTRAINT "subscription_plan_history_subscription_plan_id_fkey";

-- DropTable
DROP TABLE "payment_history";

-- DropTable
DROP TABLE "provider_plan";

-- DropTable
DROP TABLE "subscription";

-- DropTable
DROP TABLE "subscription_event";

-- DropTable
DROP TABLE "subscription_plan";

-- DropTable
DROP TABLE "subscription_plan_history";

-- DropTable
DROP TABLE "webhook_event";

-- DropEnum
DROP TYPE "BillingCycle";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "Provider";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "WebhookStatus";
