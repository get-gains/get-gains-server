import crypto from 'crypto';

const PEPPER = process.env.CODE_PEPPER ?? '';

export const hashCode = (code: string): string => {
  return crypto
    .createHash('sha256')
    .update(code + PEPPER)
    .digest('hex');
};
