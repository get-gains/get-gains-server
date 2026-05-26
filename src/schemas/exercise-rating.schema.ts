import { z } from 'zod';

export const CreateRatingSchema = z.object({
  body: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});

export type CreateRatingInput = z.infer<typeof CreateRatingSchema>['body'];

export const DeleteRatingSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});

export type DeleteRatingParams = z.infer<typeof DeleteRatingSchema>['params'];
