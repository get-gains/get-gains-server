import { Prisma } from '@prisma/client';
import {
  AppException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from './exceptions';

/**
 * Maps a Prisma known-request error to the appropriate AppException.
 *
 * @param err - Prisma client error with a P-code
 * @returns An AppException subclass ready for the global error handler
 */
export function mapPrismaError(
  err: Prisma.PrismaClientKnownRequestError
): AppException {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation
      const target =
        (err.meta?.target as string[] | undefined)?.join(', ') ?? 'unknown';
      return new ConflictException(
        'GENERIC_UNIQUE_CONSTRAINT',
        `Unique constraint violated on: ${target}`
      );
    }
    case 'P2025':
      // Record not found
      return new NotFoundException(
        'GENERIC_NOT_FOUND',
        (err.meta?.cause as string) ?? 'Record not found'
      );
    case 'P2003': {
      // Foreign key constraint failure
      const field = (err.meta?.field_name as string) ?? 'unknown';
      return new BadRequestException(
        'GENERIC_FOREIGN_KEY',
        `Foreign key constraint failed on: ${field}`
      );
    }
    default:
      return new BadRequestException(
        'UNEXPECTED_EXCEPTION',
        `Database error: ${err.code}`
      );
  }
}
