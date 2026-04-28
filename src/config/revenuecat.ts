import { logger } from '../utils/logger';

export const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY ?? '';
export const REVENUECAT_WEBHOOK_AUTH_HEADER =
  process.env.REVENUECAT_AUTH_HEADER ?? '';
export const REVENUECAT_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID ?? '';
export const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v2';

if (!REVENUECAT_API_KEY) {
  logger.warn('REVENUECAT_API_KEY is not set');
}
if (!REVENUECAT_WEBHOOK_AUTH_HEADER) {
  logger.warn('REVENUECAT_AUTH_HEADER is not set');
}
