/*
  Warnings:

  - The `active_weekdays` column on the `user` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "injury_history" TEXT,
DROP COLUMN "active_weekdays",
ADD COLUMN     "active_weekdays" "DayOfWeek"[];
