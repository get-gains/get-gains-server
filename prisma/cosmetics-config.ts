export interface CosmeticConfig {
  name: string;
  description: string;
  tier: number;
  price: number; // Gains Coin cost (0 = free)
  /**
   * Base name of the prefab (no .prefab). Must match
   * `get-gains-unity-embed/Assets/Resources/FlutterEmbed/Cosmetics/CosmeticAssets/<ref>.prefab`
   * (built from source art under `Assets/Resources/Cosmetics/...`).
   * Runtime load path: `Resources.Load("FlutterEmbed/Cosmetics/CosmeticAssets/<ref>")`.
   */
  unityAssetRef: string;
  sortOrder: number;
}

/**
 * Kept in sync with prefabs in the Unity embed:
 * - Sources: `get-gains-unity-embed/Assets/Resources/Cosmetics/{Head,Hats,Facewear}/`
 * - Playable prefabs: `.../Resources/FlutterEmbed/Cosmetics/CosmeticAssets/*.prefab`
 */
export const COSMETICS_CONFIG: CosmeticConfig[] = [
  {
    name: 'Eye Cosmetic',
    description: 'A full-head cosmetic built from the Eye cosmetic mesh.',
    tier: 1,
    price: 0,
    unityAssetRef: 'eye_cosmetic_get_gains',
    sortOrder: 1,
  },
  {
    name: '2016 Gamer Glasses',
    description: 'Retro gamer-style glasses facewear.',
    tier: 1,
    price: 0,
    unityAssetRef: '2016_gamer_glasses_get_gains',
    sortOrder: 2,
  },
  {
    name: 'Classic Glasses',
    description: 'Classic glasses facewear.',
    tier: 1,
    price: 0,
    unityAssetRef: 'glasses_get_gains',
    sortOrder: 3,
  },
  {
    name: 'Beanie',
    description: 'A cozy beanie hat.',
    tier: 1,
    price: 0,
    unityAssetRef: 'beanie_get_gains',
    sortOrder: 4,
  },
  {
    name: 'Cowboy Hat',
    description: 'A cowboy hat cosmetic prefab.',
    tier: 1,
    price: 0,
    unityAssetRef: 'cowboy_hat_get_gains',
    sortOrder: 5,
  },
];
