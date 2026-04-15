export interface DurationBonusTier {
  minMinutes: number;
  bonus: number;
}

export interface AccuracyTier {
  min: number;
  label: string;
  multiplier: number;
}

export interface LeaderboardWeights {
  sessions: number;
  streak: number;
  accuracy: number;
}

export const COINS_PER_SET = 3;

export const COMPLETION_BONUS = 10;

export const DURATION_BONUSES: readonly DurationBonusTier[] = [
  { minMinutes: 60, bonus: 15 },
  { minMinutes: 45, bonus: 8 },
  { minMinutes: 30, bonus: 3 },
];

export const STREAK_BONUS_PER_DAY = 2;

export const STREAK_BONUS_CAP = 20;

export const ACCURACY_TIERS: readonly AccuracyTier[] = [
  { min: 0.95, label: 'Perfect', multiplier: 1.7 },
  { min: 0.85, label: 'Great', multiplier: 1.3 },
  { min: 0.7, label: 'Good', multiplier: 1.0 },
  { min: 0.5, label: 'Fair', multiplier: 0.8 },
  { min: 0.0, label: 'Low', multiplier: 0.5 },
];

/** Leaderboard composite score weights (sessions : streak : accuracy). Must be non-negative; equal weights = 1:1:1. */
export const LEADERBOARD_WEIGHTS: Readonly<LeaderboardWeights> = {
  sessions: 1,
  streak: 1,
  accuracy: 1,
};
