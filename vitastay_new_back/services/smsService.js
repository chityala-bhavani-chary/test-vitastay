/**
 * SMS is optional. Configure SMS_PROVIDER + SMS_API_KEY when a DLT route is ready.
 * Never throw into HTTP handlers.
 */
const logger = require('../config/logger');

const isConfigured = () => Boolean(process.env.SMS_API_KEY || process.env.SMS_PROVIDER);

const sendSms = async ({ to, text }) => {
  if (!to || !isConfigured()) {
    logger.info(`SMS skipped (${isConfigured() ? 'no number' : 'no SMS_API_KEY'}): ${String(text || '').slice(0, 80)}`);
    return { success: false, skipped: true };
  }
  logger.warn(`SMS provider ${process.env.SMS_PROVIDER || 'unset'} is not wired yet; not sending to ${to}`);
  return { success: false, skipped: true, reason: 'provider_not_wired' };
};

module.exports = { sendSms, isConfigured };
