import { brevo } from '../config/brevo';
import { logger } from '../utils/logger';

const OTP_EMAIL_TEMPLATE = (code: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#171717;border-radius:16px;border:1px solid #262626;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;">Reset Your Password</h1>
              <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Use the verification code below to reset your password. This code expires in 10 minutes.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#0a0a0a;border-radius:12px;padding:24px 16px;border:1px dashed #404040;">
                    <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#facc15;">${code}</span>
                  </td>
                </tr>
              </table>

              <p style="color:#737373;font-size:13px;line-height:1.5;margin:32px 0 0;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const sendPasswordResetCode = async (
  email: string,
  code: string
): Promise<void> => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@getgains.app';
  const senderName = process.env.BREVO_SENDER_NAME || 'Get Gains';

  logger.info('Sending password reset code', { email });

  await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email }],
    subject: `${code} is your Get Gains verification code`,
    htmlContent: OTP_EMAIL_TEMPLATE(code),
  });

  logger.info('Password reset code sent', { email });
};

const COACH_INVITE_EMAIL_TEMPLATE = (code: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#171717;border-radius:16px;border:1px solid #262626;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;">You're Invited to Coach on Get Gains</h1>
              <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Use the code below in the Get Gains app to claim your coach profile. This code expires in 7 days.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#0a0a0a;border-radius:12px;padding:24px 16px;border:1px dashed #404040;">
                    <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#facc15;">${code}</span>
                  </td>
                </tr>
              </table>

              <p style="color:#737373;font-size:13px;line-height:1.5;margin:32px 0 0;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const VERIFICATION_EMAIL_TEMPLATE = (code: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#171717;border-radius:16px;border:1px solid #262626;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;">Verify Your Email</h1>
              <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Welcome to Get Gains! Use the verification code below to confirm your email address. This code expires in 10 minutes.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#0a0a0a;border-radius:12px;padding:24px 16px;border:1px dashed #404040;">
                    <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#facc15;">${code}</span>
                  </td>
                </tr>
              </table>

              <p style="color:#737373;font-size:13px;line-height:1.5;margin:32px 0 0;">
                If you didn't create an account with Get Gains, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const sendEmailVerificationCode = async (
  email: string,
  code: string
): Promise<void> => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@getgains.app';
  const senderName = process.env.BREVO_SENDER_NAME || 'Get Gains';

  logger.info('Sending email verification code', { email });

  await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email }],
    subject: `${code} is your Get Gains email verification code`,
    htmlContent: VERIFICATION_EMAIL_TEMPLATE(code),
  });

  logger.info('Email verification code sent', { email });
};

export const sendCoachInvitationCode = async (
  email: string,
  code: string
): Promise<void> => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@getgains.app';
  const senderName = process.env.BREVO_SENDER_NAME || 'Get Gains';

  logger.info('Sending coach invitation code', { email });

  await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email }],
    subject: 'Your Get Gains coach invitation code',
    htmlContent: COACH_INVITE_EMAIL_TEMPLATE(code),
  });

  logger.info('Coach invitation code sent', { email });
};
