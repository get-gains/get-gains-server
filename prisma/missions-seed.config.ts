/**
 * Mission board seed data (partners + missions).
 *
 * Align with `../../papers/GetGains-FinalPaper.extracted.txt` after running:
 *   `python scripts/extract_getgains_paper.py` (repo root).
 * Only `COMPLETE_WORKOUTS` and `EARN_COINS` are listed by the API and receive
 * automatic progress; other goal types require code changes in missions.service.
 */

export const SUPPORTED_SEED_GOAL_TYPES = [
  'COMPLETE_WORKOUTS',
  'EARN_COINS',
] as const;
export type SupportedSeedGoalType = (typeof SUPPORTED_SEED_GOAL_TYPES)[number];

export type PartnerSeed = {
  id: string;
  name: string;
  logoKey: string;
  bio: string;
  socialLinks: string[];
};

export type MissionSeed = {
  id: string;
  /** Null = platform mission (not sponsor-branded) */
  partnerId: string | null;
  title: string;
  description: string;
  goalType: SupportedSeedGoalType;
  goalToReach: number;
  rewardCoins: number;
  rewardTitle?: string | null;
  rewardDescription?: string | null;
  /** S3 key for reward artwork; use null if none */
  rewardImageKey?: string | null;
  /** If set, completion creates a raffle entry (and enforces a global cap of completions with rewards) */
  maxWinners?: number | null;
  isRepeatable: boolean;
  /** ISO 8601, or null = unbounded (always active) */
  startsAt: string | null;
  endsAt: string | null;
};

/** Default sponsor for paper-aligned partner campaigns (update copy from the final paper). */
export const PARTNER_SEED: PartnerSeed[] = [
  {
    id: 'cmbbseed1partner0getg1',
    name: 'Get Gains',
    logoKey: 'partners/seed/get-gains.png',
    bio: 'The Get Gains platform — workouts, form feedback, and Gains Coins. Replace this bio with the official partner or sponsor blurb from the final paper if different.',
    socialLinks: ['https://getgains.app'],
  },
];

/**
 * Representative mission board. Replace titles, numbers, and dates to match
 * the GetGains final paper; keep `goalType` in SUPPORTED_SEED_GOAL_TYPES.
 */
export const MISSION_SEED: MissionSeed[] = [
  {
    id: 'cmbbseed1m1workouts',
    partnerId: null,
    title: 'Complete 5 workouts',
    description:
      'Finish five workout sessions (program or standalone). Progress advances when you complete a session that earns Gains Coins.',
    goalType: 'COMPLETE_WORKOUTS',
    goalToReach: 5,
    rewardCoins: 150,
    rewardTitle: '150 Gains Coins',
    rewardDescription: 'One-time grant when you hit the target.',
    rewardImageKey: null,
    maxWinners: null,
    isRepeatable: false,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'cmbbseed1m2earncoins',
    partnerId: 'cmbbseed1partner0getg1',
    title: 'Earn 1,000 session Gains Coins',
    description:
      'Accumulate 1,000 Gains Coins from session rewards (same pool counted by mission progress after each qualifying workout).',
    goalType: 'EARN_COINS',
    goalToReach: 1000,
    rewardCoins: 200,
    rewardTitle: '200 Gains Coins',
    rewardDescription: 'Bonus for dedicated training.',
    rewardImageKey: null,
    maxWinners: null,
    isRepeatable: false,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'cmbbseed1m3raffle',
    partnerId: 'cmbbseed1partner0getg1',
    title: 'Launch raffle entry',
    description:
      'Complete the goal to enter a limited raffle (see final paper for prize and rules). This seed uses a coin reward of 0; completion still records a raffle entry when max winners is set.',
    goalType: 'COMPLETE_WORKOUTS',
    goalToReach: 1,
    rewardCoins: 0,
    rewardTitle: 'Raffle entry',
    rewardDescription: 'You are entered into the draw while spots remain.',
    rewardImageKey: null,
    maxWinners: 100,
    isRepeatable: false,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'cmbbseed1m4weekly',
    partnerId: null,
    title: 'Repeatable weekly check-in',
    description:
      'Optional evergreen mission: complete 3 workouts per cycle. Repeatable — resets for another cycle after you finish.',
    goalType: 'COMPLETE_WORKOUTS',
    goalToReach: 3,
    rewardCoins: 50,
    rewardTitle: '50 Gains Coins',
    rewardDescription: 'Repeatable weekly bonus.',
    rewardImageKey: null,
    maxWinners: null,
    isRepeatable: true,
    startsAt: null,
    endsAt: null,
  },
] satisfies MissionSeed[];
