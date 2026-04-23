import { ErrorCode } from './codes';

/**
 * Granular error detail that maps to a single item in the `errors[]` envelope.
 */
export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  field?: string;
}

/**
 * Base exception class for all application errors.
 * Thrown from controllers/middleware and caught by the global error handler.
 *
 * @example
 * throw new NotFoundException('USER_NOT_FOUND', 'User not found');
 */
export abstract class AppException extends Error {
  abstract readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(
    public readonly code: ErrorCode,
    message: string,
    details?: ErrorDetail[]
  ) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

/** 400 Bad Request */
export class BadRequestException extends AppException {
  readonly status = 400 as const;
}

/** 401 Unauthorized */
export class UnauthorizedException extends AppException {
  readonly status = 401 as const;
}

/** 402 Payment Required */
export class PaymentRequiredException extends AppException {
  readonly status = 402 as const;
}

/** 403 Forbidden */
export class ForbiddenException extends AppException {
  readonly status = 403 as const;
}

/** 404 Not Found */
export class NotFoundException extends AppException {
  readonly status = 404 as const;
}

/** 409 Conflict */
export class ConflictException extends AppException {
  readonly status = 409 as const;
}

/** 422 Unprocessable Entity */
export class UnprocessableException extends AppException {
  readonly status = 422 as const;
}

/** 429 Too Many Requests */
export class RateLimitException extends AppException {
  readonly status = 429 as const;
}

/** 500 Internal Server Error */
export class UnexpectedException extends AppException {
  readonly status = 500 as const;
}

/**
 * Validation-specific exception. Always uses the `VALIDATION_ERROR` code
 * and carries per-field details from Zod.
 */
export class ValidationException extends BadRequestException {
  constructor(details: ErrorDetail[]) {
    super('VALIDATION_ERROR', 'Validation failed', details);
  }
}
