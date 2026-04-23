-- The columns unity_asset_ref / status / sort_order were added to the live DB
-- via `prisma db push` (no migration file was created at the time).  The shadow
-- database only knows about the columns declared in earlier migration files, so
-- this migration adds them with IF NOT EXISTS guards — safe to run on both the
-- shadow DB (which lacks the columns) and the live DB (which already has them).

ALTER TABLE "cosmetics"
    ADD COLUMN IF NOT EXISTS "unity_asset_ref" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "sort_order"      INTEGER NOT NULL DEFAULT 0;

-- Unique index on unity_asset_ref (matches @unique in schema.prisma).
-- IF NOT EXISTS avoids an error on the live DB where the index already exists.
CREATE UNIQUE INDEX IF NOT EXISTS "cosmetics_unity_asset_ref_key"
    ON "cosmetics"("unity_asset_ref");

-- Fix cosmetic Unity asset refs so they match the actual prefab names under
-- Resources/FlutterEmbed/Cosmetics/CosmeticAssets/<Category>/<assetRef>.prefab
--
-- Before: server sent FBX source paths ('Hats/Cup_LP', 'Facewear/glasses').
-- CosmeticManager.LoadAndAttachPrefab could not resolve these → silent no-op.
-- After:  correct prefab filenames ('headwear_cup_lp', 'headwear_glasses').
--
-- Glasses: also fix category ACCESSORY → HEADWEAR — the prefab lives under
-- CosmeticAssets/Headwear/, not Accessory/.
--
-- UPDATE (not DELETE+INSERT) preserves user_cosmetic foreign-key rows so users
-- keep their purchased and equipped items.

UPDATE "cosmetics"
SET "unity_asset_ref" = 'headwear_cup_lp',
    "updated_at"      = now()
WHERE "unity_asset_ref" = 'Hats/Cup_LP';

UPDATE "cosmetics"
SET "unity_asset_ref" = 'headwear_glasses',
    "category"        = 'HEADWEAR',
    "updated_at"      = now()
WHERE "unity_asset_ref" = 'Facewear/glasses';
