import { z } from 'zod';

// ── Class Leaderboard Params ──

export const ClassLeaderboardParamsSchema = z.object({
  params: z.object({
    coachId: z.string().min(1, 'Coach ID is required'),
  }),
});

export type ClassLeaderboardParams = z.infer<
  typeof ClassLeaderboardParamsSchema
>['params'];

// ── Class Leaderboard Query ──

export const ClassLeaderboardQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export type ClassLeaderboardQuery = z.infer<
  typeof ClassLeaderboardQuerySchema
>['query'];
