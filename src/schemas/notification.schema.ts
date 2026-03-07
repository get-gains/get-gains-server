import { z } from 'zod';

/**
 * Create Notification Schema
 */
export const CreateNotificationSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    title: z.string().min(1, 'Title is required'),
    message: z.string().min(1, 'Message is required'),
    type: z.string().min(1, 'Type is required'),
  }),
});

export type CreateNotificationInput = z.infer<
  typeof CreateNotificationSchema
>['body'];

/**
 * Mark notification as read
 */
export const MarkNotificationReadSchema = z.object({
  params: z.object({
    notificationId: z.string(),
  }),
});

export type MarkNotificationReadInput = z.infer<
  typeof MarkNotificationReadSchema
>['params'];
