import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/error-handler.middleware';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ValidationException,
  UnexpectedException,
} from '../src/lib/errors';

/**
 * Build a tiny Express 5 app that only mounts the error handler
 * plus minimal routes designed to throw specific errors.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  // Route that throws a NotFoundException
  app.get('/test/not-found', () => {
    throw new NotFoundException('USER_NOT_FOUND', 'User not found');
  });

  // Route that throws a BadRequestException
  app.post('/test/bad-request', () => {
    throw new BadRequestException('VALIDATION_ERROR', 'Invalid input');
  });

  // Route that throws a ConflictException
  app.post('/test/conflict', () => {
    throw new ConflictException(
      'GENERIC_UNIQUE_CONSTRAINT',
      'Email already taken'
    );
  });

  // Route that throws a ZodError (via parse)
  app.post('/test/zod-fail', (req) => {
    const schema = z.object({ email: z.string().email() });
    schema.parse(req.body);
  });

  // Route that throws a ValidationException directly
  app.post('/test/validation', () => {
    throw new ValidationException([
      {
        code: 'VALIDATION_ERROR',
        message: 'Email is required',
        field: 'body.email',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Name too short',
        field: 'body.name',
      },
    ]);
  });

  // Route that throws an unexpected error
  app.get('/test/unexpected', () => {
    throw new Error('kaboom');
  });

  // Route that throws UnexpectedException
  app.get('/test/unexpected-exc', () => {
    throw new UnexpectedException(
      'UNEXPECTED_EXCEPTION',
      'Something went wrong'
    );
  });

  // 404 handler
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      data: null,
      errors: [
        {
          code: 'ROUTE_NOT_FOUND',
          message: `Route not found: ${req.method} ${req.path}`,
        },
      ],
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

describe('errorHandler middleware', () => {
  const app = buildApp();

  it('returns ROUTE_NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].code).toBe('ROUTE_NOT_FOUND');
  });

  it('catches NotFoundException and returns 404 + typed code', async () => {
    const res = await request(app).get('/test/not-found');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.errors[0]).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  });

  it('catches ZodError and returns VALIDATION_ERROR with per-field details', async () => {
    const res = await request(app)
      .post('/test/zod-fail')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].code).toBe('VALIDATION_ERROR');
    expect(res.body.errors[0].field).toBe('email');
  });

  it('catches ValidationException with multiple details', async () => {
    const res = await request(app).post('/test/validation').send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors[0].code).toBe('VALIDATION_ERROR');
    expect(res.body.errors[0].field).toBe('body.email');
    expect(res.body.errors[1].field).toBe('body.name');
  });

  it('catches ConflictException and returns 409', async () => {
    const res = await request(app).post('/test/conflict').send({});
    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe('GENERIC_UNIQUE_CONSTRAINT');
  });

  it('catches unhandled Error and returns 500 UNEXPECTED_EXCEPTION', async () => {
    const res = await request(app).get('/test/unexpected');
    expect(res.status).toBe(500);
    expect(res.body.data).toBeNull();
    expect(res.body.errors[0].code).toBe('UNEXPECTED_EXCEPTION');
  });

  it('returns AppException status/code for explicit UnexpectedException', async () => {
    const res = await request(app).get('/test/unexpected-exc');
    expect(res.status).toBe(500);
    expect(res.body.errors[0].code).toBe('UNEXPECTED_EXCEPTION');
  });
});
