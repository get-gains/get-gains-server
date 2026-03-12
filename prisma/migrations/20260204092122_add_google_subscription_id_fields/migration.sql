-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "googleBasePlanId" TEXT,
ADD COLUMN     "googleSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Plan_googleSubscriptionId_idx" ON "Plan"("googleSubscriptionId");
