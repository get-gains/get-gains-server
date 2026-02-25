import { z } from 'zod';

/**
 * Schema for PATCH /api/coach/settings
 * Coaches can update capacity, intake toggle, and discoverability.
 */
export const UpdateCoachSettingsSchema = z.object({
  body: z
    .object({
      maxClients: z
        .number()
        .int('Must be an integer')
        .min(1, 'Minimum is 1 client')
        .max(1000, 'Maximum is 1000 clients')
        .optional(),
      acceptingClients: z.boolean().optional(),
      isDiscoverable: z.boolean().optional(),
    })
    .strict(),
});

export type UpdateCoachSettingsInput = z.infer<
  typeof UpdateCoachSettingsSchema
>['body'];
