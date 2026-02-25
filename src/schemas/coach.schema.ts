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
