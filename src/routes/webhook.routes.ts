import { Router } from 'express';
import { handleRevenueCatWebhook } from '../controllers/revenuecat.controller';
import { sendSuccess } from '../utils/response';

const router = Router();

/**
 * GET /api/webhooks/health
 * Health check for webhook endpoints
 */
router.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'healthy',
    provider: 'revenuecat',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/webhooks/revenuecat
 * RevenueCat webhook endpoint
 *
 * Auth is handled inside the controller via Authorization header
 * matching REVENUECAT_AUTH_HEADER (constant-time compare).
 */
router.post('/revenuecat', handleRevenueCatWebhook);

export default router;
