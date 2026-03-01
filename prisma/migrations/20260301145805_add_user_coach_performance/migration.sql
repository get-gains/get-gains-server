-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "coachId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "coachId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
