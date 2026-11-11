require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || process.env.APP_URL || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 10485760,
  otpExpiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 10,
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 30,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'Vita Stay <noreply@vitastay.com>',
  },
  support: {
    email: process.env.SUPPORT_EMAIL || '',
    phone: process.env.SUPPORT_PHONE || '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 600,
    enforceInDev: process.env.RATE_LIMIT_IN_DEV === 'true',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || '',
    apiKey: process.env.SMS_API_KEY || '',
  },
  payment: {
    gateway: process.env.PAYMENT_GATEWAY || (process.env.NODE_ENV === 'test' ? 'mock' : 'razorpay'),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '',
  },
  ownerPlan: {
    graceDays: Math.max(1, parseInt(process.env.OWNER_PLAN_GRACE_DAYS, 10) || 7),
  },
  booking: {
    // Pay-first window (BKG-007 / BKG-011). Owner-approval uses hours below (DEC-01).
    holdMinutes: Math.max(1, parseInt(process.env.BOOKING_HOLD_MINUTES, 10) || 15),
    approvalHoldHours: Math.max(1, parseInt(process.env.BOOKING_APPROVAL_HOLD_HOURS, 10) || 24),
  },
  media: {
    // Empty in v1 (local /uploads/media). Set to a CDN origin before scale-out (DEC-07, BIC-105).
    publicBaseUrl: String(process.env.MEDIA_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  },
  vitaEye: {
    // 32-byte hex. Empty derives from JWT_SECRET in dev/test — set FACE_EMBEDDING_KEY in production.
    embeddingKey: process.env.FACE_EMBEDDING_KEY || '',
    matchThreshold: Math.min(0.99, Math.max(0.5, Number(process.env.VITA_EYE_MATCH_THRESHOLD) || 0.85)),
    unknownRetentionDays: Math.min(365, Math.max(1, parseInt(process.env.VITA_EYE_UNKNOWN_RETENTION_DAYS, 10) || 30)),
    staleCaptureHours: Math.min(168, Math.max(1, parseInt(process.env.VITA_EYE_STALE_CAPTURE_HOURS, 10) || 24)),
  },
  googleMaps: {
    // Server key for Geocoding + Distance Matrix (BIC-025). Never expose in the browser.
    serverKey: process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
    cacheTtlHours: Math.max(1, parseInt(process.env.COMMUTE_CACHE_TTL_HOURS, 10) || 168),
  },
};
