import { z } from 'zod';

/** GET /api/missions — no validated inputs; passthrough for Express query noise. */
export const ListMissionsRequestSchema = z.object({
  query: z.any().optional(),
  params: z.any().optional(),
  body: z.any().optional(),
});
