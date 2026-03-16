-- DropForeignKey
ALTER TABLE "AssignedProgram" DROP CONSTRAINT "AssignedProgram_programId_fkey";

-- DropForeignKey
ALTER TABLE "AssignedProgram" DROP CONSTRAINT "AssignedProgram_userId_fkey";

-- DropForeignKey
ALTER TABLE "CoinTransaction" DROP CONSTRAINT "CoinTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "EquippedCosmetic" DROP CONSTRAINT "EquippedCosmetic_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseForm" DROP CONSTRAINT "ExerciseForm_coachId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseForm" DROP CONSTRAINT "ExerciseForm_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "FormComparisonResult" DROP CONSTRAINT "FormComparisonResult_userId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentHistory" DROP CONSTRAINT "PaymentHistory_planId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentHistory" DROP CONSTRAINT "PaymentHistory_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentHistory" DROP CONSTRAINT "PaymentHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "PerformedSet" DROP CONSTRAINT "PerformedSet_routineExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "Program" DROP CONSTRAINT "Program_coachId_fkey";

-- DropForeignKey
ALTER TABLE "Program" DROP CONSTRAINT "Program_userId_fkey";

-- DropForeignKey
ALTER TABLE "PromoRedemption" DROP CONSTRAINT "PromoRedemption_userId_fkey";

-- DropForeignKey
ALTER TABLE "Routine" DROP CONSTRAINT "Routine_coachId_fkey";

-- DropForeignKey
ALTER TABLE "Routine" DROP CONSTRAINT "Routine_userId_fkey";

-- DropForeignKey
ALTER TABLE "SubscribedCoach" DROP CONSTRAINT "SubscribedCoach_coachId_fkey";

-- DropForeignKey
ALTER TABLE "SubscribedCoach" DROP CONSTRAINT "SubscribedCoach_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_planId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionEvent" DROP CONSTRAINT "SubscriptionEvent_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "UserCosmetic" DROP CONSTRAINT "UserCosmetic_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutSession" DROP CONSTRAINT "WorkoutSession_userId_fkey";

-- DropIndex
DROP INDEX "AssignedProgram_userId_programId_key";

-- DropIndex
DROP INDEX "EquippedCosmetic_userId_category_key";

-- DropIndex
DROP INDEX "ProgramRoutine_programId_routineId_key";

-- DropIndex
DROP INDEX "RoutineExercise_routineId_exerciseId_key";

-- DropIndex
DROP INDEX "SubscribedCoach_userId_coachId_key";

-- DropIndex
DROP INDEX "UserCosmetic_userId_cosmeticId_key";

-- AlterTable
ALTER TABLE "AssignedProgram" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "programId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "CoinTransaction" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EquippedCosmetic" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "ExerciseForm" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "exerciseId" DROP NOT NULL,
ALTER COLUMN "coachId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ExercisePoseConfig" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "FormComparisonResult" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PerformedSet" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "routineExerciseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "ProgramRoutine" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "PromoRedemption" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "RoutineExercise" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "SubscribedCoach" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "coachId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "UserCosmetic" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AssignedProgram_userId_programId_idx" ON "AssignedProgram"("userId", "programId");

-- CreateIndex
CREATE INDEX "AssignedProgram_deletedAt_idx" ON "AssignedProgram"("deletedAt");

-- CreateIndex
CREATE INDEX "AssignedProgram_userId_isActive_idx" ON "AssignedProgram"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Coach_deletedAt_idx" ON "Coach"("deletedAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_deletedAt_idx" ON "CoinTransaction"("deletedAt");

-- CreateIndex
CREATE INDEX "EquippedCosmetic_userId_category_idx" ON "EquippedCosmetic"("userId", "category");

-- CreateIndex
CREATE INDEX "EquippedCosmetic_deletedAt_idx" ON "EquippedCosmetic"("deletedAt");

-- CreateIndex
CREATE INDEX "Exercise_deletedAt_idx" ON "Exercise"("deletedAt");

-- CreateIndex
CREATE INDEX "Exercise_coachId_idx" ON "Exercise"("coachId");

-- CreateIndex
CREATE INDEX "Exercise_userId_idx" ON "Exercise"("userId");

-- CreateIndex
CREATE INDEX "ExerciseForm_deletedAt_idx" ON "ExerciseForm"("deletedAt");

-- CreateIndex
CREATE INDEX "ExercisePoseConfig_deletedAt_idx" ON "ExercisePoseConfig"("deletedAt");

-- CreateIndex
CREATE INDEX "FormComparisonResult_deletedAt_idx" ON "FormComparisonResult"("deletedAt");

-- CreateIndex
CREATE INDEX "PerformedSet_deletedAt_idx" ON "PerformedSet"("deletedAt");

-- CreateIndex
CREATE INDEX "PerformedSet_workoutSessionId_idx" ON "PerformedSet"("workoutSessionId");

-- CreateIndex
CREATE INDEX "PerformedSet_routineExerciseId_idx" ON "PerformedSet"("routineExerciseId");

-- CreateIndex
CREATE INDEX "Program_deletedAt_idx" ON "Program"("deletedAt");

-- CreateIndex
CREATE INDEX "Program_coachId_idx" ON "Program"("coachId");

-- CreateIndex
CREATE INDEX "Program_userId_idx" ON "Program"("userId");

-- CreateIndex
CREATE INDEX "ProgramRoutine_programId_routineId_idx" ON "ProgramRoutine"("programId", "routineId");

-- CreateIndex
CREATE INDEX "ProgramRoutine_deletedAt_idx" ON "ProgramRoutine"("deletedAt");

-- CreateIndex
CREATE INDEX "Routine_deletedAt_idx" ON "Routine"("deletedAt");

-- CreateIndex
CREATE INDEX "Routine_coachId_idx" ON "Routine"("coachId");

-- CreateIndex
CREATE INDEX "Routine_userId_idx" ON "Routine"("userId");

-- CreateIndex
CREATE INDEX "RoutineExercise_routineId_exerciseId_idx" ON "RoutineExercise"("routineId", "exerciseId");

-- CreateIndex
CREATE INDEX "RoutineExercise_deletedAt_idx" ON "RoutineExercise"("deletedAt");

-- CreateIndex
CREATE INDEX "SubscribedCoach_userId_coachId_idx" ON "SubscribedCoach"("userId", "coachId");

-- CreateIndex
CREATE INDEX "SubscribedCoach_deletedAt_idx" ON "SubscribedCoach"("deletedAt");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_cosmeticId_idx" ON "UserCosmetic"("userId", "cosmeticId");

-- CreateIndex
CREATE INDEX "UserCosmetic_deletedAt_idx" ON "UserCosmetic"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_deletedAt_idx" ON "WorkoutSession"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_createdAt_idx" ON "WorkoutSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_assignedProgramId_idx" ON "WorkoutSession"("userId", "assignedProgramId");

-- AddForeignKey
ALTER TABLE "SubscribedCoach" ADD CONSTRAINT "SubscribedCoach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscribedCoach" ADD CONSTRAINT "SubscribedCoach_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformedSet" ADD CONSTRAINT "PerformedSet_routineExerciseId_fkey" FOREIGN KEY ("routineExerciseId") REFERENCES "RoutineExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedProgram" ADD CONSTRAINT "AssignedProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedProgram" ADD CONSTRAINT "AssignedProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseForm" ADD CONSTRAINT "ExerciseForm_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseForm" ADD CONSTRAINT "ExerciseForm_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComparisonResult" ADD CONSTRAINT "FormComparisonResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquippedCosmetic" ADD CONSTRAINT "EquippedCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreatePartialUniqueIndex (replaces dropped @@unique constraints — only enforce uniqueness on non-deleted rows)
CREATE UNIQUE INDEX "SubscribedCoach_userId_coachId_unique_active" ON "SubscribedCoach"("userId", "coachId") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "ProgramRoutine_programId_routineId_unique_active" ON "ProgramRoutine"("programId", "routineId") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "RoutineExercise_routineId_exerciseId_unique_active" ON "RoutineExercise"("routineId", "exerciseId") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "AssignedProgram_userId_programId_unique_active" ON "AssignedProgram"("userId", "programId") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "UserCosmetic_userId_cosmeticId_unique_active" ON "UserCosmetic"("userId", "cosmeticId") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "EquippedCosmetic_userId_category_unique_active" ON "EquippedCosmetic"("userId", "category") WHERE "deletedAt" IS NULL;
