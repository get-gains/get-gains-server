import { z } from 'zod';

// Schema for GET /users/:id
export const GetUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});

// Schema for POST /users
export const CreateUserSchema = z.object({
  body: z.object({
    email: z.email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required'),
  }),
});

// Schema for PUT /users/:id
export const UpdateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    email: z.email('Invalid email address').optional(),
    name: z.string().min(1, 'Name cannot be empty').optional(),
  }),
});

// Inferred types for use in controllers
export type GetUserParams = z.infer<typeof GetUserSchema>['params'];
export type CreateUserBody = z.infer<typeof CreateUserSchema>['body'];
export type UpdateUserParams = z.infer<typeof UpdateUserSchema>['params'];
export type UpdateUserBody = z.infer<typeof UpdateUserSchema>['body'];
