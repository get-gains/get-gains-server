-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('SESSION_REWARD', 'SHOP_PURCHASE');

-- CreateEnum
CREATE TYPE "CosmeticCategory" AS ENUM ('HEADWEAR', 'TOP', 'BOTTOM', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "CosmeticStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "CoinBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CoinBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CoinTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "setCoins" INTEGER,
    "accuracyMultiplier" DOUBLE PRECISION,
    "completionBonus" INTEGER,
    "durationBonus" INTEGER,
    "streakBonus" INTEGER,
    "streakValue" INTEGER,
    "setsCompleted" INTEGER,
    "avgAccuracy" DOUBLE PRECISION,
    "sessionDurationMin" INTEGER,
    "workoutSessionId" TEXT,
    "userCosmeticId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cosmetic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" INTEGER NOT NULL,
    "coinCost" INTEGER NOT NULL,
    "category" "CosmeticCategory" NOT NULL,
    "previewImageUrl" TEXT NOT NULL,
    "unityAssetRef" TEXT NOT NULL,
    "status" "CosmeticStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquippedCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "category" "CosmeticCategory" NOT NULL,
    "equippedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquippedCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EconomyConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoinBalance_userId_key" ON "CoinBalance"("userId");

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_workoutSessionId_idx" ON "CoinTransaction"("workoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Cosmetic_unityAssetRef_key" ON "Cosmetic"("unityAssetRef");

-- CreateIndex
CREATE INDEX "Cosmetic_status_tier_idx" ON "Cosmetic"("status", "tier");

-- CreateIndex
CREATE INDEX "Cosmetic_category_status_idx" ON "Cosmetic"("category", "status");

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_idx" ON "UserCosmetic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_cosmeticId_key" ON "UserCosmetic"("userId", "cosmeticId");

-- CreateIndex
CREATE INDEX "EquippedCosmetic_userId_idx" ON "EquippedCosmetic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EquippedCosmetic_userId_category_key" ON "EquippedCosmetic"("userId", "category");

-- AddForeignKey
ALTER TABLE "CoinBalance" ADD CONSTRAINT "CoinBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userCosmeticId_fkey" FOREIGN KEY ("userCosmeticId") REFERENCES "UserCosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquippedCosmetic" ADD CONSTRAINT "EquippedCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquippedCosmetic" ADD CONSTRAINT "EquippedCosmetic_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
