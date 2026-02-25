-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "coachId" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "customForUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_customForUserId_fkey" FOREIGN KEY ("customForUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
