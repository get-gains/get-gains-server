-- CreateTable
CREATE TABLE "CoachSettings" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "maxClients" INTEGER NOT NULL DEFAULT 40,
    "acceptingClients" BOOLEAN NOT NULL DEFAULT true,
    "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CoachSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachSettings_coachId_key" ON "CoachSettings"("coachId");

-- AddForeignKey
ALTER TABLE "CoachSettings" ADD CONSTRAINT "CoachSettings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
