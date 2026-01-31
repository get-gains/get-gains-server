import { Router } from 'express';
import {
  handleGooglePlayWebhook,
  webhookHealth,
} from '../controllers/webhook.controller';

const router = Router();

/**
 * GET /api/webhooks/health
 * Health check for webhook endpoints
 */
router.get('/health', webhookHealth);

/**
 * POST /api/webhooks/google-play
 * Google Play Pub/Sub webhook endpoint
 *
 * This endpoint receives push notifications from Google Cloud Pub/Sub
 * when subscription events occur (purchases, renewals, cancellations, etc.)
 *
 * Note: No authentication middleware - Pub/Sub has its own verification
 * via the subscription configuration in Google Cloud Console
 */
router.post('/google-play', handleGooglePlayWebhook);

export default router;
