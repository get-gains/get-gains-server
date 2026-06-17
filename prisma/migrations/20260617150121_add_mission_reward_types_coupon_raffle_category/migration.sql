-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('COINS', 'RAFFLE', 'COUPON');

-- CreateEnum
CREATE TYPE "CosmeticCategory" AS ENUM ('HEADWEAR', 'TOP', 'BOTTOM', 'ACCESSORY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'mission_raffle_won';
ALTER TYPE "NotificationType" ADD VALUE 'mission_coupon_earned';

-- AlterTable
ALTER TABLE "cosmetics" ADD COLUMN     "category" "CosmeticCategory" NOT NULL DEFAULT 'HEADWEAR';

-- AlterTable
ALTER TABLE "mission" ADD COLUMN     "is_closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reward_type" "RewardType" NOT NULL DEFAULT 'COINS';

-- CreateTable
CREATE TABLE "coupon" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "offer_tag" TEXT NOT NULL,
    "description" TEXT,
    "discount_percent" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_coupon" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_winner" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_winner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_mission_id_key" ON "coupon"("mission_id");

-- CreateIndex
CREATE INDEX "user_coupon_user_id_idx" ON "user_coupon"("user_id");

-- CreateIndex
CREATE INDEX "user_coupon_coupon_id_idx" ON "user_coupon"("coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_coupon_user_id_coupon_id_key" ON "user_coupon"("user_id", "coupon_id");

-- CreateIndex
CREATE INDEX "raffle_winner_mission_id_idx" ON "raffle_winner"("mission_id");

-- CreateIndex
CREATE INDEX "raffle_winner_user_id_idx" ON "raffle_winner"("user_id");

-- AddForeignKey
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupon" ADD CONSTRAINT "user_coupon_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupon" ADD CONSTRAINT "user_coupon_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_winner" ADD CONSTRAINT "raffle_winner_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_winner" ADD CONSTRAINT "raffle_winner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;
