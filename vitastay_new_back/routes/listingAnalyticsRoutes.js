const express = require('express');
const router = express.Router();
const listingAnalyticsController = require('../controllers/listingAnalyticsController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', authenticate, authorize('owner', 'super_admin'), listingAnalyticsController.dashboard);

module.exports = router;
