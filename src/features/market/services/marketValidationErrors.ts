import type { ValidateOrderBlockReason } from '@/features/market/services/marketValidateOrderFlow';

export class MarketOrderValidationError extends Error {
  readonly code: ValidateOrderBlockReason;

  constructor(code: ValidateOrderBlockReason, message: string) {
    super(message);
    this.name = 'MarketOrderValidationError';
    this.code = code;
  }
}
