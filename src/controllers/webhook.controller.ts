import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { getGooglePlayProvider } from '../providers/payment';
import { processWebhookEvent } from '../services/subscription.service';

/**
 * Handle Google Play Pub/Sub webhook
 *
 * Google Cloud Pub/Sub sends messages to this endpoint when subscription
 * events occur (purchases, renewals, cancellations, etc.)
 */
export const handleGooglePlayWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    logger.info('Received Google Play webhook', {
      ip: ipAddress,
      hasBody: !!req.body,
    });

    // Parse the webhook payload
    const provider = getGooglePlayProvider();
    const eventData = await provider.parseWebhook(
      req.body,
      req.headers as Record<string, string>
    );

    if (!eventData) {
      logger.warn('Failed to parse Google Play webhook');
      // Return 200 to acknowledge receipt (prevent retries for invalid payloads)
      sendSuccess(res, { acknowledged: true });
      return;
    }

    logger.info('Parsed webhook event', {
      eventType: eventData.eventType,
      productId: eventData.productId,
    });

    // Process the event
    const result = await processWebhookEvent(eventData, ipAddress, userAgent);

    if (!result.processed) {
      logger.warn('Webhook event processing failed', {
        eventType: eventData.eventType,
      });
    }

    // Always return 200 to acknowledge receipt
    // Google Pub/Sub will retry on non-2xx responses
    sendSuccess(res, {
      acknowledged: true,
      processed: result.processed,
      subscriptionFound: result.subscriptionFound,
    });
  } catch (error) {
    logger.error('Error handling Google Play webhook', error);
    // Return 200 to prevent infinite retries
    // The error is logged and can be investigated
    sendSuccess(res, { acknowledged: true, error: 'Processing error' });
  }
};

/**
 * Health check endpoint for webhook receiver
 */
export const webhookHealth = async (
  req: Request,
  res: Response
): Promise<void> => {
  sendSuccess(res, {
    status: 'healthy',
    provider: 'google_play',
    timestamp: new Date().toISOString(),
  });
};
