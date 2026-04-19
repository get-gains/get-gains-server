import { Response } from 'express';
import type { ErrorCode } from '../lib/errors/codes';

/**
 * Standard API error structure.
 * `code` is a machine-readable SCREAMING_SNAKE_CASE identifier.
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  field?: string;
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
  code: ErrorCode,
  message: string,
  field?: string
): ApiResponse<null> => ({
  data: null,
  errors: [{ code, message, field }],
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
 * Sends a single error JSON response (convenience method).
 *
 * Supports two call signatures during migration:
 *  - **New:** `sendSingleError(res, code, message, status?, field?)`
 *  - **Legacy:** `sendSingleError(res, message, status?, field?)` — auto-injects `UNEXPECTED_EXCEPTION`
 *
 * Once all controllers are migrated to throw `AppException`, the legacy
 * overload (and this runtime check) will be removed.
 */
export function sendSingleError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode?: number,
  field?: string
): void;
/** @deprecated Use the (res, code, message, status?, field?) overload */
export function sendSingleError(
  res: Response,
  message: string,
  statusCode?: number,
  field?: string
): void;
export function sendSingleError(
  res: Response,
  codeOrMessage: string,
  messageOrStatus?: string | number,
  statusOrField?: number | string,
  maybeField?: string
): void {
  // Detect legacy call: second arg looks like a human message (not SCREAMING_SNAKE)
  const isLegacy =
    typeof messageOrStatus === 'number' || messageOrStatus === undefined;

  if (isLegacy) {
    // Legacy: sendSingleError(res, message, status?, field?)
    const message = codeOrMessage;
    const statusCode = (messageOrStatus as number | undefined) ?? 400;
    const field = statusOrField as string | undefined;
    res
      .status(statusCode)
      .json(
        buildSingleErrorResponse(
          'UNEXPECTED_EXCEPTION' as ErrorCode,
          message,
          field
        )
      );
  } else {
    // New: sendSingleError(res, code, message, status?, field?)
    const code = codeOrMessage as ErrorCode;
    const message = messageOrStatus as string;
    const statusCode = (statusOrField as number | undefined) ?? 400;
    const field = maybeField;
    res.status(statusCode).json(buildSingleErrorResponse(code, message, field));
  }
}
