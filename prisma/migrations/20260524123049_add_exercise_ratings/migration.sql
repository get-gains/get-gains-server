/*
  Warnings:

  - You are about to drop the column `category` on the `cosmetics` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "cosmetics_category_idx";

-- AlterTable
ALTER TABLE "cosmetics" DROP COLUMN "category";

-- AlterTable
ALTER TABLE "exercise" ADD COLUMN     "thumbs_up_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "password_reset_otp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reset_token" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "cooldown_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_rating" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_otp_reset_token_key" ON "password_reset_otp"("reset_token");

-- CreateIndex
CREATE INDEX "password_reset_otp_email_verified_expires_at_idx" ON "password_reset_otp"("email", "verified", "expires_at");

-- CreateIndex
CREATE INDEX "password_reset_otp_reset_token_idx" ON "password_reset_otp"("reset_token");

-- CreateIndex
CREATE INDEX "exercise_rating_exercise_id_idx" ON "exercise_rating"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_rating_exercise_id_user_id_key" ON "exercise_rating"("exercise_id", "user_id");

-- AddForeignKey
ALTER TABLE "exercise_rating" ADD CONSTRAINT "exercise_rating_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_rating" ADD CONSTRAINT "exercise_rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;
