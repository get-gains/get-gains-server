export interface CosmeticConfig {
  name: string;
  description: string;
  tier: number;
  price: number; // Gains Coin cost (0 = free)
  // Prefab name under Resources/FlutterEmbed/Cosmetics/CosmeticAssets/<Category>/
  // e.g. 'headwear_cup_lp' resolves to CosmeticAssets/Headwear/headwear_cup_lp.prefab
  // Must match the filename exactly (case-sensitive, no .prefab suffix).
  unityAssetRef: string;
  sortOrder: number;
}

export const COSMETICS_CONFIG: CosmeticConfig[] = [
  {
    name: 'Cup Hat',
    description: 'A stylish cup-shaped hat for your character.',
    tier: 1,
    price: 0,
    unityAssetRef: 'headwear_cup_lp', // → CosmeticAssets/Headwear/headwear_cup_lp.prefab
    sortOrder: 1,
  },
  {
    name: 'Glasses',
    description: 'Cool glasses to make your character look smart.',
    tier: 1,
    price: 0,
    // Prefab lives under Headwear/ (built by Tools > GetGains > Build Anchored Headwear Prefabs).
    unityAssetRef: 'headwear_glasses', // → CosmeticAssets/Headwear/headwear_glasses.prefab
    sortOrder: 2,
  },
];
