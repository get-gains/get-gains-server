-- CreateEnum
CREATE TYPE "CoachInviteStatus" AS ENUM ('PENDING', 'REDEEMED', 'REVOKED');

-- AlterTable
ALTER TABLE "coach" ADD COLUMN     "deactivated_at" TIMESTAMPTZ,
ADD COLUMN     "years_experience" INTEGER;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "coach_invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CoachInviteStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_by" TEXT NOT NULL,
    "redeemed_by" TEXT,
    "redeemed_at" TIMESTAMPTZ,
    "revoked_by" TEXT,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coach_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_invitation_email_status_expires_at_idx" ON "coach_invitation"("email", "status", "expires_at");

-- CreateIndex
CREATE INDEX "coach_invitation_code_status_idx" ON "coach_invitation"("code", "status");

-- AddForeignKey
ALTER TABLE "coach_invitation" ADD CONSTRAINT "coach_invitation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_invitation" ADD CONSTRAINT "coach_invitation_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "user"("supabase_auth_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_invitation" ADD CONSTRAINT "coach_invitation_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "user"("supabase_auth_id") ON DELETE SET NULL ON UPDATE CASCADE;
