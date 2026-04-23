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
  ForbiddenException,
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

  // ── Phase 7: Gamification error routes ──

  // Shop: item not found
  app.get('/test/shop-not-found', () => {
    throw new NotFoundException(
      'SHOP_ITEM_NOT_FOUND',
      'Cosmetic not found or no longer available.'
    );
  });

  // Shop: already owned
  app.post('/test/shop-already-owned', () => {
    throw new ConflictException(
      'SHOP_ITEM_ALREADY_OWNED',
      'You already own this cosmetic.'
    );
  });

  // Coins: insufficient balance
  app.post('/test/insufficient-balance', () => {
    throw new BadRequestException(
      'COIN_INSUFFICIENT_BALANCE',
      'Insufficient coin balance. You need 50 more coins.'
    );
  });

  // Cosmetic: not owned
  app.post('/test/cosmetic-not-owned', () => {
    throw new BadRequestException(
      'COSMETIC_NOT_OWNED',
      'You do not own this cosmetic.'
    );
  });

  // Cosmetic: not equippable
  app.post('/test/cosmetic-not-equippable', () => {
    throw new BadRequestException(
      'COSMETIC_NOT_EQUIPPABLE',
      'This cosmetic is not currently equipped.'
    );
  });

  // Leaderboard: forbidden (not subscribed)
  app.get('/test/leaderboard-forbidden', () => {
    throw new ForbiddenException(
      'FORBIDDEN',
      'You must be subscribed to this coach to view their class leaderboard.'
    );
  });

  // Pose: form not found
  app.get('/test/pose-form-not-found', () => {
    throw new NotFoundException('POSE_FORM_NOT_FOUND', 'Form not found');
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

  // ── Phase 7: Gamification error tests ──

  it('returns SHOP_ITEM_NOT_FOUND for missing shop item', async () => {
    const res = await request(app).get('/test/shop-not-found');
    expect(res.status).toBe(404);
    expect(res.body.errors[0].code).toBe('SHOP_ITEM_NOT_FOUND');
  });

  it('returns SHOP_ITEM_ALREADY_OWNED as 409 Conflict', async () => {
    const res = await request(app).post('/test/shop-already-owned').send({});
    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe('SHOP_ITEM_ALREADY_OWNED');
  });

  it('returns COIN_INSUFFICIENT_BALANCE as 400', async () => {
    const res = await request(app).post('/test/insufficient-balance').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe('COIN_INSUFFICIENT_BALANCE');
    expect(res.body.errors[0].message).toContain('50 more coins');
  });

  it('returns COSMETIC_NOT_OWNED as 400', async () => {
    const res = await request(app).post('/test/cosmetic-not-owned').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe('COSMETIC_NOT_OWNED');
  });

  it('returns COSMETIC_NOT_EQUIPPABLE as 400', async () => {
    const res = await request(app)
      .post('/test/cosmetic-not-equippable')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe('COSMETIC_NOT_EQUIPPABLE');
  });

  it('returns 403 FORBIDDEN for leaderboard access without subscription', async () => {
    const res = await request(app).get('/test/leaderboard-forbidden');
    expect(res.status).toBe(403);
    expect(res.body.errors[0].code).toBe('FORBIDDEN');
  });

  it('returns POSE_FORM_NOT_FOUND for missing form', async () => {
    const res = await request(app).get('/test/pose-form-not-found');
    expect(res.status).toBe(404);
    expect(res.body.errors[0].code).toBe('POSE_FORM_NOT_FOUND');
  });
});
