import { z } from 'zod';

export const RewardTypeEnum = z.enum(['COINS', 'RAFFLE', 'COUPON']);

const isoDateString = z
  .string()
  .datetime({ message: 'Invalid ISO date string' })
  .optional()
  .nullable();

export const CreateMissionSchema = z.object({
  body: z.object({
    partnerId: z.string().optional().nullable(),
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    goalType: z.string().min(1, 'Goal type is required'),
    goalToReach: z.preprocess(
      (val) => Number(val),
      z.number().int().min(1, 'Goal must be at least 1')
    ),
    rewardType: RewardTypeEnum.default('COINS'),
    rewardCoins: z.preprocess(
      (val) => (val === undefined ? 0 : Number(val)),
      z.number().int().min(0)
    ),
    rewardTitle: z.string().optional().nullable(),
    rewardDescription: z.string().optional().nullable(),
    rewardImageKey: z.string().optional().nullable(),
    maxWinners: z.preprocess(
      (val) => (val === undefined || val === null ? null : Number(val)),
      z.number().int().min(1).nullable().optional()
    ),
    isRepeatable: z.preprocess(
      (val) => (val === undefined ? false : val === true || val === 'true'),
      z.boolean()
    ),
    startsAt: isoDateString,
    endsAt: isoDateString,
    offerTag: z.string().optional().nullable(),
    couponDescription: z.string().optional().nullable(),
  }),
});
export type CreateMissionBody = z.infer<typeof CreateMissionSchema>['body'];

export const UpdateMissionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Mission ID is required'),
  }),
  body: z.object({
    partnerId: z.string().optional().nullable(),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    goalType: z.string().min(1).optional(),
    goalToReach: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(1).optional()
    ),
    rewardType: RewardTypeEnum.optional(),
    rewardCoins: z.preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    rewardTitle: z.string().optional().nullable(),
    rewardDescription: z.string().optional().nullable(),
    rewardImageKey: z.string().optional().nullable(),
    maxWinners: z.preprocess(
      (val) => (val === undefined || val === null ? undefined : Number(val)),
      z.number().int().min(1).nullable().optional()
    ),
    isRepeatable: z.preprocess(
      (val) => (val === undefined ? undefined : val === true || val === 'true'),
      z.boolean().optional()
    ),
    isClosed: z.preprocess(
      (val) => (val === undefined ? undefined : val === true || val === 'true'),
      z.boolean().optional()
    ),
    startsAt: isoDateString,
    endsAt: isoDateString,
    offerTag: z.string().optional().nullable(),
    couponDescription: z.string().optional().nullable(),
  }),
});
export type UpdateMissionParams = z.infer<typeof UpdateMissionSchema>['params'];
export type UpdateMissionBody = z.infer<typeof UpdateMissionSchema>['body'];

export const MissionIdParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Mission ID is required'),
  }),
});
export type MissionIdParams = z.infer<typeof MissionIdParamsSchema>['params'];

export const ListMissionsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    rewardType: RewardTypeEnum.optional(),
    status: z.enum(['ACTIVE', 'CLOSED', 'ALL']).optional(),
    limit: z.preprocess(
      (val) => (val === undefined ? 20 : Number(val)),
      z.number().int().min(1).max(100)
    ),
    offset: z.preprocess(
      (val) => (val === undefined ? 0 : Number(val)),
      z.number().int().min(0)
    ),
  }),
});
export type ListMissionsQuery = z.infer<
  typeof ListMissionsQuerySchema
>['query'];

export const DrawWinnersSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Mission ID is required'),
  }),
  body: z.object({
    winnerCount: z.preprocess(
      (val) => Number(val),
      z.number().int().min(1, 'At least 1 winner required')
    ),
  }),
});
export type DrawWinnersParams = z.infer<typeof DrawWinnersSchema>['params'];
export type DrawWinnersBody = z.infer<typeof DrawWinnersSchema>['body'];

export const MissionWinnersParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Mission ID is required'),
  }),
});
export type MissionWinnersParams = z.infer<
  typeof MissionWinnersParamsSchema
>['params'];
