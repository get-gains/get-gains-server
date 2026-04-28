import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { REVENUECAT_WEBHOOK_AUTH_HEADER } from '../config/revenuecat';
import { processRevenueCatWebhook } from '../services/revenuecat.service';
import { UnauthorizedException } from '../lib/errors';
import crypto from 'crypto';

/**
 * Handle RevenueCat webhook
 *
 * Auth: Authorization header must match REVENUECAT_WEBHOOK_AUTH_HEADER.
 * Constant-time comparison to prevent timing attacks.
 * Always returns 200 to acknowledge receipt.
 */
export const handleRevenueCatWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Auth check — outside try-catch so failures propagate to global error handler
  const authHeader = req.headers.authorization ?? '';
  if (
    !REVENUECAT_WEBHOOK_AUTH_HEADER ||
    !constantTimeEqual(authHeader, REVENUECAT_WEBHOOK_AUTH_HEADER)
  ) {
    logger.warn('RC webhook auth failed', {
      ip:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress,
    });
    throw new UnauthorizedException(
      'REVENUECAT_INVALID_SIGNATURE',
      'Invalid webhook signature'
    );
  }

  try {
    const payload = req.body;
    if (!payload?.event?.id || !payload?.event?.app_user_id) {
      logger.warn('RC webhook missing required fields');
      sendSuccess(res, { acknowledged: true });
      return;
    }

    logger.info('Received RC webhook', {
      eventId: payload.event.id,
      type: payload.event.type,
      appUserId: payload.event.app_user_id,
    });

    const result = await processRevenueCatWebhook(payload);

    sendSuccess(res, {
      acknowledged: true,
      processed: result.processed,
      duplicate: result.duplicate ?? false,
    });
  } catch (error) {
    logger.error('Error handling RC webhook', error);
    // Always 200 to prevent RC retries on our errors
    sendSuccess(res, { acknowledged: true, error: 'Processing error' });
  }
};

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid leaking length info via timing
    crypto.timingSafeEqual(
      Buffer.from(a.padEnd(64, '\0')),
      Buffer.from(b.padEnd(64, '\0'))
    );
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
