import { z } from 'zod';

/**
 * Schema for creating a coach profile (become a coach).
 * name and email default from User; all fields optional for overrides.
 */
export const CreateCoachProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      avatarUrl: z.string().url().optional(),
      bio: z.string().max(2000).optional(),
      yearsExperience: z.number().int().min(0).optional(),
      certifications: z.array(z.string()).optional(),
      certificationImageUrls: z.array(z.string().url()).optional(),
      awards: z.array(z.string()).optional(),
      specialties: z.array(z.string()).optional(),
      socialLinks: z.array(z.string().url()).optional(),
    })
    .optional()
    .default({}),
});

export type CreateCoachProfileInput = z.infer<
  typeof CreateCoachProfileSchema
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
 * Schema for assigning a program to a client
 */
export const AssignProgramSchema = z.object({
  body: z.object({
    userId: z.string().cuid('Invalid user ID'),
    programId: z.string().cuid('Invalid program ID'),
    startDate: z.string().datetime('Invalid start date'),
    endDate: z.string().datetime('Invalid end date').optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export type AssignProgramInput = z.infer<typeof AssignProgramSchema>['body'];

// ============== Assignment Management Schemas ==============

/**
 * Get all program assignments for a specific client
 */
export const GetClientProgramsSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
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
    assignmentId: z.string().cuid('Invalid assignment ID'),
  }),
  body: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
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
    assignmentId: z.string().cuid('Invalid assignment ID'),
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
    userId: z.string().cuid('Invalid user ID'),
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
    userId: z.string().cuid('Invalid user ID'),
    sessionId: z.string().cuid('Invalid session ID'),
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
    userId: z.string().cuid('Invalid user ID'),
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
    userId: z.string().cuid('Invalid user ID'),
    exerciseId: z.string().cuid('Invalid exercise ID'),
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

// ============== Client Form Results Schema (GAP 3) ==============

/**
 * Get a client's form comparison result history (coach view)
 */
export const GetClientFormResultsSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
  query: z.object({
    exerciseId: z.string().cuid('Invalid exercise ID').optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export type GetClientFormResultsParams = z.infer<
  typeof GetClientFormResultsSchema
>['params'];
export type GetClientFormResultsQuery = z.infer<
  typeof GetClientFormResultsSchema
>['query'];
