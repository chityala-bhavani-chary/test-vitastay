const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const xss = require('xss-clean');
const config = require('./config');
const logger = require('./config/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { cacheControlForFile } = require('./services/mediaStorage');
const { gateUploads } = require('./middleware/gateUploads');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const roomRoutes = require('./routes/roomRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const rentRoutes = require('./routes/rentRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const staffRoutes = require('./routes/staffRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const bedRoutes = require('./routes/bedRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const paymentWebhookRoutes = require('./routes/paymentWebhookRoutes');
const publicListingRoutes = require('./routes/publicListingRoutes');
const publicAuthRoutes = require('./routes/publicAuthRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const publicCommuteRoutes = require('./routes/publicCommuteRoutes');
const commuteOfficeRoutes = require('./routes/commuteOfficeRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const visitSeekerRoutes = require('./routes/visitSeekerRoutes');
const publicRefundPolicyRoutes = require('./routes/publicRefundPolicyRoutes');
const publicVitaEyePrivacyRoutes = require('./routes/publicVitaEyePrivacyRoutes');
const listingAnalyticsRoutes = require('./routes/listingAnalyticsRoutes');
const ownerPlanRoutes = require('./routes/ownerPlanRoutes');

const app = express();
app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const isAllowedOrigin = (origin) => {
  if (!origin || config.corsOrigins.includes(origin)) return true;
  if (config.nodeEnv === 'production') return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname.endsWith('.trycloudflare.com');
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(compression());
app.use('/api/payments/webhook', (req, res, next) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    req.rawBody = raw.toString('utf8');
    req.body = raw;
    next();
  });
  req.on('error', next);
}, paymentWebhookRoutes);
app.use(xss());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', gateUploads);
app.use('/uploads/media', express.static(path.join(uploadsDir, 'media'), {
  etag: true,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', cacheControlForFile(filePath));
  },
}));
app.use('/uploads', express.static(uploadsDir, {
  etag: true,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', cacheControlForFile(filePath));
  },
}));
app.use(apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Vita Stay API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/public/listings', publicListingRoutes);
app.use('/api/public/pg', require('./routes/publicLocationRoutes'));
app.use('/api/public/auth', publicAuthRoutes);
app.use('/api/public/refund-policy', publicRefundPolicyRoutes);
app.use('/api/public/vita-eye-privacy', publicVitaEyePrivacyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/public/commute', publicCommuteRoutes);
app.use('/api/commute/office', commuteOfficeRoutes);
app.use('/api/waitlists', waitlistRoutes);
app.use('/api/visits', visitSeekerRoutes);
app.use('/api/listing-analytics', listingAnalyticsRoutes);
app.use('/api', ownerPlanRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
