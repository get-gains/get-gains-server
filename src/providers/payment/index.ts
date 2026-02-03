import { PaymentProvider } from '../../generated/prisma/client';
import { IPaymentProvider } from './payment.provider.interface';
import { getGooglePlayProvider } from './google-play.provider';
import { logger } from '../../utils/logger';

export * from './payment.provider.interface';
export * from './google-play.provider';

/**
 * Get the appropriate payment provider instance
 */
export const getPaymentProvider = (
  provider: PaymentProvider
): IPaymentProvider => {
  switch (provider) {
    case PaymentProvider.GOOGLE_PAY:
      return getGooglePlayProvider();
    default:
      logger.error(`Unknown payment provider: ${provider}`);
      throw new Error(`Unknown payment provider: ${provider}`);
  }
};

/**
 * Get all available payment providers
 */
export const getAllPaymentProviders = (): IPaymentProvider[] => {
  return [getGooglePlayProvider()];
};
