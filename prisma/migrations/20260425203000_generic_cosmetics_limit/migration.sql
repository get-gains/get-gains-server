-- Brought in lockstep with the migration record already on some databases (e.g. Railway).
-- Drops denormalized cosmetics.category; follow-up 20260427000000_restore_cosmetics_category
-- re-adds it for API/seed/equip (category derived from unity_asset_ref on restore).

DROP INDEX IF EXISTS "cosmetics_category_idx";

ALTER TABLE "cosmetics" DROP COLUMN IF EXISTS "category";
