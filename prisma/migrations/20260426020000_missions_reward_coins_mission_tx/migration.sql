-- AlterEnum
ALTER TYPE "CoinTransactionType" ADD VALUE 'MISSION_REWARD';

-- AlterTable
ALTER TABLE "mission" ADD COLUMN "reward_coins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_mission" ADD COLUMN "completed_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "coin_transactions" ADD COLUMN "user_mission_id" TEXT;

-- CreateIndex
CREATE INDEX "coin_transactions_user_mission_id_idx" ON "coin_transactions"("user_mission_id");

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_mission_id_fkey" FOREIGN KEY ("user_mission_id") REFERENCES "user_mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
