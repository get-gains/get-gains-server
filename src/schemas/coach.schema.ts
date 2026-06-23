import { z } from 'zod';

/**
 * Schema for creating a coach profile (become a coach).
 * Identity (name, email, avatar, bio) is read from the joined user row.
 */
export const CreateCoachProfileSchema = z.object({
  body: z
    .object({
      invitation_code: z.string().length(6).optional(),
      certifications: z.array(z.string()).optional(),
      specialties: z.array(z.string()).optional(),
      social_links: z.array(z.string().url()).optional(),
      years_experience: z.number().int().min(0).optional(),
      max_clients: z.number().int().min(1).optional(),
      accepting_clients: z.boolean().optional(),
      is_discoverable: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

export type CreateCoachProfileInput = z.infer<
  typeof CreateCoachProfileSchema
>['body'];

/**
 * Schema for verifying a coach invitation code in the mobile app.
 */
export const VerifyCoachInviteSchema = z.object({
  body: z.object({
    code: z.string().length(6, 'Code must be 6 characters'),
  }),
});

export type VerifyCoachInviteInput = z.infer<
  typeof VerifyCoachInviteSchema
>['body'];

/**
 * Schema for updating coach settings (capacity, intake, discoverability).
 * CamelCase body matches the Flutter client contract.
 */
export const UpdateCoachSettingsSchema = z.object({
  body: z
    .object({
      maxClients: z.number().int().min(1).max(1000).optional(),
      acceptingClients: z.boolean().optional(),
      isDiscoverable: z.boolean().optional(),
    })
    .refine(
      (data) =>
        data.maxClients !== undefined ||
        data.acceptingClients !== undefined ||
        data.isDiscoverable !== undefined,
      { message: 'At least one setting field must be provided' }
    ),
});

export type UpdateCoachSettingsInput = z.infer<
  typeof UpdateCoachSettingsSchema
>['body'];

/**
 * Schema for getting coach's clients with filters
 */
export const GetClientsSchema = z.object({
  query: z.object({
    filter: z.enum(['assigned', 'unassigned']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetClientsQuery = z.infer<typeof GetClientsSchema>['query'];

/**
 * Schema for getting performance report
 */
export const GetPerformanceSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetPerformanceQuery = z.infer<typeof GetPerformanceSchema>['query'];

/**
 * Get all program assignments for a specific client
 */
export const GetClientProgramsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
});

export type GetClientProgramsParams = z.infer<
  typeof GetClientProgramsSchema
>['params'];

/**
 * Update an existing program assignment
 */
export const UpdateAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().cuid2('Invalid assignment ID'),
  }),
  body: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
});

export type UpdateAssignmentParams = z.infer<
  typeof UpdateAssignmentSchema
>['params'];
export type UpdateAssignmentInput = z.infer<
  typeof UpdateAssignmentSchema
>['body'];

/**
 * Delete a program assignment
 */
export const DeleteAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().cuid2('Invalid assignment ID'),
  }),
});

export type DeleteAssignmentParams = z.infer<
  typeof DeleteAssignmentSchema
>['params'];

// ============== Client Progress Schemas (GAP 1) ==============

/**
 * Get a client's workout sessions (coach view)
 */
export const GetClientSessionsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    status: z
      .enum(['completed', 'active', 'all'])
      .optional()
      .default('completed'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

export type GetClientSessionsParams = z.infer<
  typeof GetClientSessionsSchema
>['params'];
export type GetClientSessionsQuery = z.infer<
  typeof GetClientSessionsSchema
>['query'];

/**
 * Get a specific client workout session with performed sets (coach view)
 */
export const GetClientSessionDetailSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
    sessionId: z.string().cuid2('Invalid session ID'),
  }),
});

export type GetClientSessionDetailParams = z.infer<
  typeof GetClientSessionDetailSchema
>['params'];

/**
 * Get a client's weekly stats (coach view)
 */
export const GetClientWeeklyStatsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
  query: z.object({
    weekOf: z.string().datetime().optional(),
  }),
});

export type GetClientWeeklyStatsParams = z.infer<
  typeof GetClientWeeklyStatsSchema
>['params'];
export type GetClientWeeklyStatsQuery = z.infer<
  typeof GetClientWeeklyStatsSchema
>['query'];

/**
 * Get exercise-level progress for a client over time (coach view)
 */
export const GetClientExerciseHistorySchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
    exerciseId: z.string().cuid2('Invalid exercise ID'),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export type GetClientExerciseHistoryParams = z.infer<
  typeof GetClientExerciseHistorySchema
>['params'];
export type GetClientExerciseHistoryQuery = z.infer<
  typeof GetClientExerciseHistorySchema
>['query'];

/**
 * Get paginated form comparison results for a client.
 */
export const GetClientFormResultsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'Invalid user ID'),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    exerciseId: z.string().optional(),
  }),
});

export type GetClientFormResultsParams = z.infer<
  typeof GetClientFormResultsSchema
>['params'];
export type GetClientFormResultsQuery = z.infer<
  typeof GetClientFormResultsSchema
>['query'];
