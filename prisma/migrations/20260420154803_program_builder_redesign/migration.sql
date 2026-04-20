/*
  Warnings:

  - You are about to drop the column `program_id` on the `assigned_program` table. All the data in the column will be lost.
  - You are about to drop the column `routine_id` on the `assigned_program_routine` table. All the data in the column will be lost.
  - You are about to drop the `program` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `coach_id` to the `assigned_program` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `assigned_program` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `assigned_program` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `assigned_program_routine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estimated_duration_minutes` to the `assigned_program_routine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `assigned_program_routine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_in_program` to the `assigned_program_routine` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "assigned_program" DROP CONSTRAINT "assigned_program_program_id_fkey";

-- DropForeignKey
ALTER TABLE "assigned_program_routine" DROP CONSTRAINT "assigned_program_routine_routine_id_fkey";

-- DropForeignKey
ALTER TABLE "program" DROP CONSTRAINT "program_user_id_fkey";

-- DropIndex
DROP INDEX "assigned_program_program_id_idx";

-- DropIndex
DROP INDEX "assigned_program_routine_routine_id_idx";

-- AlterTable
ALTER TABLE "assigned_program" DROP COLUMN "program_id",
ADD COLUMN     "coach_id" TEXT NOT NULL,
ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "assigned_program_routine" DROP COLUMN "routine_id",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "estimated_duration_minutes" INTEGER NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "order_in_program" INTEGER NOT NULL,
ADD COLUMN     "source_routine_id" TEXT;

-- AlterTable
ALTER TABLE "performed_set" ADD COLUMN     "exercise_name_snapshot" TEXT,
ADD COLUMN     "target_reps_max" INTEGER,
ADD COLUMN     "target_reps_min" INTEGER,
ADD COLUMN     "target_rest_seconds" INTEGER,
ADD COLUMN     "target_weight_kg" DOUBLE PRECISION;

-- DropTable
DROP TABLE "program";

-- CreateIndex
CREATE INDEX "assigned_program_coach_id_idx" ON "assigned_program"("coach_id");

-- CreateIndex
CREATE INDEX "assigned_program_routine_source_routine_id_idx" ON "assigned_program_routine"("source_routine_id");

-- AddForeignKey
ALTER TABLE "assigned_program" ADD CONSTRAINT "assigned_program_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_program_routine" ADD CONSTRAINT "assigned_program_routine_source_routine_id_fkey" FOREIGN KEY ("source_routine_id") REFERENCES "routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
