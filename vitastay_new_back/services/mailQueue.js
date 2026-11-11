/**
 * In-process mail/SMS queue. HTTP handlers enqueue and return.
 * Failed SMTP retries with backoff; jobs are dropped after max attempts.
 */
const logger = require('../config/logger');

const MAX_ATTEMPTS = 3;
const retryDelayMs = () => {
  const n = Number(process.env.MAIL_QUEUE_RETRY_MS);
  return Number.isFinite(n) ? n : 400;
};

const jobs = [];
let pumping = false;
let sender = null;

const setSender = (fn) => {
  sender = fn;
};

const defaultSender = async (job) => {
  if (job.channel === 'sms') {
    const { sendSms } = require('./smsService');
    const result = await sendSms({ to: job.to, text: job.text || job.subject });
    if (result.skipped) return result;
    if (!result.success) throw new Error(result.message || 'SMS send failed');
    return result;
  }
  const { sendEmail } = require('./emailService');
  const result = await sendEmail({
    to: job.to,
    subject: job.subject,
    html: job.html,
    text: job.text,
  });
  if (!result.success && result.message === 'SMTP not configured') return result;
  if (!result.success) throw new Error(result.message || 'Email send failed');
  return result;
};

const enqueue = (job) => {
  if (!job || !job.to) return;
  jobs.push({
    ...job,
    attempts: 0,
    maxAttempts: job.maxAttempts || MAX_ATTEMPTS,
  });
  setImmediate(pump);
};

const runOne = async (job) => {
  const fn = sender || defaultSender;
  await fn(job);
};

const pump = async () => {
  if (pumping) return;
  pumping = true;
  try {
    while (jobs.length) {
      const job = jobs.shift();
      try {
        await runOne(job);
      } catch (err) {
        job.attempts += 1;
        logger.warn(`Outbound ${job.channel || 'email'} failed (${job.attempts}/${job.maxAttempts}) ${job.subject || ''}: ${err.message}`);
        if (job.attempts < job.maxAttempts) {
          const wait = retryDelayMs() * (2 ** (job.attempts - 1));
          await new Promise((resolve) => {
            const t = setTimeout(resolve, wait);
            if (t.unref) t.unref();
          });
          jobs.push(job);
        } else {
          logger.error(`Outbound ${job.channel || 'email'} dropped after ${job.maxAttempts} attempts: ${job.subject} -> ${job.to}`);
        }
      }
    }
  } finally {
    pumping = false;
  }
};

const flush = async () => {
  const started = Date.now();
  while (jobs.length || pumping) {
    await pump();
    if (Date.now() - started > 10000) break;
    await new Promise((r) => setImmediate(r));
  }
};

const pendingCount = () => jobs.length;
const resetQueue = () => {
  jobs.length = 0;
  pumping = false;
};

module.exports = { enqueue, flush, pendingCount, resetQueue, setSender };
