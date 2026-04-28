-- Re-add category for API responses, Prisma relation filters, and shop/inventory.
-- Backfill from unity_asset_ref prefix convention (see prisma/cosmetics-config.ts).

ALTER TABLE "cosmetics" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'HEADWEAR';

UPDATE "cosmetics" SET "category" = 'HEADWEAR' WHERE "unity_asset_ref" LIKE 'headwear%';
UPDATE "cosmetics" SET "category" = 'TOP' WHERE "unity_asset_ref" LIKE 'top%';
UPDATE "cosmetics" SET "category" = 'BOTTOM' WHERE "unity_asset_ref" LIKE 'bottom%';
UPDATE "cosmetics" SET "category" = 'ACCESSORY' WHERE "unity_asset_ref" LIKE 'accessory%' OR "unity_asset_ref" ILIKE 'facewear%';

CREATE INDEX "cosmetics_category_idx" ON "cosmetics"("category");
