/*
  Warnings:

  - Added the required column `coachId` to the `Routine` table without a default value. This is not possible if the table is not empty.

*/
-- Dev seed cleanup: remove ownerless routines before adding the required coachId column.
-- ProgramRoutine and RoutineExercise rows cascade-delete automatically.
DELETE FROM "Routine";

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "coachId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
