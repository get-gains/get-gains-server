import { Response } from 'express';

/**
 * Standard API error structure
 */
export interface ApiError {
  field?: string;
  message: string;
}

/**
 * Standard API response structure
 * All API responses follow this format for consistency
 */
export interface ApiResponse<T = null> {
  data: T;
  errors: ApiError[];
}

/**
 * Builds a successful response with data
 */
export const buildSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  data,
  errors: [],
});

/**
 * Builds an error response with error details
 */
export const buildErrorResponse = (errors: ApiError[]): ApiResponse<null> => ({
  data: null,
  errors,
});

/**
 * Builds a single error response (convenience method)
 */
export const buildSingleErrorResponse = (
  message: string,
  field?: string
): ApiResponse<null> => ({
  data: null,
  errors: [{ message, field }],
});

/**
 * Sends a successful JSON response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void => {
  res.status(statusCode).json(buildSuccessResponse(data));
};

/**
 * Sends an error JSON response
 */
export const sendError = (
  res: Response,
  errors: ApiError[],
  statusCode: number = 400
): void => {
  res.status(statusCode).json(buildErrorResponse(errors));
};

/**
 * Sends a single error JSON response (convenience method)
 */
export const sendSingleError = (
  res: Response,
  message: string,
  statusCode: number = 400,
  field?: string
): void => {
  res.status(statusCode).json(buildSingleErrorResponse(message, field));
};
